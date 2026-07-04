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

        <div className="mt-5 grid grid-cols-3 gap-2">
          <BalanceStat
            label="USDT"
            value={hidden ? "••••" : "10,204.15"}
            icon={<span className="text-[10px] font-bold">₮</span>}
            tone="primary"
          />
          <BalanceStat
            label="Available"
            value={hidden ? "••••" : "$8,562.40"}
            icon={<PiggyBank className="h-3.5 w-3.5" />}
            tone="muted"
          />
          <BalanceStat
            label="Today Spend"
            value={hidden ? "••••" : "$142.24"}
            icon={<TrendingDown className="h-3.5 w-3.5" />}
            tone="accent"
          />
        </div>
      </div>

      {/* Treasury Dashboard */}
      <div className="mx-6 mt-6 rounded-3xl border border-border/60 bg-surface p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-primary">
              <Landmark className="h-4 w-4" />
            </div>
            <div>
              <p className="font-display text-sm font-semibold">Treasury Dashboard</p>
              <p className="text-[10px] text-muted-foreground">Yield · APY 5.82%</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <TreasuryStat label="Staked" value="$4,285" icon={Coins} />
          <TreasuryStat label="Earned (30d)" value="$62.14" icon={TrendingUp} accent />
          <TreasuryStat label="Idle" value="$8,562" icon={PiggyBank} />
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Allocation</span>
            <span>67% deployed</span>
          </div>
          <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[33%] bg-primary" />
            <div className="h-full w-[34%] bg-accent" />
            <div className="h-full w-[33%] bg-muted-foreground/40" />
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

function BalanceStat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "primary" | "muted" | "accent";
}) {
  const toneClass =
    tone === "primary"
      ? "bg-primary text-primary-foreground"
      : tone === "accent"
      ? "bg-accent/20 text-accent"
      : "bg-muted text-foreground";
  return (
    <div className="rounded-2xl bg-background/40 p-3 backdrop-blur">
      <div className="flex items-center gap-1.5">
        <div className={`grid h-5 w-5 place-items-center rounded-full ${toneClass}`}>{icon}</div>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 font-display text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function TreasuryStat({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-background/40 p-3">
      <Icon className={`h-3.5 w-3.5 ${accent ? "text-accent" : "text-primary"}`} />
      <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

