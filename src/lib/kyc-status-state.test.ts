import { describe, expect, it } from "bun:test";
import type { BackendSession, FastLinkEnvironment } from "./backend-api";
import {
  fetchKycStatus,
  kycStatusSessionReadAllowed,
  parseKycStatusResponse,
  type KycStatusRuntime,
} from "./kyc-status-state";

const now = Date.parse("2026-08-02T00:00:00.000Z");

function runtime(
  environment: FastLinkEnvironment | undefined = "SANDBOX",
  patch: Partial<KycStatusRuntime> = {},
): KycStatusRuntime {
  return { apiUrl: "/api", environment, error: null, ...patch };
}

function session(
  environment: FastLinkEnvironment = "SANDBOX",
  patch: Partial<BackendSession> = {},
): BackendSession {
  return {
    actorId: "actor-kyc",
    tenantId: "tenant-kyc",
    customerId: "customer-kyc",
    environment,
    expiresAt: "2099-08-02T00:00:00.000Z",
    ...patch,
  };
}

describe("KYC status strict read contract", () => {
  it("accepts only the exact two-field public response", () => {
    expect(parseKycStatusResponse('{"status":"PENDING","reviewedAt":null}')).toEqual({
      status: "PENDING",
      reviewedAt: null,
    });
    expect(
      parseKycStatusResponse('{"status":"APPROVED","reviewedAt":"2026-08-02T00:00:00.000Z"}'),
    ).toEqual({ status: "APPROVED", reviewedAt: "2026-08-02T00:00:00.000Z" });
    expect(
      parseKycStatusResponse('{"reviewedAt":"2026-08-02T00:00:00Z","status":"REJECTED"}'),
    ).toEqual({ status: "REJECTED", reviewedAt: "2026-08-02T00:00:00Z" });
  });

  it("rejects extra, missing, malformed, oversized and invented values", () => {
    const invalid = [
      '{"status":"APPROVED","reviewedAt":null,"provider":"secret"}',
      '{"status":"APPROVED"}',
      '{"status":"approved","reviewedAt":null}',
      '{"status":"VERIFIED","reviewedAt":null}',
      '{"status":"PENDING","reviewedAt":"not-a-date"}',
      '{"status":"PENDING","reviewedAt":"2026-02-31T00:00:00.000Z"}',
      '{"status":"PENDING","reviewedAt":0}',
      '[{"status":"PENDING","reviewedAt":null}]',
      "not-json",
      JSON.stringify({ status: "PENDING", reviewedAt: null, padding: "x".repeat(4_096) }),
    ];
    for (const value of invalid) {
      expect(() => parseKycStatusResponse(value)).toThrow("KYC status response is invalid");
    }
  });

  it("allows only a current verified same-origin SANDBOX or TEST session", () => {
    expect(kycStatusSessionReadAllowed(session(), runtime(), now)).toBe(true);
    expect(kycStatusSessionReadAllowed(session("TEST"), runtime("TEST"), now)).toBe(true);

    expect(kycStatusSessionReadAllowed(null, runtime(), now)).toBe(false);
    expect(kycStatusSessionReadAllowed(session("TEST"), runtime("SANDBOX"), now)).toBe(false);
    expect(kycStatusSessionReadAllowed(session("LOCAL"), runtime("LOCAL"), now)).toBe(false);
    expect(kycStatusSessionReadAllowed(session("UAT"), runtime("UAT"), now)).toBe(false);
    expect(kycStatusSessionReadAllowed(session("PRODUCTION"), runtime("PRODUCTION"), now)).toBe(
      false,
    );
    expect(
      kycStatusSessionReadAllowed(session(), runtime("SANDBOX", { apiUrl: "https://api" }), now),
    ).toBe(false);
    expect(
      kycStatusSessionReadAllowed(session(), runtime("SANDBOX", { error: "invalid" }), now),
    ).toBe(false);
    expect(kycStatusSessionReadAllowed(session("SANDBOX", { tenantId: "" }), runtime(), now)).toBe(
      false,
    );
    expect(
      kycStatusSessionReadAllowed(
        session("SANDBOX", { expiresAt: "2026-08-02T00:00:00.000Z" }),
        runtime(),
        now,
      ),
    ).toBe(false);
  });

  it("issues exactly one credentialed same-origin GET and never sends identity fields", async () => {
    const calls: Array<{ input: string | URL | Request; init?: RequestInit }> = [];
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ input, init });
      return new Response('{"status":"PENDING","reviewedAt":null}', { status: 200 });
    }) as typeof fetch;
    const controller = new AbortController();

    await expect(fetchKycStatus(session(), runtime(), controller.signal, fetcher)).resolves.toEqual(
      {
        status: "PENDING",
        reviewedAt: null,
      },
    );
    expect(calls).toHaveLength(1);
    expect(String(calls[0]?.input)).toBe("/api/v1/kyc/status");
    expect(calls[0]?.init).toMatchObject({
      method: "GET",
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    expect(JSON.stringify(calls[0]?.init)).not.toMatch(/actor|tenant|customer|provider/i);
  });

  it("does not parse or expose an HTTP error body", async () => {
    const fetcher = (async () =>
      new Response('{"message":"provider-secret"}', { status: 503 })) as unknown as typeof fetch;
    await expect(
      fetchKycStatus(session(), runtime(), new AbortController().signal, fetcher),
    ).rejects.toMatchObject({ message: "KYC status is unavailable", status: 503 });
  });
});
