import { createFileRoute } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Send,
  CreditCard,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/i18n";
import type { ThreddCard, ThreddCardTxn } from "@/integrations/thredd/thredd.types";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "FastLink — Transaction History" },
      {
        name: "description",
        content: "Your recent deposits, withdrawals, transfers and card spend.",
      },
    ],
  }),
  component: HistoryPage,
});

type Kind = "deposit" | "withdraw" | "transfer" | "convert" | "card";

const ICONS: Record<Kind, typeof ArrowDownToLine> = {
  deposit: ArrowDownToLine,
  withdraw: ArrowUpFromLine,
  transfer: Send,
  convert: ArrowLeftRight,
  card: CreditCard,
};

function HistoryPage() {
  const { lang, t } = useLang();
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [q, setQ] = useState("");
  const [cardTxns, setCardTxns] = useState<
    Array<ThreddCardTxn & { last4: string; cardType: ThreddCard["type"] }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { authFetch } = await import("@/lib/authFetch");
        const cardsResponse = await authFetch("/api/card/list");
        if (!cardsResponse.ok) return;
        const { cards = [] } = (await cardsResponse.json()) as { cards?: ThreddCard[] };
        const groups = await Promise.all(
          cards.map(async (card) => {
            const response = await authFetch(`/api/card/${card.cardId}/transactions`);
            if (!response.ok) return [];
            const body = (await response.json()) as { transactions?: ThreddCardTxn[] };
            return (body.transactions ?? []).map((transaction) => ({
              ...transaction,
              last4: card.last4,
              cardType: card.type,
            }));
          }),
        );
        if (!cancelled)
          setCardTxns(
            groups.flat().sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)),
          );
      } catch {
        // The existing wallet activity remains available while the card API is temporarily unavailable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const TXNS = useMemo(
    () => [
      ...cardTxns.map((transaction) => ({
        id: transaction.id,
        kind: "card" as Kind,
        title: transaction.merchant,
        subtitle: `${t(`card.${transaction.cardType}`)} •• ${transaction.last4}`,
        amount: transaction.amount,
        currency: transaction.currency,
        time: new Date(transaction.timestamp).toLocaleString(lang),
        status: (transaction.status === "declined"
          ? "failed"
          : transaction.status === "authorized"
            ? "pending"
            : "completed") as "completed" | "pending" | "failed",
      })),
      {
        id: "t2",
        kind: "deposit" as Kind,
        title: t("home.tx.deposit"),
        subtitle: "TRC20 · 5 conf.",
        amount: 500,
        currency: "USDT",
        time: t("home.time.today0912"),
        status: "completed" as const,
      },
      {
        id: "t3",
        kind: "convert" as Kind,
        title: t("home.tx.convert"),
        subtitle: "1 USDT = 0.9187 EUR",
        amount: -200,
        currency: "USDT",
        time: t("home.time.yesterday"),
        status: "completed" as const,
      },
      {
        id: "t4",
        kind: "transfer" as Kind,
        title: t("home.tx.transfer"),
        subtitle: "FastLink @alex",
        amount: 120,
        currency: "USDT",
        time: t("home.time.jul2"),
        status: "completed" as const,
      },
      {
        id: "t5",
        kind: "withdraw" as Kind,
        title: t("history.withdrawTo", { address: "0x8B2…4E9" }),
        subtitle: "ERC20 · 3/12",
        amount: -250,
        currency: "USDT",
        time: t("home.time.jul2"),
        status: "pending" as const,
      },
      {
        id: "t7",
        kind: "deposit" as Kind,
        title: t("home.tx.deposit"),
        subtitle: "BEP20",
        amount: 1000,
        currency: "USDT",
        time: t("home.time.jul2"),
        status: "completed" as const,
      },
    ],
    [cardTxns, lang, t],
  );

  const FILTERS: Array<{ key: "all" | Kind; label: string }> = [
    { key: "all", label: t("history.filter.all") },
    { key: "deposit", label: t("history.filter.deposit") },
    { key: "withdraw", label: t("history.filter.withdraw") },
    { key: "transfer", label: t("history.filter.transfer") },
    { key: "convert", label: t("history.filter.convert") },
    { key: "card", label: t("history.filter.card") },
  ];

  const rows = useMemo(
    () =>
      TXNS.filter((tx) => filter === "all" || tx.kind === filter).filter(
        (tx) => !q || `${tx.title} ${tx.subtitle}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [TXNS, filter, q],
  );

  return (
    <MobileShell>
      <StatusBar title={t("page.history")} />
      <div className="px-6 pt-4">
        <h1 className="font-display text-2xl font-bold">{t("history.title")}</h1>

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border/60 bg-surface/60 px-4 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("common.search")}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => {
            const on = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${on ? "border-primary bg-primary/10 text-primary" : "border-border/60 bg-surface/60 text-muted-foreground"}`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 space-y-2">
          {rows.map((tx) => {
            const Icon = ICONS[tx.kind];
            const pos = tx.amount > 0;
            return (
              <div key={tx.id} className="flex items-center gap-3 rounded-2xl bg-surface p-4">
                <div
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${pos ? "bg-primary/15 text-primary" : "bg-muted text-foreground"}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{tx.title}</p>
                  <p translate="no" className="truncate text-xs text-muted-foreground">
                    {tx.subtitle} · {tx.time}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    translate="no"
                    className={`text-sm font-semibold tabular-nums ${pos ? "text-primary" : "text-foreground"}`}
                  >
                    {pos ? "+" : ""}
                    {tx.amount.toFixed(2)} {tx.currency}
                  </p>
                  <p
                    className={`text-[10px] uppercase tracking-widest ${
                      (tx.status as string) === "pending"
                        ? "text-accent"
                        : (tx.status as string) === "failed"
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    {t(`history.status.${tx.status}`)}
                  </p>
                </div>
              </div>
            );
          })}
          {rows.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-xs text-muted-foreground">
              {t("history.empty")}
            </div>
          )}
        </div>
      </div>
    </MobileShell>
  );
}
