// Persistent mock implementation of the Thredd API.
// State lives in Supabase (mock_cards, mock_card_txns) so that Cloudflare
// Worker cold starts / isolate churn don't lose issued cards or balances.
// Enabled when THREDD_MOCK=true or when THREDD_API_KEY is not configured.

import type {
  KycStatus,
  KycSubmission,
  ThreddCard,
  ThreddCardDetail,
  ThreddCardTxn,
  ThreddCustomer,
} from "./thredd.types";

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// Dynamic import — this module is transitively reachable from route files,
// so `client.server` must NOT be a top-level import (would leak into client
// bundle graph). Loading inside async fns keeps it server-only.
async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type CardRow = {
  card_id: string;
  customer_id: string;
  type: string;
  status: string;
  last4: string;
  expiry: string;
  brand: string;
  alias: string | null;
  balance: number;
  currency: string;
  daily_limit: number;
  pan: string;
  cvv: string;
  pin: string;
  created_at: string;
};

type TxnRow = {
  id: string;
  card_id: string;
  amount: number;
  currency: string;
  merchant: string;
  category: string;
  status: string;
  timestamp: string;
};

function rowToDetail(r: CardRow): ThreddCardDetail {
  return {
    cardId: r.card_id,
    customerId: r.customer_id,
    type: r.type as ThreddCardDetail["type"],
    status: r.status as ThreddCardDetail["status"],
    last4: r.last4,
    expiry: r.expiry,
    brand: r.brand as ThreddCardDetail["brand"],
    alias: r.alias ?? undefined,
    balance: Number(r.balance),
    currency: r.currency,
    dailyLimit: Number(r.daily_limit),
    createdAt: r.created_at,
    pan: r.pan,
    cvv: r.cvv,
    pin: r.pin,
  };
}

function stripSecrets(c: ThreddCardDetail): ThreddCard {
  const { pan: _p, cvv: _c, pin: _pi, ...rest } = c;
  return rest;
}

function rowToTxn(r: TxnRow): ThreddCardTxn {
  return {
    id: r.id,
    cardId: r.card_id,
    amount: Number(r.amount),
    currency: r.currency,
    merchant: r.merchant,
    category: r.category,
    status: r.status as ThreddCardTxn["status"],
    timestamp: r.timestamp,
  };
}

async function getCardRow(cardId: string): Promise<CardRow> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("mock_cards")
    .select("*")
    .eq("card_id", cardId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("card_not_found");
  return data as CardRow;
}

export const threddMock = {
  // ---- Customers / KYC (stateless demo stubs) --------------------------------
  async createCustomer(input: {
    email: string;
    firstName: string;
    lastName: string;
  }): Promise<ThreddCustomer> {
    return {
      customerId: id("cus"),
      ...input,
      kycStatus: "not_started",
      createdAt: new Date().toISOString(),
    };
  },
  async submitKyc(input: KycSubmission): Promise<{ customerId: string; status: KycStatus }> {
    return { customerId: input.customerId, status: "pending" };
  },
  async getKycStatus(customerId: string): Promise<{ customerId: string; status: KycStatus }> {
    return { customerId, status: "approved" };
  },

  // ---- Cards (persisted) -----------------------------------------------------
  async createVirtualCard(input: {
    customerId: string;
    alias?: string;
    currency?: string;
  }): Promise<ThreddCard> {
    const supabase = await db();
    const cardId = id("card");
    const last4 = String(Math.floor(1000 + Math.random() * 9000));
    const row: CardRow = {
      card_id: cardId,
      customer_id: input.customerId,
      type: "virtual",
      status: "active",
      last4,
      expiry: "12/29",
      brand: "VISA",
      alias: input.alias ?? "Virtual Card",
      balance: 0,
      currency: input.currency ?? "USD",
      daily_limit: 5000,
      pan: `4829 3819 4432 ${last4}`,
      cvv: String(Math.floor(100 + Math.random() * 900)),
      pin: String(Math.floor(1000 + Math.random() * 9000)),
      created_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("mock_cards").insert(row);
    if (error) throw new Error(error.message);
    return stripSecrets(rowToDetail(row));
  },

  async createPhysicalCardRequest(input: {
    customerId: string;
    shippingAddress: string;
    alias?: string;
  }): Promise<ThreddCard> {
    const supabase = await db();
    const cardId = id("card");
    const last4 = String(Math.floor(1000 + Math.random() * 9000));
    const row: CardRow = {
      card_id: cardId,
      customer_id: input.customerId,
      type: "physical",
      status: "pending",
      last4,
      expiry: "12/30",
      brand: "VISA",
      alias: input.alias ?? "Physical Card",
      balance: 0,
      currency: "USD",
      daily_limit: 10000,
      pan: `4829 3819 4432 ${last4}`,
      cvv: String(Math.floor(100 + Math.random() * 900)),
      pin: String(Math.floor(1000 + Math.random() * 9000)),
      created_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("mock_cards").insert(row);
    if (error) throw new Error(error.message);
    return stripSecrets(rowToDetail(row));
  },

  async getCardList(customerId: string): Promise<ThreddCard[]> {
    const supabase = await db();
    const { data, error } = await supabase
      .from("mock_cards")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data as CardRow[]).map((r) => stripSecrets(rowToDetail(r)));
  },

  async getCardDetail(cardId: string): Promise<ThreddCardDetail> {
    return rowToDetail(await getCardRow(cardId));
  },

  async freezeCard(cardId: string): Promise<ThreddCard> {
    const supabase = await db();
    const { data, error } = await supabase
      .from("mock_cards")
      .update({ status: "frozen" })
      .eq("card_id", cardId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("card_not_found");
    return stripSecrets(rowToDetail(data as CardRow));
  },

  async unfreezeCard(cardId: string): Promise<ThreddCard> {
    const supabase = await db();
    const { data, error } = await supabase
      .from("mock_cards")
      .update({ status: "active" })
      .eq("card_id", cardId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("card_not_found");
    return stripSecrets(rowToDetail(data as CardRow));
  },

  async getPin(cardId: string): Promise<{ pin: string }> {
    const r = await getCardRow(cardId);
    return { pin: r.pin };
  },

  async getCvv(cardId: string): Promise<{ cvv: string }> {
    const r = await getCardRow(cardId);
    return { cvv: r.cvv };
  },

  async fundCard(cardId: string, amount: number): Promise<ThreddCard> {
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("invalid_amount");
    const supabase = await db();
    const current = await getCardRow(cardId);
    const newBalance = Number((Number(current.balance) + amount).toFixed(2));
    const { data, error } = await supabase
      .from("mock_cards")
      .update({ balance: newBalance })
      .eq("card_id", cardId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("card_not_found");
    return stripSecrets(rowToDetail(data as CardRow));
  },

  async getCardTransactions(cardId: string): Promise<ThreddCardTxn[]> {
    const supabase = await db();
    const { data, error } = await supabase
      .from("mock_card_txns")
      .select("*")
      .eq("card_id", cardId)
      .order("timestamp", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as TxnRow[]).map(rowToTxn);
  },
};

export type ThreddMock = typeof threddMock;
