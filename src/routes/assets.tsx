import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { useLang } from "@/lib/i18n";
import {
  Coins,
  Landmark,
  CreditCard,
  ChevronRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/assets")({
  head: () => ({
    meta: [
      { title: "FastLink — Assets" },
      { name: "description", content: "All your digital, fiat and card balances in one place." },
    ],
  }),
  component: AssetsPage,
});

type CategoryTo = "/assets/digital" | "/assets/fiat" | "/assets/cards";

function AssetsPage() {
  const { t } = useLang();
  const [hidden, setHidden] = useState(false);

  const categories: {
    to: CategoryTo;
    labelKey: string;
    subKey: string;
    value: string;
    icon: typeof Coins;
    tint: string;
    stripe: string;
  }[] = [
    {
      to: "/assets/digital",
      labelKey: "assets.digital.title",
      subKey: "assets.digital.sub",
      value: "$19,844.15",
      icon: Coins,
      tint: "from-primary/20 to-primary/5",
      stripe: "bg-primary",
    },
    {
      to: "/assets/fiat",
      labelKey: "assets.fiat.title",
      subKey: "assets.fiat.sub",
      value: "$11,748.47",
      icon: Landmark,
      tint: "from-sky-500/20 to-sky-500/5",
      stripe: "bg-sky-400",
    },
    {
      to: "/assets/cards",
      labelKey: "assets.cards.title",
      subKey: "assets.cards.sub",
      value: "$3,443.00",
      icon: CreditCard,
      tint: "from-accent/20 to-accent/5",
      stripe: "bg-accent",
    },
  ];

  return (
    <MobileShell>
      <StatusBar title={t("assets.title")} />

      <div className="px-6 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {t("assets.tag")}
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold">{t("assets.h1")}</h1>
      </div>

      {/* Total balance */}
      <div className="mx-6 mt-5 rounded-3xl bg-gradient-card p-6 shadow-card">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {t("home.totalBalance")}
          </p>
          <button
            onClick={() => setHidden((v) => !v)}
            className="text-muted-foreground"
            aria-label="toggle balance"
          >
            {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div translate="no" className="mt-3 font-display text-4xl font-bold tracking-tight tabular-nums">
          {hidden ? "••••••" : "$35,035.62"}
        </div>
        <p className="mt-1 text-[11px] text-primary">{t("assets.totalHint")}</p>
      </div>

      {/* Quick actions */}
      <div className="mx-6 mt-5 grid grid-cols-3 gap-2">
        <QuickAction to="/deposit" icon={ArrowDownToLine} label={t("home.deposit")} />
        <QuickAction to="/withdraw" icon={ArrowUpFromLine} label={t("home.withdraw")} />
        <QuickAction to="/convert" icon={ArrowLeftRight} label={t("home.convert")} />
      </div>

      {/* Category entries */}
      <div className="mx-6 mt-6 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {t("assets.categories")}
        </p>
        {categories.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.to}
              to={c.to}
              className={`group flex items-center gap-3 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-r ${c.tint} p-4 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-glow active:scale-[0.98]`}
            >
              <div className={`h-12 w-1 shrink-0 rounded-full ${c.stripe}`} />
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-background/60 text-primary backdrop-blur">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t(c.labelKey)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{t(c.subKey)}</p>
              </div>
              <div className="text-right">
                <p translate="no" className="text-sm font-semibold tabular-nums">
                  {hidden ? "••••" : c.value}
                </p>
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
                  {t("common.available")}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          );
        })}
      </div>

      <div className="h-8" />
    </MobileShell>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
}: {
  to: "/deposit" | "/withdraw" | "/convert";
  icon: typeof Coins;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-2 rounded-2xl bg-surface py-4 transition-transform active:scale-95"
    >
      <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-[11px] font-medium">{label}</span>
    </Link>
  );
}
