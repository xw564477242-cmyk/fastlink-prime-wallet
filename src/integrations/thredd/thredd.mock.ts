// In-memory mock implementation of the Thredd API for local development.
// Enabled when THREDD_MOCK=true or when THREDD_API_KEY is not configured.

import type {
  KycStatus,
  KycSubmission,
  ThreddCard,
  ThreddCardDetail,
  ThreddCardTxn,
  ThreddCustomer,
  CardType,
} from "./thredd.types";

const customers = new Map<string, ThreddCustomer>();
const cards = new Map<string, ThreddCardDetail>();
const txns = new Map<string, ThreddCardTxn[]>();

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function seed() {
  if (customers.size > 0) return;
  const cust: ThreddCustomer = {
    customerId: "cus_demo",
    email: "daniel@fastlink.app",
    firstName: "Daniel",
    lastName: "Chen",
    kycStatus: "approved",
    createdAt: new Date().toISOString(),
  };
  customers.set(cust.customerId, cust);

  const presets: Array<{ type: CardType; last4: string; exp: string; bal: number; limit: number; alias: string }> = [
    { type: "virtual", last4: "4829", exp: "08/29", bal: 1842.6, limit: 5000, alias: "Daily Spend" },
    { type: "physical", last4: "9130", exp: "11/28", bal: 620.4, limit: 10000, alias: "Wallet Card" },
    { type: "travel", last4: "2246", exp: "03/30", bal: 980.0, limit: 7500, alias: "Trip Card" },
  ];
  for (const p of presets) {
    const cardId = id("card");
    const detail: ThreddCardDetail = {
      cardId,
      customerId: cust.customerId,
      type: p.type,
      status: "active",
      last4: p.last4,
      expiry: p.exp,
      brand: "VISA",
      alias: p.alias,
      balance: p.bal,
      currency: "USD",
      dailyLimit: p.limit,
      createdAt: new Date().toISOString(),
      pan: `4829 3819 4432 ${p.last4}`,
      cvv: String(Math.floor(100 + Math.random() * 900)),
      pin: String(Math.floor(1000 + Math.random() * 9000)),
    };
    cards.set(cardId, detail);
    txns.set(cardId, [
      {
        id: id("txn"),
        cardId,
        amount: -24.5,
        currency: "USD",
        merchant: "Starbucks",
        category: "Food & Drink",
        status: "cleared",
        timestamp: new Date(Date.now() - 3600_000).toISOString(),
      },
      {
        id: id("txn"),
        cardId,
        amount: -128.9,
        currency: "USD",
        merchant: "Apple Store",
        category: "Shopping",
        status: "settled",
        timestamp: new Date(Date.now() - 86_400_000).toISOString(),
      },
    ]);
  }
}

function stripSecrets(c: ThreddCardDetail): ThreddCard {
  const { pan: _p, cvv: _c, pin: _pi, ...rest } = c;
  return rest;
}

export const threddMock = {
  async createCustomer(input: { email: string; firstName: string; lastName: string }): Promise<ThreddCustomer> {
    seed();
    const c: ThreddCustomer = {
      customerId: id("cus"),
      ...input,
      kycStatus: "not_started",
      createdAt: new Date().toISOString(),
    };
    customers.set(c.customerId, c);
    return c;
  },
  async submitKyc(input: KycSubmission): Promise<{ customerId: string; status: KycStatus }> {
    seed();
    const c = customers.get(input.customerId);
    if (!c) throw new Error("customer_not_found");
    c.kycStatus = "pending";
    // simulate async approval
    setTimeout(() => {
      c.kycStatus = "approved";
    }, 500);
    return { customerId: c.customerId, status: c.kycStatus };
  },
  async getKycStatus(customerId: string): Promise<{ customerId: string; status: KycStatus }> {
    seed();
    const c = customers.get(customerId) ?? customers.get("cus_demo")!;
    return { customerId: c.customerId, status: c.kycStatus };
  },
  async createVirtualCard(input: { customerId: string; alias?: string; currency?: string }): Promise<ThreddCard> {
    seed();
    const cardId = id("card");
    const last4 = String(Math.floor(1000 + Math.random() * 9000));
    const detail: ThreddCardDetail = {
      cardId,
      customerId: input.customerId,
      type: "virtual",
      status: "active",
      last4,
      expiry: "12/29",
      brand: "VISA",
      alias: input.alias ?? "Virtual Card",
      balance: 0,
      currency: input.currency ?? "USD",
      dailyLimit: 5000,
      createdAt: new Date().toISOString(),
      pan: `4829 3819 4432 ${last4}`,
      cvv: String(Math.floor(100 + Math.random() * 900)),
      pin: String(Math.floor(1000 + Math.random() * 9000)),
    };
    cards.set(cardId, detail);
    txns.set(cardId, []);
    return stripSecrets(detail);
  },
  async createPhysicalCardRequest(input: {
    customerId: string;
    shippingAddress: string;
    alias?: string;
  }): Promise<ThreddCard> {
    seed();
    const cardId = id("card");
    const last4 = String(Math.floor(1000 + Math.random() * 9000));
    const detail: ThreddCardDetail = {
      cardId,
      customerId: input.customerId,
      type: "physical",
      status: "pending",
      last4,
      expiry: "12/30",
      brand: "VISA",
      alias: input.alias ?? "Physical Card",
      balance: 0,
      currency: "USD",
      dailyLimit: 10000,
      createdAt: new Date().toISOString(),
      pan: `4829 3819 4432 ${last4}`,
      cvv: String(Math.floor(100 + Math.random() * 900)),
      pin: String(Math.floor(1000 + Math.random() * 9000)),
    };
    cards.set(cardId, detail);
    txns.set(cardId, []);
    return stripSecrets(detail);
  },
  async getCardList(customerId: string): Promise<ThreddCard[]> {
    seed();
    return Array.from(cards.values())
      .filter((c) => c.customerId === customerId)
      .map(stripSecrets);
  },
  async getCardDetail(cardId: string): Promise<ThreddCardDetail> {
    seed();
    const c = cards.get(cardId);
    if (!c) throw new Error("card_not_found");
    return c;
  },
  async freezeCard(cardId: string): Promise<ThreddCard> {
    const c = cards.get(cardId);
    if (!c) throw new Error("card_not_found");
    c.status = "frozen";
    return stripSecrets(c);
  },
  async unfreezeCard(cardId: string): Promise<ThreddCard> {
    const c = cards.get(cardId);
    if (!c) throw new Error("card_not_found");
    c.status = "active";
    return stripSecrets(c);
  },
  async getPin(cardId: string): Promise<{ pin: string }> {
    const c = cards.get(cardId);
    if (!c) throw new Error("card_not_found");
    return { pin: c.pin };
  },
  async getCvv(cardId: string): Promise<{ cvv: string }> {
    const c = cards.get(cardId);
    if (!c) throw new Error("card_not_found");
    return { cvv: c.cvv };
  },
  async fundCard(cardId: string, amount: number): Promise<ThreddCard> {
    const c = cards.get(cardId);
    if (!c) throw new Error("card_not_found");
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("invalid_amount");
    c.balance = Number((c.balance + amount).toFixed(2));
    return stripSecrets(c);
  },
  async getCardTransactions(cardId: string): Promise<ThreddCardTxn[]> {
    seed();
    return txns.get(cardId) ?? [];
  },
};

export type ThreddMock = typeof threddMock;
