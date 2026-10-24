import { afterAll, afterEach, expect, it, mock } from "bun:test";
import { createElement, type ReactNode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
const originalPreviewMode = process.env.VITE_FASTLINK_PREVIEW_MODE;
const originalProductMode = process.env.VITE_FASTLINK_PRODUCT_MODE;
const originalCandidateId = process.env.VITE_FASTLINK_CANDIDATE_ID;
process.env.VITE_FASTLINK_PREVIEW_MODE = "READ_ONLY";
process.env.VITE_FASTLINK_PRODUCT_MODE = "READ_ONLY_PREVIEW";
process.env.VITE_FASTLINK_CANDIDATE_ID = "FL-LAUNCH-B13-20261017";
const { backendApi } = await import("../lib/backend-api");
afterAll(() => {
  if (originalPreviewMode === undefined) delete process.env.VITE_FASTLINK_PREVIEW_MODE;
  else process.env.VITE_FASTLINK_PREVIEW_MODE = originalPreviewMode;
  if (originalProductMode === undefined) delete process.env.VITE_FASTLINK_PRODUCT_MODE;
  else process.env.VITE_FASTLINK_PRODUCT_MODE = originalProductMode;
  if (originalCandidateId === undefined) delete process.env.VITE_FASTLINK_CANDIDATE_ID;
  else process.env.VITE_FASTLINK_CANDIDATE_ID = originalCandidateId;
});
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
let session = {
  actorId: "actor-1",
  tenantId: "tenant-1",
  customerId: "customer-1",
  environment: "TEST",
  expiresAt: "2099-01-01T00:00:00.000Z",
};
const invalidations: unknown[] = [];
mock.module("../lib/backend-session", () => ({
  useBackendSession: () => ({
    session,
    invalidate: (...args: unknown[]) => invalidations.push(args),
  }),
}));
mock.module("./MobileShell", () => ({
  MobileShell: ({ children }: { children: ReactNode }) => children,
  StatusBar: () => null,
}));
const { LaunchReadOnlyCards } = await import("./LaunchReadOnlyCards");
let tree: ReactTestRenderer | null = null;
const requests: Array<{ url: string; method: string }> = [];
const originalFetch = globalThis.fetch;
let respond: (url: string) => Promise<Response>;
const card = {
  id: "card-1",
  type: "VIRTUAL",
  status: "ACTIVE",
  last4: "4242",
  expiryMonth: 12,
  expiryYear: 2030,
  currency: "USD",
  alias: "Existing card",
  availableBalanceMinor: "1000",
  capabilities: { freeze: true, unfreeze: false, replace: true, renew: true, updateLimits: true },
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const render = async () => {
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(url), method: init?.method ?? "GET" });
    return respond(String(url));
  }) as typeof fetch;
  await act(async () => {
    tree = create(createElement(LaunchReadOnlyCards));
    await flush();
  });
};
const click = async (text: string) => {
  const button = tree!.root.findAllByType("button").find((b) => b.children.join("").includes(text));
  expect(button).toBeDefined();
  await act(async () => {
    button!.props.onClick();
    await flush();
  });
};
afterEach(async () => {
  if (tree) await act(async () => tree!.unmount());
  tree = null;
  globalThis.fetch = originalFetch;
  requests.length = 0;
  invalidations.length = 0;
  session = {
    actorId: "actor-1",
    tenantId: "tenant-1",
    customerId: "customer-1",
    environment: "TEST",
    expiresAt: "2099-01-01T00:00:00.000Z",
  };
});
it("renders existing Card status then honest empty refresh without mutation/Provider calls", async () => {
  respond = async () => Response.json({ cards: [card], nextCursor: null });
  await render();
  expect(JSON.stringify(tree!.toJSON())).toContain("Existing card");
  expect(
    tree!.root
      .findAllByType("button")
      .map((b) => b.children.join(""))
      .join("|"),
  ).not.toContain("冻结");
  respond = async () => Response.json({ cards: [], nextCursor: null });
  await click("刷新卡列表");
  expect(JSON.stringify(tree!.toJSON())).toContain("暂无卡片");
  expect(JSON.stringify(tree!.toJSON())).not.toContain("Existing card");
  expect(
    requests.every((r) => r.method === "GET" && r.url.startsWith("/api/v1/cards?limit=")),
  ).toBe(true);
});
it("turns a safe failure into a reusable Trace reference, not raw server secrets", async () => {
  respond = async () =>
    Response.json(
      { message: "provider-secret" },
      { status: 503, headers: { "x-trace-id": "trace-123456" } },
    );
  await render();
  const text = JSON.stringify(tree!.toJSON());
  expect(text).toContain("trace-123456");
  expect(text).not.toContain("provider-secret");
  expect(text).toContain("复制客服参考");
});
it("invalidates only the expected session on 401", async () => {
  respond = async () => Response.json({}, { status: 401 });
  await render();
  expect(invalidations.length).toBe(1);
});
it("does not fetch a Card write even when historical API entry points are called", async () => {
  globalThis.fetch = (async () => {
    throw new Error("unexpected network");
  }) as unknown as typeof fetch;
  await expect(
    backendApi.register({
      tenantId: "tenant-1",
      email: "synthetic@example.invalid",
      password: "synthetic",
    }),
  ).rejects.toThrow("只读");
});
it("discards a late previous-tenant page after the authenticated scope switches", async () => {
  let resolveOld: (value: Response) => void = () => {};
  let first = true;
  respond = async () => {
    if (first) {
      first = false;
      return new Promise<Response>((resolve) => {
        resolveOld = resolve;
      });
    }
    return Response.json({ cards: [], nextCursor: null });
  };
  await render();
  session = { ...session, actorId: "actor-2", tenantId: "tenant-2", customerId: "customer-2" };
  await act(async () => {
    tree!.update(createElement(LaunchReadOnlyCards));
    await flush();
  });
  await act(async () => {
    resolveOld(Response.json({ cards: [card], nextCursor: null }));
    await flush();
  });
  expect(JSON.stringify(tree!.toJSON())).not.toContain("Existing card");
  expect(JSON.stringify(tree!.toJSON())).toContain("暂无卡片");
});
it("clears a successful old snapshot on explicit refresh failure and exposes safe Trace", async () => {
  respond = async () => Response.json({ cards: [card], nextCursor: null });
  await render();
  respond = async () =>
    Response.json(
      { message: "never-render-raw" },
      { status: 503, headers: { "x-trace-id": "trace-refresh-123" } },
    );
  await click("刷新卡列表");
  const text = JSON.stringify(tree!.toJSON());
  expect(text).not.toContain("Existing card");
  expect(text).toContain("trace-refresh-123");
  expect(text).not.toContain("never-render-raw");
});
