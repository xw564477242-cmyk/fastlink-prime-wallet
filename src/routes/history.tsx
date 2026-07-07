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
import { useMemo, useState } from "react";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "FastLink — Transaction History" },
      { name: "description", content: "Your recent deposits, withdrawals, transfers and card spend." },
    ],
  }),
  component: HistoryPage,
});

type Kind = "deposit" | "withdraw" | "transfer" | "convert" | "card";

const TXNS: Array<{
  id: string;
  kind: Kind;
  title: string;
  subtitle: string;
  amount: number;
  currency: string;
  time: string;
  status: "completed" | "pending" | "failed";
}> = [
  { id: "t1", kind: "card", title: "Apple Pay · Uniqlo", subtitle: "Virtual Card •• 4829", amount: -48.2, currency: "USD", time: "Today, 14:02", status: "completed" },
  { id: "t2", kind: "deposit", title: "USDT Deposit", subtitle: "TRC20 · 5 conf.", amount: 500, currency: "USDT", time: "Today, 09:12", status: "completed" },
  { id: "t3", kind: "convert", title: "Convert USDT → EUR", subtitle: "1 USDT = 0.9187 EUR", amount: -200, currency: "USDT", time: "Yesterday", status: "completed" },
  { id: "t4", kind: "transfer", title: "Transfer from Alex", subtitle: "FastLink ID @alex", amount: 120, currency: "USDT", time: "2 Jul", status: "completed" },
  { id: "t5", kind: "withdraw", title: "Withdraw to 0x8B2…4E9", subtitle: "ERC20 · Pending 3/12", amount: -250, currency: "USDT", time: "1 Jul", status: "pending" },
  { id: "t6", kind: "card", title: "Starbucks Reserve", subtitle: "Physical Card •• 9130", amount: -8.4, currency: "USD", time: "30 Jun", status: "completed" },
  { id: "t7", kind: "deposit", title: "USDT Deposit", subtitle: "BEP20", amount: 1000, currency: "USDT", time: "28 Jun", status: "completed" },
];

const ICONS: Record<Kind, typeof ArrowDownToLine> = {
  deposit: ArrowDownToLine,
  withdraw: ArrowUpFromLine,
  transfer: Send,
  convert: ArrowLeftRight,
  card: CreditCard,
};

const FILTERS: Array<{ key: "all" | Kind; label: string }> = [
  { key: "all", label: "All" },
  { key: "deposit", label: "Deposit" },
  { key: "withdraw", label: "Withdraw" },
  { key: "transfer", label: "Transfer" },
  { key: "convert", label: "Convert" },
  { key: "card", label: "Card" },
];

function HistoryPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [q, setQ] = useState("");

  const rows = useMemo(
    () =>
      TXNS.filter((t) => filter === "all" || t.kind === filter).filter(
        (t) => !q || `${t.title} ${t.subtitle}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [filter, q],
  );

  return (
    <MobileShell>
      <StatusBar title="History" />
      <div className="px-6 pt-4">
        <h1 className="font-display text-2xl font-bold">Transactions</h1>

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border/60 bg-surface/60 px-4 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
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
          {rows.map((t) => {
            const Icon = ICONS[t.kind];
            const pos = t.amount > 0;
            return (
              <div key={t.id} className="flex items-center gap-3 rounded-2xl bg-surface p-4">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${pos ? "bg-primary/15 text-primary" : "bg-muted text-foreground"}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t.subtitle} · {t.time}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold tabular-nums ${pos ? "text-primary" : "text-foreground"}`}>
                    {pos ? "+" : ""}
                    {t.amount.toFixed(2)} {t.currency}
                  </p>
                  <p
                    className={`text-[10px] uppercase tracking-widest ${
                      t.status === "pending"
                        ? "text-accent"
                        : t.status === "failed"
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    {t.status}
                  </p>
                </div>
              </div>
            );
          })}
          {rows.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-xs text-muted-foreground">
              No transactions match your filter.
            </div>
          )}
        </div>
      </div>
    </MobileShell>
  );
}
