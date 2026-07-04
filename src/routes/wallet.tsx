import { createFileRoute } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Search, ChevronRight } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "FastLink — Wallet" },
      { name: "description", content: "Manage your USDT and USDC balances." },
    ],
  }),
  component: WalletPage,
});

const assets = [
  {
    sym: "USDT",
    name: "Tether USD",
    balance: 10204.15,
    price: 1.0,
    change: 0.01,
    color: "bg-primary text-primary-foreground",
    glyph: "₮",
  },
  {
    sym: "USDC",
    name: "USD Coin",
    balance: 2643.14,
    price: 1.0,
    change: -0.02,
    color: "bg-[#2775ca] text-white",
    glyph: "$",
  },
];

const history = [
  { title: "Received USDT", net: "TRC20", amount: 500, pos: true, time: "Today · 09:12" },
  { title: "Sent USDC", net: "ERC20", amount: -220, pos: false, time: "Yesterday · 18:44" },
  { title: "Card Top-Up", net: "Internal", amount: -100, pos: false, time: "2 Jul · 12:03" },
  { title: "Received USDT", net: "BEP20", amount: 1500, pos: true, time: "30 Jun · 08:31" },
  { title: "Sent USDT", net: "TRC20", amount: -75.5, pos: false, time: "28 Jun · 21:17" },
];

function WalletPage() {
  const [tab, setTab] = useState<"USDT" | "USDC">("USDT");

  return (
    <MobileShell>
      <StatusBar title="Wallet" />

      <div className="px-6 pt-4">
        <h1 className="font-display text-2xl font-bold">Wallet</h1>
        <p className="mt-1 text-sm text-muted-foreground">All balances in USD equivalent</p>

        {/* Total */}
        <div className="mt-5 rounded-3xl bg-gradient-card p-6 shadow-card">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Portfolio Value</p>
          <p className="mt-2 font-display text-3xl font-bold">$12,847.29</p>
          <p className="mt-1 text-xs text-primary">+$304.12 (2.4%) today</p>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {[
              { i: ArrowDownToLine, l: "Deposit" },
              { i: ArrowUpFromLine, l: "Withdraw" },
              { i: ArrowLeftRight, l: "Swap" },
            ].map((a) => (
              <button
                key={a.l}
                className="flex flex-col items-center gap-1.5 rounded-2xl bg-background/40 py-3 text-xs font-medium backdrop-blur"
              >
                <a.i className="h-4 w-4 text-primary" />
                {a.l}
              </button>
            ))}
          </div>
        </div>

        {/* Asset Allocation */}
        <div className="mt-6 rounded-3xl bg-surface p-5">
          <div className="flex items-center justify-between">
            <p className="font-display text-sm font-semibold">Asset Allocation</p>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">3 assets</span>
          </div>
          <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[62%] bg-primary" />
            <div className="h-full w-[22%] bg-[#2775ca]" />
            <div className="h-full w-[16%] bg-accent" />
          </div>
          <div className="mt-4 space-y-2.5">
            <AllocationRow color="bg-primary" sym="USDT" name="Tether USD" pct="62%" value="$10,204.15" />
            <AllocationRow color="bg-[#2775ca]" sym="USDC" name="USD Coin" pct="22%" value="$2,643.14" />
            <AllocationRow color="bg-accent" sym="USD" name="Fiat Cash" pct="16%" value="$1,842.60" />
          </div>
        </div>

        {/* Assets */}
        <div className="mt-6 flex gap-2 rounded-full bg-surface p-1">

          {(["USDT", "USDC"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex-1 rounded-full py-2 text-xs font-semibold transition-colors ${
                tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {assets
            .filter((a) => a.sym === tab)
            .map((a) => (
              <div key={a.sym} className="rounded-2xl bg-surface p-5">
                <div className="flex items-center gap-3">
                  <div className={`grid h-12 w-12 place-items-center rounded-full font-bold ${a.color}`}>
                    {a.glyph}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{a.sym}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">
                      {a.balance.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      ≈ ${a.balance.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* History */}
      <div className="mx-6 mt-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold">Transaction History</h3>
          <button className="grid h-8 w-8 place-items-center rounded-full bg-surface">
            <Search className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {history.map((h, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl bg-surface p-4">
              <div
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                  h.pos ? "bg-primary/15 text-primary" : "bg-muted"
                }`}
              >
                {h.pos ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{h.title}</p>
                <p className="text-xs text-muted-foreground">
                  {h.net} · {h.time}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <p
                  className={`text-sm font-semibold tabular-nums ${
                    h.pos ? "text-primary" : "text-foreground"
                  }`}
                >
                  {h.pos ? "+" : ""}
                  {h.amount} $
                </p>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </MobileShell>
  );
}

function AllocationRow({
  color,
  sym,
  name,
  pct,
  value,
}: {
  color: string;
  sym: string;
  name: string;
  pct: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{sym}</p>
        <p className="truncate text-[10px] text-muted-foreground">{name}</p>
      </div>
      <p className="text-xs font-semibold tabular-nums">{pct}</p>
      <p className="w-24 text-right text-xs text-muted-foreground tabular-nums">{value}</p>
    </div>
  );
}
