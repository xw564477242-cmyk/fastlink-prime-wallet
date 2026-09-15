import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { backendRuntime } from "@/lib/backend-api";
import { useBackendSession } from "@/lib/backend-session";
import { backendSessionIntrinsicInvalidationReason } from "@/lib/backend-session-policy";
import { PublicErrorQueue } from "@/lib/public-errors";
import { PublicErrorProvider } from "./PublicErrorProvider";

export function FrontendScope({ children }: { children: ReactNode }) {
  const { session, checking, invalidate } = useBackendSession();
  const latest = useRef({ session, checking });
  latest.current = { session, checking };
  const generation = useRef(0);
  const scope = useMemo(() => {
    const id = JSON.stringify([backendRuntime.environment, ++generation.current]);
    const valid = () =>
      !checking &&
      latest.current.session === session &&
      !latest.current.checking &&
      !!session &&
      !backendRuntime.error &&
      !backendSessionIntrinsicInvalidationReason(session, backendRuntime.environment);
    return {
      id,
      client: new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      }),
      queue: new PublicErrorQueue(id, valid, (reason) => {
        if (session && valid()) invalidate(session, reason);
      }),
    };
  }, [session, checking, invalidate]);
  useEffect(
    () => () => {
      scope.queue.clear();
      void scope.client.cancelQueries();
      scope.client.clear();
    },
    [scope],
  );
  return (
    <QueryClientProvider client={scope.client}>
      <PublicErrorProvider key={scope.id} queue={scope.queue}>
        {children}
      </PublicErrorProvider>
    </QueryClientProvider>
  );
}
