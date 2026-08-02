import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import {
  AlertTriangle,
  CalendarClock,
  Copy,
  CreditCard,
  History,
  Loader2,
  Plus,
  RefreshCw,
  Repeat2,
  SlidersHorizontal,
  Snowflake,
  Sun,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  CARD_LIMIT_FIELDS,
  backendApi,
  type CardLimitField,
  type CardReplacementReason,
  type WalletCardLimits,
} from "@/lib/backend-api";
import { useBackendSession } from "@/lib/backend-session";
import { useLang } from "@/lib/i18n";
import { useCardListPages } from "@/hooks/use-card-list-pages";
import { useCardBalance } from "@/hooks/use-card-balance";
import { useCardLimits } from "@/hooks/use-card-limits";
import { useCardTimelinePages } from "@/hooks/use-card-timeline-pages";
import { useCardLimitsMutation } from "@/hooks/use-card-limits-mutation";
import { useCardStatusMutation } from "@/hooks/use-card-status-mutation";
import { useCardActivation } from "@/hooks/use-card-activation";
import { useVirtualCardCreate } from "@/hooks/use-virtual-card-create";
import { useCardRenew } from "@/hooks/use-card-renew";
import { useCardReplace } from "@/hooks/use-card-replace";
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

const emptyLimitDraft = (): Record<CardLimitField, string> => ({
  singleTransactionMinor: "",
  dailySpendMinor: "",
  monthlySpendMinor: "",
  dailyAtmMinor: "",
});

function draftFromLimits(limits: WalletCardLimits | null): Record<CardLimitField, string> {
  if (!limits) return emptyLimitDraft();
  return {
    singleTransactionMinor: limits.singleTransactionMinor ?? "",
    dailySpendMinor: limits.dailySpendMinor ?? "",
    monthlySpendMinor: limits.monthlySpendMinor ?? "",
    dailyAtmMinor: limits.dailyAtmMinor ?? "",
  };
}

export function CardsPage() {
  const { t } = useLang();
  const { session, invalidate: invalidateSession } = useBackendSession();
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
    refreshCards,
    selectCard,
    replaceCard,
    replaceSelectedCard,
    invalidate,
  } = useCardListPages(session, cardId ?? null);
  const defaultVirtualAlias = t("cards.defaultVirtualAlias");
  const virtualCardInput = useMemo(
    () => ({ currency: "USD", alias: defaultVirtualAlias }),
    [defaultVirtualAlias],
  );
  const acceptCreatedCard = useCallback(
    async (card: Parameters<typeof replaceCard>[0], isCurrent: () => boolean) => {
      if (cards.some((existing) => existing.cardId === card.cardId)) return false;
      const confirmed = await refreshCards(card, isCurrent);
      if (!confirmed || !isCurrent()) return false;
      void navigate({ search: { cardId: card.cardId }, replace: true });
      return true;
    },
    [cards, navigate, refreshCards],
  );
  const virtualCardCreate = useVirtualCardCreate(session, virtualCardInput, acceptCreatedCard);
  const current = useMemo(
    () => cards.find((card) => card.cardId === activeId) ?? cards[0],
    [cards, activeId],
  );
  const acceptRenewedCard = useCallback(
    (card: Parameters<typeof replaceCard>[0]) => {
      replaceCard(card);
      selectCard(card.cardId);
      void navigate({ search: { cardId: card.cardId }, replace: true });
    },
    [navigate, replaceCard, selectCard],
  );
  const cardRenew = useCardRenew(session, current, acceptRenewedCard);
  const [replacementReason, setReplacementReason] = useState<CardReplacementReason>("LOST");
  const acceptReplacementCard = useCallback(
    (oldCardId: string, card: Parameters<typeof replaceSelectedCard>[1]) => {
      if (!replaceSelectedCard(oldCardId, card)) return false;
      void navigate({ search: { cardId: card.cardId }, replace: true });
      return true;
    },
    [navigate, replaceSelectedCard],
  );
  const cardReplace = useCardReplace(session, current, replacementReason, acceptReplacementCard);
  const [cardDataGeneration, refreshCardData] = useReducer((value: number) => value + 1, 0);
  const cardBalance = useCardBalance(session, current?.cardId ?? null, cardDataGeneration);
  const cardLimits = useCardLimits(session, current?.cardId ?? null, cardDataGeneration);
  const cardTimeline = useCardTimelinePages(
    session,
    current?.cardId ?? null,
    invalidateSession,
    cardDataGeneration,
  );
  const [limitDraft, setLimitDraft] = useState<Record<CardLimitField, string>>(emptyLimitDraft);
  useEffect(() => {
    setLimitDraft(draftFromLimits(cardLimits.limits));
  }, [cardLimits.limits]);
  const cardLimitsInput = useMemo(
    () =>
      Object.fromEntries(
        CARD_LIMIT_FIELDS.filter((field) => limitDraft[field] !== "").map((field) => {
          const value = limitDraft[field];
          return [field, /^(?:0|[1-9]\d*)$/.test(value) ? Number(value) : value];
        }),
      ),
    [limitDraft],
  );
  const cardLimitsMutation = useCardLimitsMutation(
    session,
    current,
    cardLimits.limits,
    cardLimitsInput,
    cardLimits.replaceCurrentLimits,
    invalidateSession,
  );
  const cardStatusAction = current?.status === "frozen" ? "unfreeze" : "freeze";
  const acceptStatusUpdate = useCallback(
    async (
      card: Parameters<typeof replaceCard>[0],
      isCurrent: () => boolean,
      signal: AbortSignal,
    ) => {
      const confirmed = await refreshCards(card, isCurrent, signal, "EXACT_GENERATION");
      if (!confirmed) return false;
      refreshCardData();
      return true;
    },
    [refreshCards],
  );
  const invalidateUnconfirmedStatus = useCallback(() => {
    invalidate("Card status could not be confirmed. Refresh Cards before continuing.");
    refreshCardData();
  }, [invalidate]);
  const cardStatusMutation = useCardStatusMutation(
    session,
    current,
    cardStatusAction,
    acceptStatusUpdate,
    invalidateUnconfirmedStatus,
    invalidateSession,
  );
  const acceptActivatedCard = useCallback(
    async (
      card: Parameters<typeof replaceCard>[0],
      isCurrent: () => boolean,
      signal: AbortSignal,
    ) => {
      const confirmed = await refreshCards(card, isCurrent, signal, "EXACT_GENERATION");
      if (!confirmed) return false;
      refreshCardData();
      return true;
    },
    [refreshCards],
  );
  const cardActivation = useCardActivation(
    session,
    current,
    acceptActivatedCard,
    invalidateSession,
  );
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
  const busy =
    actionState.busy ||
    virtualCardCreate.busy ||
    cardRenew.busy ||
    cardReplace.busy ||
    cardLimitsMutation.busy ||
    cardStatusMutation.busy ||
    cardActivation.busy;
  const error =
    listError ??
    (scopeReady ? actionState.error : null) ??
    (virtualCardCreate.allowed ? virtualCardCreate.error : null) ??
    (cardRenew.allowed ? cardRenew.error : null) ??
    (cardReplace.allowed ? cardReplace.error : null) ??
    (cardLimitsMutation.allowed ? cardLimitsMutation.error : null) ??
    (cardStatusMutation.allowed ? cardStatusMutation.error : null) ??
    (cardActivation.allowed ? cardActivation.error : null);
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
    if (!scopeReady || !cardStatusMutation.canSubmit || busy) return;
    await cardStatusMutation.submit();
  };

  const activateCurrent = async () => {
    if (!scopeReady || !cardActivation.canSubmit || busy) return;
    await cardActivation.submit();
  };

  const issueVirtual = async () => {
    if (!issueScopeReady || !virtualCardCreate.allowed || busy) return;
    await virtualCardCreate.submit();
  };

  const renewCurrent = async () => {
    if (!scopeReady || !cardRenew.allowed || busy) return;
    await cardRenew.submit();
  };

  const replaceCurrent = async () => {
    if (!scopeReady || !cardReplace.allowed || busy) return;
    await cardReplace.submit();
  };

  const updateCurrentLimits = async () => {
    if (!scopeReady || !cardLimitsMutation.canSubmit || busy) return;
    await cardLimitsMutation.submit();
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
          {virtualCardCreate.allowed && (
            <button
              onClick={() => void issueVirtual()}
              disabled={busy || !issueScopeReady}
              className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" /> {t("cards.issueNew")}
            </button>
          )}
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
                  <>
                    <CardLimitsPanel limits={cardLimits.limits} />
                    {cardLimitsMutation.allowed && (
                      <CardLimitsEditor
                        values={limitDraft}
                        busy={busy}
                        canSubmit={cardLimitsMutation.canSubmit}
                        submitLabel={
                          cardLimitsMutation.conflictPending
                            ? "Refresh Card first"
                            : cardLimitsMutation.retryPending
                              ? "Retry limits"
                              : "Apply limits"
                        }
                        onChange={(field, value) =>
                          setLimitDraft((currentDraft) => ({
                            ...currentDraft,
                            [field]: value,
                          }))
                        }
                        onSubmit={() => void updateCurrentLimits()}
                      />
                    )}
                  </>
                )}
              </div>
              <div className="mt-3">
                <Metric label="Status" value={current.status.toUpperCase()} />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {current.status === "pending" && cardActivation.allowed && (
                <CardAction
                  onClick={() => void activateCurrent()}
                  disabled={busy || !cardActivation.canSubmit}
                  label={
                    cardActivation.conflictPending
                      ? "Refresh Card first"
                      : cardActivation.retryPending
                        ? "Retry activation"
                        : "Activate card"
                  }
                  icon={<Zap className="h-5 w-5" />}
                />
              )}
              <CardAction
                onClick={() => void toggleFrozen()}
                disabled={busy || !cardStatusMutation.canSubmit}
                label={
                  cardStatusMutation.conflictPending
                    ? "Refresh Card first"
                    : cardStatusMutation.retryPending
                      ? `Retry ${current.status === "frozen" ? t("cards.unfreeze") : t("cards.freeze")}`
                      : current.status === "frozen"
                        ? t("cards.unfreeze")
                        : t("cards.freeze")
                }
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
              {cardRenew.allowed && (
                <CardAction
                  onClick={() => void renewCurrent()}
                  disabled={busy}
                  label="Renew card"
                  icon={<CalendarClock className="h-5 w-5" />}
                />
              )}
              {cardReplace.allowed && (
                <CardAction
                  onClick={() => void replaceCurrent()}
                  disabled={busy}
                  label="Replace card"
                  icon={<Repeat2 className="h-5 w-5" />}
                />
              )}
            </div>

            {cardReplace.allowed && (
              <label className="mt-3 block rounded-2xl border border-border/60 bg-surface/60 p-4 text-xs">
                <span className="font-semibold">Replacement reason</span>
                <select
                  value={replacementReason}
                  onChange={(event) =>
                    setReplacementReason(event.target.value as CardReplacementReason)
                  }
                  disabled={busy}
                  className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
                >
                  <option value="LOST">Lost</option>
                  <option value="STOLEN">Stolen</option>
                  <option value="DAMAGED">Damaged</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
            )}

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

            <CardTimelinePanel
              timeline={cardTimeline}
              disabled={busy}
              onRefresh={() => cardTimeline.refresh()}
              onLoadMore={() => void cardTimeline.loadMore()}
            />
          </>
        )}
      </div>
    </MobileShell>
  );
}

function CardTimelinePanel({
  timeline,
  disabled,
  onRefresh,
  onLoadMore,
}: {
  timeline: ReturnType<typeof useCardTimelinePages>;
  disabled: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
}) {
  const hasSnapshot = timeline.events.length > 0;
  return (
    <section className="mt-4 rounded-2xl border border-border/60 bg-surface/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Card lifecycle timeline · read only
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            GET only · 25 events per page · signed opaque cursor · SANDBOX/TEST
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={disabled || !timeline.canRefresh}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-[10px] font-semibold text-primary disabled:opacity-50"
        >
          {timeline.refreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </button>
      </div>

      {timeline.loading && !hasSnapshot && (
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading verified timeline
        </div>
      )}
      {timeline.refreshing && hasSnapshot && (
        <p className="mt-3 text-[10px] text-muted-foreground">
          Refreshing; the last verified snapshot remains visible until replacement succeeds.
        </p>
      )}
      {(timeline.error || timeline.refreshError) && (
        <div className="mt-3 flex gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-[10px] text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            {timeline.refreshError ?? timeline.error}
            {hasSnapshot
              ? " · Last verified snapshot retained."
              : " · No stale timeline displayed."}
          </span>
        </div>
      )}
      {!timeline.loading && !timeline.error && timeline.events.length === 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-border/60 p-4 text-center">
          <History className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="mt-2 text-xs text-muted-foreground">No lifecycle events returned.</p>
        </div>
      )}
      {timeline.events.length > 0 && (
        <div className="mt-4 divide-y divide-border">
          {timeline.events.map((event) => (
            <div key={event.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{event.type}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {event.fromStatus ?? "—"} → {event.toStatus ?? "—"}
                  </p>
                </div>
                <time
                  dateTime={event.occurredAt}
                  className="shrink-0 text-right text-[9px] text-muted-foreground"
                >
                  {new Date(event.occurredAt).toLocaleString()}
                </time>
              </div>
              <p
                translate="no"
                className="mt-1 truncate font-mono text-[9px] text-muted-foreground"
              >
                {event.id}
              </p>
            </div>
          ))}
        </div>
      )}
      {timeline.nextCursor && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={disabled || timeline.loadingMore || timeline.refreshing}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/50 py-2.5 text-[10px] font-semibold disabled:opacity-50"
        >
          {timeline.loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {timeline.loadingMore ? "Loading more events…" : "Load more lifecycle events"}
        </button>
      )}
    </section>
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
        Card limits · minor units
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

function CardLimitsEditor({
  values,
  busy,
  canSubmit,
  submitLabel,
  onChange,
  onSubmit,
}: {
  values: Record<CardLimitField, string>;
  busy: boolean;
  canSubmit: boolean;
  submitLabel: string;
  onChange: (field: CardLimitField, value: string) => void;
  onSubmit: () => void;
}) {
  const fields: Array<[CardLimitField, string]> = [
    ["singleTransactionMinor", "Single transaction"],
    ["dailySpendMinor", "Daily spend"],
    ["monthlySpendMinor", "Monthly spend"],
    ["dailyAtmMinor", "Daily ATM"],
  ];
  return (
    <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        Update limits · 0–9,000,000,000,000
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {fields.map(([field, label]) => (
          <label key={field} className="text-[9px] uppercase tracking-wider text-muted-foreground">
            {label}
            <input
              inputMode="numeric"
              value={values[field]}
              onChange={(event) => onChange(field, event.target.value)}
              disabled={busy}
              placeholder="Not set"
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold tabular-nums text-foreground disabled:opacity-60"
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={onSubmit}
        disabled={busy || !canSubmit}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <SlidersHorizontal className="h-4 w-4" />
        )}
        {submitLabel}
      </button>
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
