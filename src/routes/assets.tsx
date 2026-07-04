import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, TrendingUp, TrendingDown, Search } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/assets")({
  head: () => ({
    meta: [
      { title: "FastLink — Assets" },
      { name: "description", content: "Digital assets and fiat wallets in one place." },
    ],
  }),
  component: AssetsPage,
});

const digital = [
  { sym: "USDT", name: "Tether", bal: "10,204.15", usd: "$10,204.15", chg: 0.01, color: "from-emerald-500 to-teal-500" },
  { sym: "USDC", name: "USD Coin", bal: "4,120.00", usd: "$4,120.00", chg: 0.0, color: "from-sky-500 to-blue-600" },
  { sym: "BTC", name: "Bitcoin", bal: "0.0821", usd: "$5,320.40", chg: 1.42, color: "from-amber-500 to-orange-600" },
  { sym: "ETH", name: "Ethereum", bal: "0.482", usd: "$1,842.20", chg: -0.86, color: "from-indigo-500 to-purple-600" },
];

const fiat = [
  { sym: "USD", name: "US Dollar", bal: "5,240.00", flag: "🇺🇸" },
  { sym: "EUR", name: "Euro", bal: "2,180.50", flag: "🇪🇺" },
  { sym: "HKD", name: "HK Dollar", bal: "1,148.20", flag: "🇭🇰" },
];

function AssetsPage() {
  const [tab, setTab] = useState<"digital" | "fiat">("digital");

  return (
    <MobileShell>
      <StatusBar title="Assets" />
      <div className="px-6 pt-4">
        <h1 className="font-display text-2xl font-bold">My Wallets</h1>
        <p className="mt-1 text-xs text-muted-foreground">Total portfolio · <span className="text-foreground font-semibold">$28,412.90</span></p>

        {/* Allocation */}
        <div className="mt-5 rounded-3xl bg-surface p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Asset Allocation</p>
          <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[52%] bg-primary" />
            <div className="h-full w-[18%] bg-sky-500" />
            <div className="h-full w-[30%] bg-accent" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
            <Legend dot="bg-primary" label="USDT" pct="52%" />
            <Legend dot="bg-sky-500" label="USDC" pct="18%" />
            <Legend dot="bg-accent" label="Fiat" pct="30%" />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          <ActionBtn to="/pay" icon={ArrowDownToLine} label="Deposit" />
          <ActionBtn to="/pay" icon={ArrowUpFromLine} label="Withdraw" />
          <ActionBtn to="/convert" icon={ArrowLeftRight} label="Convert" />
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-2 rounded-full bg-surface p-1">
          {[
            { k: "digital", l: "Digital Assets" },
            { k: "fiat", l: "Fiat Wallets" },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k as "digital" | "fiat")}
              className={`flex-1 rounded-full py-2 text-xs font-semibold transition-colors ${tab === t.k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {t.l}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-surface px-4 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input placeholder="Search asset" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </div>

        <div className="mt-4 space-y-2">
          {tab === "digital"
            ? digital.map((a) => (
                <div key={a.sym} className="flex items-center gap-3 rounded-2xl bg-surface p-4">
                  <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br ${a.color} font-display text-xs font-bold text-white`}>
                    {a.sym.slice(0, 3)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{a.name}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">{a.bal} {a.sym}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{a.usd}</p>
                    <p className={`inline-flex items-center gap-0.5 text-[10px] tabular-nums ${a.chg >= 0 ? "text-primary" : "text-destructive"}`}>
                      {a.chg >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {a.chg >= 0 ? "+" : ""}{a.chg.toFixed(2)}%
                    </p>
                  </div>
                </div>
              ))
            : fiat.map((a) => (
                <div key={a.sym} className="flex items-center gap-3 rounded-2xl bg-surface p-4">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted text-lg">{a.flag}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{a.name}</p>
                    <p className="text-[11px] text-muted-foreground">{a.sym}</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{a.bal}</p>
                </div>
              ))}
        </div>
      </div>
    </MobileShell>
  );
}

function ActionBtn({ to, icon: Icon, label }: { to: "/pay" | "/convert"; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-2 rounded-2xl bg-surface py-4 active:scale-95">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-[11px] font-medium">{label}</span>
    </Link>
  );
}

function Legend({ dot, label, pct }: { dot: string; label: string; pct: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto tabular-nums font-semibold text-foreground">{pct}</span>
    </div>
  );
}
