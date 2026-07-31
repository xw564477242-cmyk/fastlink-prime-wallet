import { createFileRoute } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { AlertTriangle, CreditCard, Loader2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useBackendSession } from "@/lib/backend-session";
import { useLang } from "@/lib/i18n";
import { useCardListPages } from "@/hooks/use-card-list-pages";
import { useCardTransactionPages } from "@/hooks/use-card-transaction-pages";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "FastLink — Transaction History" },
      { name: "description", content: "Transactions returned by Railway Backend." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { lang, t } = useLang();
  const { session } = useBackendSession();
  const [query, setQuery] = useState("");
  const cardPages = useCardListPages(session);
  const activeCard = cardPages.cards.find((card) => card.cardId === cardPages.activeId) ?? null;
  const transactionPages = useCardTransactionPages(session, activeCard?.cardId ?? null);
  const loading = cardPages.loading || transactionPages.loading;
  const error = cardPages.error ?? transactionPages.error;

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
        <h1 className="font-display text-2xl font-bold">{t("history.title")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Bounded card transactions returned by Railway Backend for the selected Card only.
        </p>

        {!cardPages.loading && cardPages.cards.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {cardPages.cards.map((card) => (
              <button
                key={card.cardId}
                type="button"
                onClick={() => cardPages.selectCard(card.cardId)}
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

        {!loading && !error && (
          <div className="mt-4 space-y-2">
            {filtered.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center gap-3 rounded-2xl bg-surface p-4"
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
                    {transaction.amount.toFixed(2)} {transaction.currency}
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {transaction.status}
                  </p>
                </div>
              </div>
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
                disabled={transactionPages.loadingMore}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 bg-surface/60 py-3 text-xs font-semibold disabled:opacity-50"
              >
                {transactionPages.loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                {transactionPages.loadingMore ? "Loading more…" : "Load more transactions"}
              </button>
            )}
          </div>
        )}
      </div>
    </MobileShell>
  );
}
