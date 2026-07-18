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
} from "lucide-react";

import { useState } from "react";
import { useLang } from "@/lib/i18n";

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
  const { t } = useLang();

  const actions = [
    { icon: ArrowDownToLine, label: t("home.deposit"), href: "/deposit" as const },
    { icon: ArrowUpFromLine, label: t("home.withdraw"), href: "/withdraw" as const },
    { icon: ArrowLeftRight, label: t("home.convert"), href: "/convert" as const },
    { icon: QrCode, label: t("home.pay"), href: "/pay" as const },
    { icon: Send, label: t("home.transfer"), href: "/transfer" as const },
    { icon: CreditCard, label: t("home.cards"), href: "/cards" as const },
  ];

  const recent = [
    { name: t("home.tx.applePay"), amount: -48.2, time: t("home.time.today1402"), pos: false },
    { name: t("home.tx.deposit"), amount: 500.0, time: t("home.time.today0912"), pos: true },
    { name: t("home.tx.convert"), amount: -200.0, time: t("home.time.yesterday"), pos: false },
    { name: t("home.tx.transfer"), amount: 120.0, time: t("home.time.jul2"), pos: true },
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
            <p className="text-xs text-muted-foreground">{t("home.welcome")}</p>
            <p translate="no" className="truncate text-sm font-semibold">Daniel Chen</p>
          </div>
        </div>
        <button className="relative grid h-11 w-11 place-items-center rounded-full bg-surface">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-accent" />
        </button>
      </div>

      <div className="mx-6 mt-6 overflow-hidden rounded-3xl bg-gradient-card p-6 shadow-card">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("home.totalBalance")}</p>
          <button onClick={() => setHidden((v) => !v)} className="text-muted-foreground">
            {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-3 font-display text-4xl font-bold tracking-tight" translate="no">
          {hidden ? "••••••" : "$28,412.90"}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <MiniStat to="/assets/digital" label={t("home.digital")} value={hidden ? "••••" : "$19,844"} />
          <MiniStat to="/assets/fiat" label={t("home.fiat")} value={hidden ? "••••" : "$8,568"} />
          <MiniStat to="/assets/cards" label={t("home.card")} value={hidden ? "••••" : "$1,842"} tone="accent" />
        </div>
      </div>

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

      <div className="mx-6 mt-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold">{t("home.recent")}</h3>
          <Link to="/history" className="text-xs text-primary">{t("home.seeAll")}</Link>
        </div>
        <div className="mt-3 space-y-2">
          {recent.map((row) => (
            <div key={row.name} className="flex items-center gap-3 rounded-2xl bg-surface p-4">
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${row.pos ? "bg-primary/15 text-primary" : "bg-muted text-foreground"}`}>
                {row.pos ? <ArrowDownToLine className="h-5 w-5" /> : <ArrowUpFromLine className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.name}</p>
                <p className="text-xs text-muted-foreground">{row.time}</p>
              </div>
              <p translate="no" className={`shrink-0 text-sm font-semibold tabular-nums ${row.pos ? "text-primary" : "text-foreground"}`}>
                {row.pos ? "+" : ""}{row.amount.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-6 mt-6 flex items-center justify-between rounded-2xl border border-border/60 bg-surface/60 p-4">
        <div>
          <p className="text-xs font-semibold">{t("home.earnCta.title")}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{t("home.earnCta.sub")}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </MobileShell>
  );
}

function MiniStat({ to, label, value, tone }: { to: "/assets/digital" | "/assets/fiat" | "/assets/cards"; label: string; value: string; tone?: "accent" }) {
  return (
    <Link to={to} className="group rounded-2xl bg-background/40 p-3 text-left backdrop-blur transition-all active:scale-95 hover:bg-background/60">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p translate="no" className={`mt-1 font-display text-sm font-semibold tabular-nums ${tone === "accent" ? "text-accent" : ""}`}>{value}</p>
      <p className="mt-1 text-[9px] uppercase tracking-widest text-primary opacity-70 group-hover:opacity-100">→</p>
    </Link>
  );
}
