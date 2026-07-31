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
import { useMemo, useRef, useState } from "react";
import { backendApi } from "@/lib/backend-api";
import { useBackendSession } from "@/lib/backend-session";
import { useLang } from "@/lib/i18n";
import { useCardListPages } from "@/hooks/use-card-list-pages";
import { useCardBalance } from "@/hooks/use-card-balance";
import { useCardLimits } from "@/hooks/use-card-limits";
import {
  acceptsCardActionResponse,
  beginCardAction,
  cardActionAllowed,
  cardActionScopeKey,
  cardSessionScopeKey,
  createCardActionGate,
  syncCardActionScope,
  visibleCardActionState,
  type CardAction,
  type CardActionUiState,
} from "@/lib/card-action-state";

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
  const current = useMemo(
    () => cards.find((card) => card.cardId === activeId) ?? cards[0],
    [cards, activeId],
  );
  const cardBalance = useCardBalance(session, current?.cardId ?? null);
  const cardLimits = useCardLimits(session, current?.cardId ?? null);
  const sessionKey = cardSessionScopeKey(session);
  const actionScopeKey = cardActionScopeKey(sessionKey, current?.cardId ?? null);
  const actionGate = useRef(createCardActionGate(actionScopeKey));
  syncCardActionScope(actionGate.current, actionScopeKey);
  const [storedActionState, setActionState] = useState<CardActionUiState>({
    scopeKey: actionScopeKey,
    busy: false,
    error: null,
  });
  const actionState = visibleCardActionState(storedActionState, actionScopeKey);
  const busy = actionState.busy;
  const error = listError ?? (scopeReady ? actionState.error : null);
  const issueScopeReady = scopeReady && !loading && !loadingMore;

  const startAction = (action: CardAction) => {
    if (!actionScopeKey) return null;
    const ticket = beginCardAction(actionGate.current, actionScopeKey, action);
    setActionState({ scopeKey: actionScopeKey, busy: true, error: null });
    return ticket;
  };

  const finishAction = (scopeKey: string) => {
    setActionState((state) => (state.scopeKey === scopeKey ? { ...state, busy: false } : state));
  };

  const refreshCurrent = async () => {
    if (!cardActionAllowed("refresh", scopeReady, sessionKey, current)) return;
    const ticket = startAction("refresh");
    if (!ticket || !actionScopeKey) return;
    const scopeKey = actionScopeKey;
    try {
      const card = await backendApi.getCard(current.cardId);
      if (acceptsCardActionResponse(actionGate.current, ticket, scopeKey)) replaceCard(card);
    } catch (reason) {
      if (acceptsCardActionResponse(actionGate.current, ticket, scopeKey))
        invalidate(reason instanceof Error ? reason.message : "Railway Backend is unavailable");
    } finally {
      if (acceptsCardActionResponse(actionGate.current, ticket, scopeKey)) finishAction(scopeKey);
    }
  };

  const toggleFrozen = async () => {
    if (!current) return;
    const frozen = current.status === "frozen";
    const action: CardAction = frozen ? "unfreeze" : "freeze";
    if (!cardActionAllowed(action, scopeReady, sessionKey, current)) {
      setActionState({
        scopeKey: actionScopeKey,
        busy: false,
        error: "This card operation is unavailable in the current Backend/provider state.",
      });
      return;
    }
    const ticket = startAction(action);
    if (!ticket || !actionScopeKey) return;
    const scopeKey = actionScopeKey;
    try {
      const card = await backendApi.setFrozen(current.cardId, !frozen);
      if (acceptsCardActionResponse(actionGate.current, ticket, scopeKey)) replaceCard(card);
    } catch (reason) {
      if (acceptsCardActionResponse(actionGate.current, ticket, scopeKey))
        invalidate(reason instanceof Error ? reason.message : "Railway Backend is unavailable");
    } finally {
      if (acceptsCardActionResponse(actionGate.current, ticket, scopeKey)) finishAction(scopeKey);
    }
  };

  const issueVirtual = async () => {
    if (!cardActionAllowed("issue", issueScopeReady, sessionKey, current)) return;
    const ticket = startAction("issue");
    if (!ticket || !actionScopeKey) return;
    const scopeKey = actionScopeKey;
    try {
      const card = await backendApi.createVirtualCard({
        currency: "USD",
        alias: t("cards.defaultVirtualAlias"),
      });
      if (acceptsCardActionResponse(actionGate.current, ticket, scopeKey)) prependCard(card);
    } catch (reason) {
      if (acceptsCardActionResponse(actionGate.current, ticket, scopeKey))
        setActionState({
          scopeKey,
          busy: true,
          error: reason instanceof Error ? reason.message : "Railway Backend is unavailable",
        });
    } finally {
      if (acceptsCardActionResponse(actionGate.current, ticket, scopeKey)) finishAction(scopeKey);
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
            disabled={busy || !cardActionAllowed("issue", issueScopeReady, sessionKey, current)}
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
                      Session scope
                    </p>
                    <p className="max-w-40 truncate text-xs font-semibold">Authenticated</p>
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

            <div className="mt-4">
              {cardBalance.loading && (
                <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-surface/60 p-4 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading selected Card
                  balance
                </div>
              )}
              {!cardBalance.loading && cardBalance.error && (
                <div className="flex gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{cardBalance.error} · No stale Card balance displayed.</span>
                </div>
              )}
              {!cardBalance.loading && !cardBalance.error && cardBalance.balance && (
                <CardBalancePanel balance={cardBalance.balance} />
              )}
              <div className="mt-3">
                {cardLimits.loading && (
                  <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-surface/60 p-4 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading selected Card
                    limits
                  </div>
                )}
                {!cardLimits.loading && cardLimits.error && (
                  <div className="flex gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{cardLimits.error} · No stale Card limits displayed.</span>
                  </div>
                )}
                {!cardLimits.loading && !cardLimits.error && cardLimits.limits && (
                  <CardLimitsPanel limits={cardLimits.limits} />
                )}
              </div>
              <div className="mt-3">
                <Metric label="Status" value={current.status.toUpperCase()} />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <CardAction
                onClick={() => void toggleFrozen()}
                disabled={
                  busy ||
                  !cardActionAllowed(
                    current.status === "frozen" ? "unfreeze" : "freeze",
                    scopeReady,
                    sessionKey,
                    current,
                  )
                }
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

function CardBalancePanel({
  balance,
}: {
  balance: NonNullable<ReturnType<typeof useCardBalance>["balance"]>;
}) {
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        Live Card balance · minor units
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <BalanceMetric
          label="Available"
          value={balance.availableBalanceMinor}
          currency={balance.currency}
        />
        <BalanceMetric
          label="Current"
          value={balance.currentBalanceMinor}
          currency={balance.currency}
        />
        <BalanceMetric
          label="Pending"
          value={balance.pendingAmountMinor}
          currency={balance.currency}
        />
      </div>
      <p className="mt-3 text-[10px] text-muted-foreground">
        Updated {new Date(balance.updatedAt).toLocaleString()}
      </p>
    </div>
  );
}

function BalanceMetric({
  label,
  value,
  currency,
}: {
  label: string;
  value: string;
  currency: string;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-background/50 p-3">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p translate="no" className="mt-1 truncate text-xs font-bold tabular-nums">
        {value} {currency}
      </p>
    </div>
  );
}

function CardLimitsPanel({
  limits,
}: {
  limits: NonNullable<ReturnType<typeof useCardLimits>["limits"]>;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-surface/60 p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        Card limits · read only · minor units
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <LimitMetric label="Single transaction" value={limits.singleTransactionMinor} />
        <LimitMetric label="Daily spend" value={limits.dailySpendMinor} />
        <LimitMetric label="Monthly spend" value={limits.monthlySpendMinor} />
        <LimitMetric label="Daily ATM" value={limits.dailyAtmMinor} />
      </div>
      <p className="mt-3 text-[10px] text-muted-foreground">
        {limits.updatedAt
          ? `Updated ${new Date(limits.updatedAt).toLocaleString()}`
          : "Not updated"}
      </p>
    </div>
  );
}

function LimitMetric({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0 rounded-xl bg-background/50 p-3">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p translate="no" className="mt-1 truncate text-xs font-bold tabular-nums">
        {value ?? "Not set"}
      </p>
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
