import { afterEach, expect, it } from "bun:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { BackendSessionProvider, useBackendSession } from "@/lib/backend-session";
import { backendRuntime, type BackendSession } from "@/lib/backend-api";
import { FrontendScope } from "./FrontendScope";
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
let renderer: ReactTestRenderer;
const originalFetch = globalThis.fetch;
let context: ReturnType<typeof useBackendSession>;
let client: QueryClient;
function Probe() {
  context = useBackendSession();
  client = useQueryClient();
  return null;
}
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  globalThis.fetch = originalFetch;
});
it("replaces Query cache on session generation change; late old reads cannot populate the new cache", async () => {
  const session: BackendSession = {
    actorId: "actor-test",
    customerId: "customer-test",
    tenantId: "tenant-test",
    environment: backendRuntime.environment!,
    expiresAt: "2100-01-01T00:00:00.000Z",
  };
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(session), { status: 200 })) as unknown as typeof fetch;
  await act(async () => {
    renderer = create(
      <BackendSessionProvider>
        <FrontendScope>
          <Probe />
        </FrontendScope>
      </BackendSessionProvider>,
    );
  });
  expect(context.session?.actorId).toBe(session.actorId);
  const old = client;
  old.setQueryData(["protected"], "old-session-value");
  let finish!: (value: string) => void;
  const late = old
    .fetchQuery({
      queryKey: ["late"],
      queryFn: () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    })
    .catch(() => {});
  await act(async () => {
    await context.refresh();
  });
  expect(client).not.toBe(old);
  expect(client.getQueryData(["protected"])).toBeUndefined();
  finish("stale");
  await late;
  expect(client.getQueryData(["late"])).toBeUndefined();
  expect(old.getQueryCache().getAll()).toHaveLength(0);
  await act(async () => context.invalidate(context.session!, "EXPLICIT_401"));
  expect(context.session).toBeNull();
  expect(client.getQueryData(["protected"])).toBeUndefined();
});
