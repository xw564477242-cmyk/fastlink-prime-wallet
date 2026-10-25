import { afterEach, expect, it, mock } from "bun:test";
import { createElement, type ReactNode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
process.env.VITE_FASTLINK_PREVIEW_MODE = "READ_ONLY";
process.env.VITE_FASTLINK_PREVIEW_SCOPE = "WALLET_ONLY";
process.env.VITE_FASTLINK_PRODUCT_MODE = "READ_ONLY_PREVIEW";
process.env.VITE_FASTLINK_CANDIDATE_ID = "FL-LAUNCH-B13-20261017";
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
let current = {
  actorId: "A",
  tenantId: "tenant_A",
  customerId: "A",
  environment: "TEST",
  expiresAt: "2099-01-01T00:00:00Z",
};
mock.module("../lib/backend-session", () => ({
  useBackendSession: () => ({ session: current, invalidate: () => {}, disconnect: async () => {} }),
}));
mock.module("./MobileShell", () => ({
  MobileShell: ({ children }: { children: ReactNode }) => children,
  StatusBar: () => null,
}));
const { LaunchReadOnlyCards } = await import("./LaunchReadOnlyCards");
const originalFetch = globalThis.fetch;
let tree: ReactTestRenderer | null = null;
const calls: string[] = [];
let answer: (url: string) => Promise<Response>;
const card = (id: string) => ({
  id,
  type: "VIRTUAL",
  status: "PENDING",
  last4: "0000",
  expiryMonth: 12,
  expiryYear: 2030,
  currency: "USD",
  alias: id,
});
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
async function mount(id?: string) {
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    calls.push(String(url));
    return answer(String(url));
  }) as typeof fetch;
  await act(async () => {
    tree = create(<LaunchReadOnlyCards requestedCardId={id} />);
    await tick();
  });
  await act(async () => {
    await tick();
  });
}
afterEach(async () => {
  if (tree) await act(async () => tree!.unmount());
  tree = null;
  globalThis.fetch = originalFetch;
  calls.length = 0;
  current = { ...current, actorId: "A", tenantId: "tenant_A", customerId: "A" };
});
it("loads independent base details without balance or Provider requests", async () => {
  answer = async (url) =>
    Response.json(
      url.includes("?limit=") ? { cards: [card("card_A")], nextCursor: null } : card("card_A"),
    );
  await mount();
  expect(calls).toContain("/api/v1/cards/card_A");
  expect(calls.every((url) => /^\/api\/v1\/cards(?:\?limit=\d+|\/card_A)$/.test(url))).toBe(true);
  expect(JSON.stringify(tree!.toJSON())).toContain("独立基础详情请求");
});
it("shows a safe denial for a foreign selection without falling back to an own-card detail", async () => {
  answer = async (url) =>
    url.includes("?limit=")
      ? Response.json({ cards: [card("card_A")], nextCursor: null })
      : Response.json(
          { message: "never-expose-other-tenant" },
          { status: 404, headers: { "x-trace-id": "detail-denied-test" } },
        );
  await mount("card_B");
  const rendered = JSON.stringify(tree!.toJSON());
  expect(calls).toContain("/api/v1/cards/card_B");
  expect(rendered).not.toContain("never-expose-other-tenant");
  expect(
    tree!.root.findAll(
      (node) => node.type === "section" && node.props["aria-label"] === "卡状态详情",
    ),
  ).toHaveLength(0);
});
it("discards a late A detail after switching to B", async () => {
  let finishA: (response: Response) => void = () => {};
  answer = async (url) =>
    url.includes("?limit=")
      ? Response.json({ cards: [card("card_" + current.actorId)], nextCursor: null })
      : url.endsWith("card_A")
        ? new Promise<Response>((resolve) => {
            finishA = resolve;
          })
        : Response.json(card("card_B"));
  await mount();
  current = { ...current, actorId: "B", tenantId: "tenant_B", customerId: "B" };
  await act(async () => {
    tree!.update(createElement(LaunchReadOnlyCards));
    await tick();
  });
  await act(async () => {
    await tick();
    finishA(Response.json(card("card_A")));
    await tick();
  });
  const rendered = JSON.stringify(tree!.toJSON());
  expect(rendered).toContain("card_B");
  expect(rendered).not.toContain("card_A");
});
