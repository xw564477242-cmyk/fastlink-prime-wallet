import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import {
  AlertTriangle,
  Copy,
  CreditCard,
  Loader2,
  Plus,
  RefreshCw,
  Snowflake,
  Sun,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { backendApi } from "@/lib/backend-api";
import { useBackendSession } from "@/lib/backend-session";
import { useLang } from "@/lib/i18n";
import { useCardListPages } from "@/hooks/use-card-list-pages";

export const Route = createFileRoute("/cards")({
  validateSearch: (search: Record<string, unknown>): { cardId?: string } =>
    typeof search.cardId === "string" ? { cardId: search.cardId } : {},
  head: () => ({
    meta: [
      { title: "FastLink — Card Center" },
      { name: "description", content: "Cards returned by FastLink Railway Backend." },
    ],
  }),
  component: CardsPage,
});

function CardsPage() {
  const { t } = useLang();
  const { session } = useBackendSession();
  const navigate = useNavigate({ from: "/cards" });
  const { cardId } = Route.useSearch();
  const {
    cards,
    nextCursor,
    activeId,
    loading,
    loadingMore,
    scopeReady,
    error: listError,
    loadMore,
    selectCard,
    replaceCard,
    prependCard,
    invalidate,
  } = useCardListPages(session, cardId ?? null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const error = listError ?? (scopeReady ? actionError : null);
  const actionScopeKey = session
    ? JSON.stringify([session.actorId, session.tenantId, session.customerId, session.environment])
    : null;
  const actionScopeRef = useRef(actionScopeKey);
  actionScopeRef.current = actionScopeKey;
  const actionScopeIsCurrent = (key: string | null) => actionScopeRef.current === key;

  useEffect(() => {
    setActionError(null);
    setBusy(false);
  }, [session]);

  const current = useMemo(
    () => cards.find((card) => card.cardId === activeId) ?? cards[0],
    [cards, activeId],
  );

  const refreshCurrent = async () => {
    if (!scopeReady || !current) return;
    const scopeKey = actionScopeKey;
    setBusy(true);
    setActionError(null);
    try {
      const card = await backendApi.getCard(current.cardId);
      if (actionScopeIsCurrent(scopeKey)) replaceCard(card);
    } catch (reason) {
      if (actionScopeIsCurrent(scopeKey))
        invalidate(reason instanceof Error ? reason.message : "Railway Backend is unavailable");
    } finally {
      if (actionScopeIsCurrent(scopeKey)) setBusy(false);
    }
  };

  const toggleFrozen = async () => {
    if (!scopeReady || !current) return;
    const scopeKey = actionScopeKey;
    const frozen = current.status === "frozen";
    const allowed = frozen ? current.capabilities.unfreeze : current.capabilities.freeze;
    if (!allowed) {
      setActionError("This card operation is unavailable in the current Backend/provider state.");
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const card = await backendApi.setFrozen(current.cardId, !frozen);
      if (actionScopeIsCurrent(scopeKey)) replaceCard(card);
    } catch (reason) {
      if (actionScopeIsCurrent(scopeKey))
        invalidate(reason instanceof Error ? reason.message : "Railway Backend is unavailable");
    } finally {
      if (actionScopeIsCurrent(scopeKey)) setBusy(false);
    }
  };

  const issueVirtual = async () => {
    if (!scopeReady) return;
    const scopeKey = actionScopeKey;
    setBusy(true);
    setActionError(null);
    try {
      const card = await backendApi.createVirtualCard({
        currency: "USD",
        alias: t("cards.defaultVirtualAlias"),
      });
      if (actionScopeIsCurrent(scopeKey)) prependCard(card);
    } catch (reason) {
      if (actionScopeIsCurrent(scopeKey))
        setActionError(reason instanceof Error ? reason.message : "Railway Backend is unavailable");
    } finally {
      if (actionScopeIsCurrent(scopeKey)) setBusy(false);
    }
  };

  return (
    <MobileShell>
      <StatusBar title={t("page.cards")} />
      <div className="px-6 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Railway Backend
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold">{t("cards.myCards")}</h1>
          </div>
          <button
            onClick={() => void issueVirtual()}
            disabled={busy || !scopeReady}
            className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" /> {t("cards.issueNew")}
          </button>
        </div>

        {error && (
          <div className="mt-4 flex gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {error}
              {cards.length === 0
                ? " · No stale card data displayed."
                : " · Loaded cards remain scoped to the current session."}
            </span>
          </div>
        )}

        {loading && (
          <div className="grid h-[50vh] place-items-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {!loading && !error && cards.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-border/60 p-8 text-center">
            <CreditCard className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No cards returned by Railway Backend.
            </p>
          </div>
        )}

        {!loading && current && (
          <>
            <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
              {cards.map((card) => (
                <button
                  key={card.cardId}
                  onClick={() => {
                    selectCard(card.cardId);
                    void navigate({ search: { cardId: card.cardId }, replace: true });
                  }}
                  className={`shrink-0 rounded-2xl border px-4 py-3 text-left ${
                    card.cardId === current.cardId
                      ? "border-primary bg-primary/10"
                      : "border-border/60 bg-surface/60"
                  }`}
                >
                  <p className="text-xs font-semibold">{card.alias ?? card.type}</p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    •••• {card.last4 || "Unavailable"}
                  </p>
                </button>
              ))}
            </div>

            {nextCursor && (
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore || busy}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 bg-surface/60 py-3 text-xs font-semibold disabled:opacity-50"
              >
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                {loadingMore ? "Loading more cards…" : "Load more cards"}
              </button>
            )}

            <div className="relative mt-6 aspect-[1.586] overflow-hidden rounded-3xl bg-gradient-visa p-6 shadow-card">
              {current.status === "frozen" && (
                <div className="absolute inset-0 z-10 grid place-items-center bg-background/60 backdrop-blur-md">
                  <div className="text-center">
                    <Snowflake className="mx-auto h-8 w-8 text-primary" />
                    <p className="mt-2 text-sm font-semibold">{t("cards.frozen")}</p>
                  </div>
                </div>
              )}
              <div className="relative text-white">
                <p className="text-[10px] uppercase tracking-widest text-white/60">
                  FastLink · {current.type}
                </p>
                <p className="mt-1 text-xs font-semibold">{current.alias ?? "FastLink Card"}</p>
                <p className="mt-8 font-mono text-xl font-semibold tracking-[0.35em]">
                  •••• •••• •••• {current.last4 || "••••"}
                </p>
                <div className="mt-6 flex items-end justify-between">
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-white/60">
                      Backend user
                    </p>
                    <p className="max-w-40 truncate text-xs font-semibold">
                      {session?.actorId ?? "Unavailable"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-white/60">
                      {t("cards.expiry")}
                    </p>
                    <p className="text-xs font-semibold">{current.expiry}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric
                label={t("cards.cardBalance")}
                value={`${current.balance.toFixed(2)} ${current.currency}`}
              />
              <Metric label="Status" value={current.status.toUpperCase()} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <CardAction
                onClick={() => void toggleFrozen()}
                disabled={busy}
                label={current.status === "frozen" ? t("cards.unfreeze") : t("cards.freeze")}
                icon={
                  current.status === "frozen" ? (
                    <Sun className="h-5 w-5" />
                  ) : (
                    <Snowflake className="h-5 w-5" />
                  )
                }
              />
              <CardAction
                onClick={() => void refreshCurrent()}
                disabled={busy}
                label={t("cards.refresh")}
                icon={<RefreshCw className="h-5 w-5" />}
              />
            </div>

            <div className="mt-4 rounded-2xl border border-border/60 bg-surface/60 p-5">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {t("cards.details")}
              </p>
              <div className="mt-3 divide-y divide-border">
                <Detail
                  label={t("cards.number")}
                  value={`•••• ${current.last4 || "Unavailable"}`}
                />
                <Detail label={t("cards.expiry")} value={current.expiry} />
                <Detail label={t("cards.pin")} value="Unavailable" />
                <Detail label={t("cards.cvv")} value="Unavailable" />
              </div>
              <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">
                PIN, CVV, physical-card application, and card funding are disabled because the
                Railway Backend end-user API does not expose those contracts.
              </p>
            </div>
          </>
        )}
      </div>
    </MobileShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-surface/60 p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-base font-bold tabular-nums">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm">{value}</span>
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    </div>
  );
}

function CardAction({
  onClick,
  label,
  icon,
  disabled,
}: {
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-surface/60 py-3 text-xs font-semibold disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  );
}
