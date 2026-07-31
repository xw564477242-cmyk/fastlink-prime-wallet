import { describe, expect, it } from "bun:test";
import {
  WALLET_BALANCE_SUMMARY_MAX_ITEMS,
  WALLET_BALANCE_SUMMARY_MAX_JSON_BYTES,
  WALLET_BALANCE_SUMMARY_PATH,
  normalizeWalletBalanceResponse,
  walletBalanceSummaryReadAllowed,
  type BackendSession,
  type WalletAssetAccount,
} from "./backend-api";
import {
  captureWalletBalanceAccountsVersion,
  walletBalanceSessionKey,
} from "./wallet-account-state";

const item = (assetCode = "USD", patch: Record<string, unknown> = {}) => ({
  assetCode,
  availableBalance: "80",
  ledgerBalance: "100",
  pendingBalance: "20",
  updatedAt: "2026-07-31T08:00:00.000Z",
  ...patch,
});

const parse = (value: unknown) => normalizeWalletBalanceResponse(JSON.stringify(value));

const session = (patch: Partial<BackendSession> = {}): BackendSession => ({
  actorId: "actor-a",
  expiresAt: "2026-08-01T08:00:00.000Z",
  tenantId: "tenant-a",
  customerId: "customer-a",
  environment: "TEST",
  ...patch,
});

describe("Wallet balance summary hostile input boundary", () => {
  it("accepts only the bounded authenticated Backend contract", () => {
    expect(WALLET_BALANCE_SUMMARY_PATH).toBe("/v1/wallet/balances");
    expect(WALLET_BALANCE_SUMMARY_MAX_ITEMS).toBe(50);
    expect(WALLET_BALANCE_SUMMARY_MAX_JSON_BYTES).toBe(32_768);
    expect(parse({ items: [item()] })).toEqual([item()]);
    expect(parse({ items: [] })).toEqual([]);
  });

  it("rejects Proxy before reflection with every relevant trap at zero", () => {
    const traps = { get: 0, getPrototypeOf: 0, ownKeys: 0, getOwnPropertyDescriptor: 0 };
    const proxy = new Proxy(
      { items: [item()] },
      {
        get() {
          traps.get += 1;
          throw new Error("get trap must not run");
        },
        getPrototypeOf() {
          traps.getPrototypeOf += 1;
          throw new Error("prototype trap must not run");
        },
        ownKeys() {
          traps.ownKeys += 1;
          throw new Error("ownKeys trap must not run");
        },
        getOwnPropertyDescriptor() {
          traps.getOwnPropertyDescriptor += 1;
          throw new Error("descriptor trap must not run");
        },
      },
    );
    expect(() => normalizeWalletBalanceResponse(proxy as unknown as string)).toThrow(
      "Backend returned an invalid Wallet balance response",
    );
    expect(traps).toEqual({ get: 0, getPrototypeOf: 0, ownKeys: 0, getOwnPropertyDescriptor: 0 });
  });

  it("rejects accessor and inherited objects before executing user code", () => {
    let getterCalls = 0;
    const accessor = {};
    Object.defineProperty(accessor, "items", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return [item()];
      },
    });
    expect(() => normalizeWalletBalanceResponse(accessor as unknown as string)).toThrow();
    expect(getterCalls).toBe(0);

    const inherited = Object.create({ items: [item()] });
    expect(() => normalizeWalletBalanceResponse(inherited as string)).toThrow();
  });

  it("rejects malformed, oversized, sparse and non-allowlisted JSON", () => {
    expect(() => normalizeWalletBalanceResponse("not-json")).toThrow();
    expect(() =>
      normalizeWalletBalanceResponse(" ".repeat(WALLET_BALANCE_SUMMARY_MAX_JSON_BYTES + 1)),
    ).toThrow();
    expect(() =>
      normalizeWalletBalanceResponse(`{"items":[],"padding":"${"€".repeat(11_000)}"}`),
    ).toThrow("Backend returned an oversized Wallet balance response");
    expect(() => parse({ items: [], tenantId: "must-not-render" })).toThrow();
    expect(() => parse({ items: [item("USD", { provider: "THREDD" })] })).toThrow();
    expect(() => normalizeWalletBalanceResponse('{"items":[null]}')).toThrow();
    expect(() =>
      parse({ items: Array.from({ length: 51 }, (_, index) => item(`A${index}`)) }),
    ).toThrow();
  });

  it("validates canonical Decimal(36,18), the ledger equation and canonical timestamps", () => {
    expect(
      parse({
        items: [
          item("USD", {
            availableBalance: "-1.5",
            pendingBalance: "2.25",
            ledgerBalance: "0.75",
          }),
        ],
      })[0].ledgerBalance,
    ).toBe("0.75");
    for (const availableBalance of [
      "-0",
      "00",
      "01",
      "+1",
      "1.0",
      "1.230",
      "1e3",
      "1234567890123456789",
      "1.1234567890123456789",
    ]) {
      expect(() => parse({ items: [item("USD", { availableBalance })] })).toThrow();
    }
    expect(() => parse({ items: [item("USD", { ledgerBalance: "99" })] })).toThrow(
      "Backend returned an inconsistent Wallet balance account",
    );
    for (const updatedAt of [
      "0000-01-01T00:00:00.000Z",
      "2026-02-30T00:00:00.000Z",
      "2026-01-01T00:00:00Z",
      "2026-01-01T00:00:00.000+00:00",
      "2026-01-01 00:00:00.000Z",
    ]) {
      expect(() => parse({ items: [item("USD", { updatedAt })] })).toThrow();
    }
  });

  it("requires unique strictly ascending assets", () => {
    expect(() => parse({ items: [item("USD"), item("USD")] })).toThrow();
    expect(() => parse({ items: [item("USD"), item("EUR")] })).toThrow();
    expect(() => parse({ items: [item("usd")] })).toThrow();
    expect(parse({ items: [item("EUR"), item("USD")] }).map((entry) => entry.assetCode)).toEqual([
      "EUR",
      "USD",
    ]);
  });
});

describe("Wallet balance summary request identity", () => {
  it("permits only matching SANDBOX and TEST session/runtime pairs", () => {
    expect(walletBalanceSummaryReadAllowed("SANDBOX", "SANDBOX")).toBe(true);
    expect(walletBalanceSummaryReadAllowed("TEST", "TEST")).toBe(true);
    expect(walletBalanceSummaryReadAllowed("TEST", "SANDBOX")).toBe(false);
    expect(walletBalanceSummaryReadAllowed("UAT", "UAT")).toBe(false);
    expect(walletBalanceSummaryReadAllowed("PRODUCTION", "PRODUCTION")).toBe(false);
  });

  it("binds actor, session expiry, tenant, customer and environment", () => {
    const baseline = walletBalanceSessionKey(session());
    for (const changed of [
      session({ actorId: "actor-b" }),
      session({ expiresAt: "2026-08-01T09:00:00.000Z" }),
      session({ tenantId: "tenant-b" }),
      session({ customerId: "customer-b" }),
      session({ environment: "SANDBOX" }),
    ])
      expect(walletBalanceSessionKey(changed)).not.toBe(baseline);
  });

  it("versions every visible account summary field", () => {
    const account: WalletAssetAccount = item() as WalletAssetAccount;
    const baseline = captureWalletBalanceAccountsVersion([account]);
    for (const changed of [
      { ...account, assetCode: "EUR" },
      { ...account, availableBalance: "79" },
      { ...account, ledgerBalance: "99" },
      { ...account, pendingBalance: "19" },
      { ...account, updatedAt: "2026-07-31T08:00:01.000Z" },
    ])
      expect(captureWalletBalanceAccountsVersion([changed])).not.toBe(baseline);
  });
});
