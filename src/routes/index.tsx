import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  QrCode,
  CreditCard,
  Send,
  Bell,
  Eye,
  EyeOff,
  
  ChevronRight,
  Sparkles,
  Wallet,
  Plane,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FastLink — Home" },
      { name: "description", content: "Global USDT wallet and premium U Card dashboard." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const [hidden, setHidden] = useState(false);

  const actions = [
    { icon: ArrowDownToLine, label: "Deposit", href: "/deposit" as const },
    { icon: ArrowUpFromLine, label: "Withdraw", href: "/withdraw" as const },
    { icon: ArrowLeftRight, label: "Convert", href: "/convert" as const },
    { icon: QrCode, label: "Pay", href: "/pay" as const },
    { icon: Send, label: "Transfer", href: "/transfer" as const },
    { icon: CreditCard, label: "Cards", href: "/cards" as const },
  ];

  const recent = [
    { name: "Apple Pay · Uniqlo", amount: -48.2, time: "Today, 14:02", pos: false },
    { name: "USDT Deposit · TRC20", amount: 500.0, time: "Today, 09:12", pos: true },
    { name: "Convert USDT → EUR", amount: -200.0, time: "Yesterday", pos: false },
    { name: "Transfer from Alex", amount: 120.0, time: "2 Jul", pos: true },
  ];

  const cardBalances = [
    { label: "Virtual", last4: "4829", balance: 1842.6, icon: Sparkles, tone: "bg-primary" },
    { label: "Physical", last4: "9130", balance: 620.4, icon: Wallet, tone: "bg-accent" },
    { label: "Travel", last4: "2246", balance: 980.0, icon: Plane, tone: "bg-sky-400" },
  ];

  return (
    <MobileShell>
      <StatusBar />
      <div className="flex items-center justify-between px-6 pt-4">
        <div className="flex items-center gap-3">
          <div translate="no" className="grid h-11 w-11 place-items-center rounded-full bg-gradient-primary font-bold text-primary-foreground shadow-glow">
            FL
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Welcome back</p>
            <p className="truncate text-sm font-semibold">Daniel Chen</p>
          </div>
        </div>
        <button className="relative grid h-11 w-11 place-items-center rounded-full bg-surface">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-accent" />
        </button>
      </div>

      {/* Balance */}
      <div className="mx-6 mt-6 overflow-hidden rounded-3xl bg-gradient-card p-6 shadow-card">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Total Balance</p>
          <button onClick={() => setHidden((v) => !v)} className="text-muted-foreground">
            {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-3 font-display text-4xl font-bold tracking-tight">
          {hidden ? "••••••" : "$28,412.90"}
        </div>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
          <TrendingUp className="h-3 w-3" /> +3.8% this week
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <MiniStat label="Digital" value={hidden ? "••••" : "$19,844"} />
          <MiniStat label="Fiat" value={hidden ? "••••" : "$8,568"} />
          <MiniStat label="Card" value={hidden ? "••••" : "$1,842"} tone="accent" />
        </div>
      </div>

      {/* Quick actions */}
      <div className="mx-6 mt-6 grid grid-cols-3 gap-2">
        {actions.map((a) => (
          <Link
            key={a.label}
            to={a.href}
            className="flex flex-col items-center gap-2 rounded-2xl bg-surface py-4 transition-transform active:scale-95"
          >
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">
              <a.icon className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-medium">{a.label}</span>
          </Link>
        ))}
      </div>

      {/* Card Balance Summary */}
      <div className="mx-6 mt-6 rounded-3xl border border-border/60 bg-surface/60 p-5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Card Balance Summary</p>
          <Link to="/cards" className="text-xs font-semibold text-primary">Manage</Link>
        </div>
        <div className="mt-4 space-y-3">
          {cardBalances.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.label}
                to="/cards"
                className="flex items-center justify-between rounded-2xl bg-background/60 p-4 active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-3">
                  <div className={`grid h-9 w-9 place-items-center rounded-full ${c.tone}/15 text-white`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{c.label}</p>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">•••• {c.last4}</p>
                  </div>
                </div>
                <p className="text-sm font-semibold tabular-nums">
                  {hidden ? "••••" : `$${c.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Virtual card preview */}
      <Link
        to="/cards"
        className="mx-6 mt-6 block overflow-hidden rounded-3xl bg-gradient-visa p-5 shadow-card"
      >
        <div className="flex items-start justify-between text-white">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/60">Virtual · Platinum</p>
            <p className="mt-1 font-display text-lg font-semibold">•••• 4829</p>
          </div>
          <Sparkles className="h-4 w-4 text-white/80" />
        </div>
        <div className="mt-6 flex items-end justify-between text-white">
          <div>
            <p className="text-[9px] uppercase tracking-widest text-white/60">Available</p>
            <p className="text-sm font-semibold tabular-nums">$1,842.60</p>
          </div>
          <p translate="no" className="font-display text-base font-bold italic">VISA</p>
        </div>
      </Link>

      {/* Recent */}
      <div className="mx-6 mt-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold">Recent Activity</h3>
          <Link to="/pay" className="text-xs text-primary">See all</Link>
        </div>
        <div className="mt-3 space-y-2">
          {recent.map((t) => (
            <div key={t.name} className="flex items-center gap-3 rounded-2xl bg-surface p-4">
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${t.pos ? "bg-primary/15 text-primary" : "bg-muted text-foreground"}`}>
                {t.pos ? <ArrowDownToLine className="h-5 w-5" /> : <ArrowUpFromLine className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.time}</p>
              </div>
              <p className={`shrink-0 text-sm font-semibold tabular-nums ${t.pos ? "text-primary" : "text-foreground"}`}>
                {t.pos ? "+" : ""}{t.amount.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-6 mt-6 flex items-center justify-between rounded-2xl border border-border/60 bg-surface/60 p-4">
        <div>
          <p className="text-xs font-semibold">Earn 5.82% APY on idle USDT</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">FastLink Treasury · Auto-yield</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </MobileShell>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "accent" }) {
  return (
    <div className="rounded-2xl bg-background/40 p-3 backdrop-blur">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-sm font-semibold tabular-nums ${tone === "accent" ? "text-accent" : ""}`}>{value}</p>
    </div>
  );
}
