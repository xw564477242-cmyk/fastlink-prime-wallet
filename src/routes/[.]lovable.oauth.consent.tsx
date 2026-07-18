import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type OAuthNs = {
  getAuthorizationDetails: (id: string) => Promise<{
    data?: { client?: { name?: string }; redirect_url?: string; redirect_to?: string } | null;
    error?: { message?: string } | null;
  }>;
  approveAuthorization: (id: string) => Promise<{
    data?: { redirect_url?: string; redirect_to?: string } | null;
    error?: { message?: string } | null;
  }>;
  denyAuthorization: (id: string) => Promise<{
    data?: { redirect_url?: string; redirect_to?: string } | null;
    error?: { message?: string } | null;
  }>;
};

function oauthNs(): OAuthNs {
  return (supabase.auth as unknown as { oauth: OAuthNs }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } as never });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthNs().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message ?? "Failed to load authorization");
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate } as never);
    return data ?? null;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-md p-6 text-sm text-muted-foreground">
      Could not load this authorization request: {String((error as Error)?.message ?? error)}
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const call = approve ? oauthNs().approveAuthorization : oauthNs().denyAuthorization;
    const { data, error } = await call(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message ?? "Authorization failed");
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "an app";

  return (
    <main className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="font-display text-xl font-bold">Connect {clientName} to your FastLink account</h1>
      <p className="text-sm text-muted-foreground">
        This will let {clientName} use FastLink tools on your behalf, including reading balances,
        pricing conversions and listing your cards.
      </p>
      {error && (
        <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button
          disabled={busy}
          onClick={() => decide(true)}
          className="flex-1 rounded-2xl bg-gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
        >
          Approve
        </button>
        <button
          disabled={busy}
          onClick={() => decide(false)}
          className="flex-1 rounded-2xl border border-border/60 bg-surface py-3 text-sm font-semibold disabled:opacity-60"
        >
          Deny
        </button>
      </div>
    </main>
  );
}
