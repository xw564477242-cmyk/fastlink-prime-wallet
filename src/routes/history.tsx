import { createFileRoute } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { AlertTriangle, CreditCard, Loader2, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useBackendSession } from "@/lib/backend-session";
import { useLang } from "@/lib/i18n";
import { useCardListPages } from "@/hooks/use-card-list-pages";
import { useCardTransactionDetail } from "@/hooks/use-card-transaction-detail";
import { useCardTransactionPages } from "@/hooks/use-card-transaction-pages";
import { CARD_TRANSACTION_FILTERS } from "@/lib/backend-api";

export const Route = createFileRoute("/history")({
  validateSearch: (search: Record<string, unknown>): { cardId?: string } =>
    typeof search.cardId === "string" && /^[A-Za-z0-9._:-]{2,128}$/.test(search.cardId)
      ? { cardId: search.cardId }
      : {},
  head: () => ({
    meta: [
      { title: "FastLink — Transaction History" },
      { name: "description", content: "Transactions returned by Railway Backend." },
    ],
  }),
  component: HistoryPage,
});

export function HistoryPage() {
  const { lang, t } = useLang();
  const { session } = useBackendSession();
  const { cardId } = Route.useSearch();
  const [query, setQuery] = useState("");
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const cardPages = useCardListPages(session, cardId ?? null);
  const activeCard = cardPages.cards.find((card) => card.cardId === cardPages.activeId) ?? null;
  const transactionPages = useCardTransactionPages(session, activeCard?.cardId ?? null);
  const selectedTransaction =
    transactionPages.transactions.find(({ id }) => id === selectedTransactionId) ?? null;
  const transactionDetail = useCardTransactionDetail(
    session,
    activeCard?.cardId ?? null,
    transactionPages.filter,
    selectedTransaction,
    transactionPages.scopeKey,
  );
  const displayedTransaction = transactionDetail.detail ?? selectedTransaction;
  const loading = cardPages.loading || transactionPages.loading;
  const error = cardPages.error ?? transactionPages.error;

  useEffect(() => {
    setSelectedTransactionId((current) =>
      current && transactionPages.transactions.some(({ id }) => id === current) ? current : null,
    );
  }, [transactionPages.scopeKey, transactionPages.transactions]);

  const filtered = useMemo(
    () =>
      transactionPages.transactions.filter((transaction) => {
        const haystack = `${transaction.merchant} ${transaction.category} ${activeCard?.last4 ?? ""}`;
        return !query || haystack.toLowerCase().includes(query.toLowerCase());
      }),
    [activeCard?.last4, query, transactionPages.transactions],
  );

  return (
    <MobileShell>
      <StatusBar title={t("page.history")} />
      <div className="px-6 pt-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold">{t("history.title")}</h1>
          <button
            type="button"
            onClick={transactionPages.refresh}
            disabled={!transactionPages.canRefresh}
            aria-label="Refresh Card transaction history"
            className="flex shrink-0 items-center gap-2 rounded-full border border-border/60 bg-surface px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${transactionPages.refreshing ? "animate-spin" : ""}`} />
            {transactionPages.refreshing ? "Refreshing…" : "Refresh history"}
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Bounded card transactions returned by Railway Backend for the selected Card only.
        </p>

        {!cardPages.loading && cardPages.cards.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {cardPages.cards.map((card) => (
              <button
                key={card.cardId}
                type="button"
                onClick={() => {
                  setSelectedTransactionId(null);
                  cardPages.selectCard(card.cardId);
                }}
                className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold ${
                  card.cardId === activeCard?.cardId
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/60 bg-surface text-muted-foreground"
                }`}
              >
                {card.alias ?? "Card"} · •••• {card.last4}
              </button>
            ))}
            {cardPages.nextCursor && (
              <button
                type="button"
                onClick={() => void cardPages.loadMore()}
                disabled={cardPages.loadingMore}
                className="shrink-0 rounded-full border border-border/60 px-3 py-2 text-xs font-semibold text-muted-foreground disabled:opacity-50"
              >
                {cardPages.loadingMore ? "Loading…" : "More Cards"}
              </button>
            )}
          </div>
        )}

        <label className="mt-4 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Status
          <select
            aria-label="Card transaction status filter"
            value={transactionPages.filter}
            onChange={(event) => {
              transactionPages.changeFilter(event.target.value);
              setSelectedTransactionId(null);
            }}
            className="mt-1 w-full rounded-xl border border-border/60 bg-surface px-3 py-2 text-xs normal-case tracking-normal text-foreground"
          >
            {CARD_TRANSACTION_FILTERS.map((filter) => (
              <option key={filter} value={filter}>
                {filter === "ALL" ? "All statuses" : filter.toLowerCase()}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border/60 bg-surface/60 px-4 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("common.search")}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
        </div>

        {loading && (
          <div className="grid h-56 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        {!loading && error && (
          <div className="mt-4 flex gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error} · No stale transactions displayed.</span>
          </div>
        )}

        {!loading && !error && transactionPages.refreshError && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">
              {transactionPages.refreshError} · Existing verified transactions retained.
            </span>
            <button
              type="button"
              onClick={transactionPages.refresh}
              disabled={!transactionPages.canRefresh}
              className="shrink-0 rounded-full border border-destructive/40 px-3 py-1.5 font-semibold disabled:opacity-50"
            >
              Retry refresh
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="mt-4 space-y-2">
            {filtered.map((transaction) => (
              <button
                key={transaction.id}
                type="button"
                onClick={() => setSelectedTransactionId(transaction.id)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left ${
                  selectedTransaction?.id === transaction.id
                    ? "border-primary bg-primary/5"
                    : "border-transparent bg-surface"
                }`}
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{transaction.merchant}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    •••• {activeCard?.last4} ·{" "}
                    {new Date(transaction.timestamp).toLocaleString(lang)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">
                    {transaction.amountMinor} {transaction.currency} minor units
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {transaction.status}
                  </p>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-xs text-muted-foreground">
                {t("history.empty")}
              </div>
            )}
            {transactionPages.nextCursor && (
              <button
                type="button"
                onClick={() => void transactionPages.loadMore()}
                disabled={transactionPages.loadingMore || transactionPages.refreshing}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 bg-surface/60 py-3 text-xs font-semibold disabled:opacity-50"
              >
                {transactionPages.loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                {transactionPages.loadingMore ? "Loading more…" : "Load more transactions"}
              </button>
            )}
          </div>
        )}

        {!loading && !error && selectedTransaction && displayedTransaction && (
          <section className="mt-4 rounded-2xl border border-border/60 bg-surface p-4 text-xs">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Selected Card transaction · read only</h2>
              <button
                type="button"
                onClick={transactionDetail.refresh}
                disabled={!transactionDetail.canRefresh}
                aria-label="Refresh selected Card transaction detail"
                className="flex shrink-0 items-center gap-2 rounded-full border border-border/60 px-3 py-1.5 text-[10px] font-semibold disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${transactionDetail.loading ? "animate-spin" : ""}`}
                />
                Refresh detail
              </button>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Current Card, session, status filter and selected list record only · each click makes
              one read.
            </p>
            {transactionDetail.error && (
              <div className="mt-3 flex gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  {transactionDetail.error}
                  {transactionDetail.detail ? " · Existing verified detail retained." : ""}
                </span>
              </div>
            )}
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
              <dt className="text-muted-foreground">Transaction</dt>
              <dd className="min-w-0 break-all text-right font-semibold">
                {displayedTransaction.id}
              </dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="text-right font-semibold uppercase">{displayedTransaction.status}</dd>
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="text-right font-semibold">
                {displayedTransaction.amountMinor} {displayedTransaction.currency} minor units
              </dd>
              <dt className="text-muted-foreground">Merchant</dt>
              <dd className="min-w-0 break-words text-right font-semibold">
                {displayedTransaction.merchant}
              </dd>
              <dt className="text-muted-foreground">Category</dt>
              <dd className="text-right font-semibold">
                {displayedTransaction.category || "Not provided"}
              </dd>
              <dt className="text-muted-foreground">Occurred</dt>
              <dd className="text-right font-semibold">
                {new Date(displayedTransaction.timestamp).toLocaleString(lang)}
              </dd>
            </dl>
          </section>
        )}
      </div>
    </MobileShell>
  );
}
