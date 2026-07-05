import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import {
  Coins,
  Landmark,
  CreditCard,
  ChevronRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/assets")({
  head: () => ({
    meta: [
      { title: "FastLink — Assets" },
      { name: "description", content: "Overview of digital, fiat and card asset categories." },
    ],
  }),
  component: AssetsPage,
});

type Category = {
  key: string;
  to: "/assets/digital" | "/assets/fiat" | "/assets/cards";
  title: string;
  subtitle: string;
  count: string;
  total: string;
  delta?: string;
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
  stripe: string;
};

const categories: Category[] = [
  {
    key: "digital",
    to: "/assets/digital",
    title: "Digital Assets",
    subtitle: "Stablecoins & crypto",
    count: "4 coins",
    total: "14,324.15",
    delta: "+$92.10 · 24h",
    icon: Coins,
    tint: "from-primary/20 to-primary/5",
    stripe: "bg-primary",
  },
  {
    key: "fiat",
    to: "/assets/fiat",
    title: "Fiat Wallets",
    subtitle: "Multi-currency accounts",
    count: "4 currencies",
    total: "11,748.47",
    icon: Landmark,
    tint: "from-accent/20 to-accent/5",
    stripe: "bg-accent",
  },
  {
    key: "cards",
    to: "/assets/cards",
    title: "Card Accounts",
    subtitle: "Virtual & physical cards",
    count: "3 cards",
    total: "3,443.00",
    icon: CreditCard,
    tint: "from-sky-500/20 to-sky-500/5",
    stripe: "bg-sky-400",
  },
];

function AssetsPage() {
  const [hidden, setHidden] = useState(false);
  const hide = (s: string) => (hidden ? "•••••" : s);

  return (
    <MobileShell>
      <StatusBar title="Assets" />

      <div className="px-6 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Portfolio Value · USD
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <p className="font-display text-4xl font-bold tabular-nums">
            {hidden ? "••••••" : "$29,515.62"}
          </p>
          <button onClick={() => setHidden((v) => !v)} className="text-muted-foreground">
            {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="text-primary">+$412.90</span> · past 30 days
        </p>

        <div className="mt-5 flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-[48%] bg-primary" />
          <div className="h-full w-[40%] bg-accent" />
          <div className="h-full w-[12%] bg-sky-400" />
        </div>
        <div className="mt-2 grid grid-cols-3 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />Digital 48%</span>
          <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />Fiat 40%</span>
          <span className="text-right sm:text-left"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-sky-400 align-middle" />Cards 12%</span>
        </div>
      </div>

      <div className="mt-6 space-y-3 px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Asset Categories
        </p>
        {categories.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.key}
              to={c.to}
              className={`flex items-center gap-3 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-r ${c.tint} p-4 active:scale-[0.99] transition-transform`}
            >
              <div className={`h-12 w-1 shrink-0 rounded-full ${c.stripe}`} />
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-background/60 backdrop-blur">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{c.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {c.subtitle} · {c.count}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">${hide(c.total)}</p>
                <p className="text-[10px] tabular-nums text-primary">{c.delta ?? "USD eq."}</p>
              </div>
              <ChevronRight className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          );
        })}
      </div>

      <div className="mx-6 mt-8 mb-4 flex items-center justify-between border-t border-border/60 pt-4 text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>FastLink Global · Treasury</span>
        <span translate="no">v1.4 · SGT</span>
      </div>
    </MobileShell>
  );
}
