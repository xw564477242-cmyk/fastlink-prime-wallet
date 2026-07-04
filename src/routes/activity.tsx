import { createFileRoute } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { CreditCard, Landmark, ArrowLeftRight, Filter, Search, X } from "lucide-react";
import { useState } from "react";


export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "FastLink — Activity" },
      { name: "description", content: "Track your card spend, ATM withdrawals and wallet transfers." },
    ],
  }),
  component: ActivityPage,
});

type Kind = "All" | "Card" | "ATM" | "Transfer";

const items = [
  { kind: "Card", merchant: "Starbucks Reserve", city: "Dubai, AE", amount: -6.85, time: "Today · 09:12" },
  { kind: "Card", merchant: "Apple Store", city: "Online", amount: -129.0, time: "Today · 08:03" },
  { kind: "ATM", merchant: "Emirates NBD ATM", city: "Dubai, AE", amount: -200.0, time: "Yesterday · 22:41" },
  { kind: "Transfer", merchant: "Transfer to Alex Wong", city: "USDT · TRC20", amount: -220.0, time: "Yesterday · 15:20" },
  { kind: "Card", merchant: "Uber", city: "London, UK", amount: -18.4, time: "2 Jul · 19:44" },
  { kind: "Transfer", merchant: "Received from Maya", city: "USDC · ERC20", amount: 340.0, time: "2 Jul · 12:03" },
  { kind: "ATM", merchant: "Chase ATM", city: "New York, US", amount: -300.0, time: "1 Jul · 14:12" },
  { kind: "Card", merchant: "Amazon Prime", city: "Subscription", amount: -14.99, time: "30 Jun · 09:00" },
] as const;

const iconFor = (k: string) =>
  k === "Card" ? CreditCard : k === "ATM" ? Landmark : ArrowLeftRight;

function ActivityPage() {
  const [filter, setFilter] = useState<Kind>("All");
  const [query, setQuery] = useState("");
  const filtered = items.filter((i) => {
    const okKind = filter === "All" || i.kind === filter;
    const q = query.trim().toLowerCase();
    const okQuery =
      !q ||
      i.merchant.toLowerCase().includes(q) ||
      i.city.toLowerCase().includes(q) ||
      i.kind.toLowerCase().includes(q);
    return okKind && okQuery;
  });


  const totalSpend = items
    .filter((i) => i.amount < 0)
    .reduce((s, i) => s + Math.abs(i.amount), 0);

  return (
    <MobileShell>
      <StatusBar title="Activity" />

      <div className="px-6 pt-4">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">Activity</h1>
          <button className="grid h-9 w-9 place-items-center rounded-full bg-surface">
            <Filter className="h-4 w-4" />
          </button>
        </div>

        {/* Summary */}
        <div className="mt-5 rounded-3xl bg-gradient-card p-5 shadow-card">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Spent this month</p>
          <p className="mt-2 font-display text-3xl font-bold">${totalSpend.toFixed(2)}</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <MiniStat label="Card" value="$169.24" />
            <MiniStat label="ATM" value="$500.00" />
            <MiniStat label="Transfer" value="$220.00" />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="mt-6 flex gap-2 overflow-x-auto">
          {(["All", "Card", "ATM", "Transfer"] as Kind[]).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                filter === k
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface text-muted-foreground"
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="mt-4 space-y-2 pb-4">
          {filtered.map((i, idx) => {
            const Icon = iconFor(i.kind);
            const pos = i.amount > 0;
            return (
              <div key={idx} className="flex items-center gap-3 rounded-2xl bg-surface p-4">
                <div
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                    pos ? "bg-primary/15 text-primary" : "bg-muted text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.merchant}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {i.kind} · {i.city}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-semibold tabular-nums ${
                      pos ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {pos ? "+" : ""}
                    {i.amount.toFixed(2)} $
                  </p>
                  <p className="text-[10px] text-muted-foreground">{i.time.split(" · ")[0]}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </MobileShell>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-background/40 p-3 backdrop-blur">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
