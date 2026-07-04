import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  CreditCard,
  Bell,
  Eye,
  EyeOff,
  TrendingUp,
  TrendingDown,
  Plus,
  ChevronRight,
  Landmark,
  PiggyBank,
  Coins,
} from "lucide-react";
import { useState } from "react";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FastLink — Home" },
      { name: "description", content: "Your USDT wallet balance and quick actions." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const [hidden, setHidden] = useState(false);

  const actions = [
    { icon: ArrowDownToLine, label: "Deposit", href: "/wallet" },
    { icon: ArrowUpFromLine, label: "Withdraw", href: "/wallet" },
    { icon: ArrowLeftRight, label: "Transfer", href: "/wallet" },
    { icon: CreditCard, label: "Card", href: "/card" },
  ];

  const recent = [
    { name: "Card Spend · Starbucks", amount: -6.85, time: "Today, 09:12", pos: false },
    { name: "USDT Deposit · TRC20", amount: 500.0, time: "Yesterday", pos: true },
    { name: "ATM Withdrawal · Dubai", amount: -200.0, time: "2 Jul", pos: false },
    { name: "Transfer from Alex", amount: 120.0, time: "1 Jul", pos: true },
  ];

  return (
    <MobileShell>
      <StatusBar />
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-primary text-primary-foreground font-bold shadow-glow">
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

      {/* Balance card */}
      <div className="mx-6 mt-6 overflow-hidden rounded-3xl bg-gradient-card p-6 shadow-card">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Total Balance</p>
          <button onClick={() => setHidden((v) => !v)} className="text-muted-foreground">
            {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-display text-4xl font-bold tracking-tight">
            {hidden ? "••••••" : "$12,847.29"}
          </span>
        </div>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
          <TrendingUp className="h-3 w-3" /> +2.4% today
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-background/40 p-4 backdrop-blur">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                ₮
              </div>
              <span className="text-xs text-muted-foreground">USDT</span>
            </div>
            <p className="mt-2 font-display text-lg font-semibold">
              {hidden ? "••••" : "10,204.15"}
            </p>
          </div>
          <div className="rounded-2xl bg-background/40 p-4 backdrop-blur">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-full bg-[#2775ca] text-white text-[10px] font-bold">
                $
              </div>
              <span className="text-xs text-muted-foreground">USDC</span>
            </div>
            <p className="mt-2 font-display text-lg font-semibold">
              {hidden ? "••••" : "2,643.14"}
            </p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mx-6 mt-6 grid grid-cols-4 gap-2">
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

      {/* Card shortcut */}
      <Link
        to="/card"
        className="mx-6 mt-6 flex items-center gap-4 rounded-3xl bg-gradient-visa p-5 shadow-card"
      >
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-white/60">U Card · Virtual</p>
          <p className="mt-1 font-display text-lg font-semibold text-white">•••• 4829</p>
          <p className="mt-1 text-xs text-white/70">Tap to manage card</p>
        </div>
        <div className="text-white/80">
          <ChevronRight className="h-5 w-5" />
        </div>
      </Link>

      {/* Recent activity */}
      <div className="mx-6 mt-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold">Recent Activity</h3>
          <Link to="/activity" className="text-xs text-primary">
            See all
          </Link>
        </div>
        <div className="mt-3 space-y-2">
          {recent.map((t) => (
            <div
              key={t.name}
              className="flex items-center gap-3 rounded-2xl bg-surface p-4"
            >
              <div
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                  t.pos ? "bg-primary/15 text-primary" : "bg-muted text-foreground"
                }`}
              >
                {t.pos ? <Plus className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.time}</p>
              </div>
              <p
                className={`shrink-0 text-sm font-semibold tabular-nums ${
                  t.pos ? "text-primary" : "text-foreground"
                }`}
              >
                {t.pos ? "+" : ""}
                {t.amount.toFixed(2)} $
              </p>
            </div>
          ))}
        </div>
      </div>
    </MobileShell>
  );
}
