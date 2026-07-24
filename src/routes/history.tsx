import { createFileRoute } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { AlertTriangle, CreditCard, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { backendApi, type WalletCardTransaction } from "@/lib/backend-api";
import { useBackendSession } from "@/lib/backend-session";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "FastLink — Transaction History" },
      { name: "description", content: "Transactions returned by Railway Backend." },
    ],
  }),
  component: HistoryPage,
});

type Row = WalletCardTransaction & { last4: string };

function HistoryPage() {
  const { lang, t } = useLang();
  const { token } = useBackendSession();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      setRows([]);
      try {
        const cards = await backendApi.listCards(token);
        const groups = await Promise.all(
          cards.map(async (card) => {
            const transactions = await backendApi.cardTransactions(token, card.cardId);
            return transactions.map((transaction) => ({
              ...transaction,
              last4: card.last4,
            }));
          }),
        );
        if (!cancelled) {
          setRows(groups.flat().sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)));
        }
      } catch (reason) {
        if (!cancelled) {
          setRows([]);
          setError(reason instanceof Error ? reason.message : "Railway Backend is unavailable");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const filtered = useMemo(
    () =>
      rows.filter((transaction) => {
        const haystack = `${transaction.merchant} ${transaction.category} ${transaction.last4}`;
        return !query || haystack.toLowerCase().includes(query.toLowerCase());
      }),
    [query, rows],
  );

  return (
    <MobileShell>
      <StatusBar title={t("page.history")} />
      <div className="px-6 pt-4">
        <h1 className="font-display text-2xl font-bold">{t("history.title")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Card transactions returned by Railway Backend. Wallet history is unavailable until an
          end-user wallet history contract is exposed.
        </p>

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
                    •••• {transaction.last4} ·{" "}
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
          </div>
        )}
      </div>
    </MobileShell>
  );
}
