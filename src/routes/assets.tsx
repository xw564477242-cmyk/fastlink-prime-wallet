import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  CreditCard,
  Plane,
  Wallet,
  Sparkles,
  ChevronRight,
  Plus,
  Eye,
  EyeOff,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/assets")({
  head: () => ({
    meta: [
      { title: "FastLink — Assets" },
      { name: "description", content: "Digital stablecoins, multi-currency fiat and card balances in one dashboard." },
    ],
  }),
  component: AssetsPage,
});

const digital = [
  { sym: "USDT", name: "Tether", bal: "10,204.15", usd: "10,204.15", change: "+0.01%" },
  { sym: "USDC", name: "USD Coin", bal: "4,120.00", usd: "4,120.00", change: "0.00%" },
];

const fiat = [
  { sym: "USD", name: "US Dollar", bal: "5,240.00", flag: "🇺🇸", usd: "5,240.00" },
  { sym: "SGD", name: "Singapore Dollar", bal: "3,180.40", flag: "🇸🇬", usd: "2,352.94" },
  { sym: "MYR", name: "Malaysian Ringgit", bal: "8,420.10", flag: "🇲🇾", usd: "1,782.30" },
  { sym: "EUR", name: "Euro", bal: "2,180.50", flag: "🇪🇺", usd: "2,373.23" },
];

const cardBal = [
  { key: "virtual", label: "Virtual Card", last4: "4829", icon: Sparkles, bal: "1,842.60", tint: "from-primary/20 to-primary/5", stripe: "bg-primary" },
  { key: "physical", label: "Physical Card", last4: "9130", icon: Wallet, bal: "620.40", tint: "from-accent/20 to-accent/5", stripe: "bg-accent" },
  { key: "travel", label: "Travel Card", last4: "2246", icon: Plane, bal: "980.00", tint: "from-sky-500/20 to-sky-500/5", stripe: "bg-sky-400" },
];

function AssetsPage() {
  const [hidden, setHidden] = useState(false);
  const hide = (s: string) => (hidden ? "•••••" : s);

  return (
    <MobileShell>
      <StatusBar title="Assets" />

      {/* Portfolio header */}
      <div className="px-6 pt-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Portfolio Value · USD
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="font-display text-4xl font-bold tabular-nums">
                {hidden ? "••••••" : "$29,715.62"}
              </p>
              <button onClick={() => setHidden((v) => !v)} className="text-muted-foreground">
                {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="text-primary">+$412.90</span> · past 30 days
            </p>
          </div>
        </div>

        {/* Composition bar */}
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

      {/* Section 1: Digital Assets */}
      <Section index="01" title="Digital Assets" hint={`$${hide("14,324.15")}`} action={{ label: "Add", to: "/convert" as const }}>
        <div className="space-y-2 px-6">
          {digital.map((a) => (
            <div key={a.sym} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/60 p-4">
              <StablecoinBadge sym={a.sym} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{a.sym}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{a.name}</p>
                </div>
                <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                  {hide(a.bal)} {a.sym}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">${hide(a.usd)}</p>
                <p className="text-[10px] tabular-nums text-primary">{a.change}</p>
              </div>
            </div>
          ))}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <MiniAction to="/deposit" icon={ArrowDownToLine} label="Deposit" />
            <MiniAction to="/withdraw" icon={ArrowUpFromLine} label="Withdraw" />
            <MiniAction to="/convert" icon={ArrowLeftRight} label="Convert" />
          </div>
        </div>
      </Section>

      {/* Section 2: Fiat Wallets */}
      <Section index="02" title="Fiat Wallets" hint="4 currencies" action={{ label: "Add", to: "/convert" as const }}>
        <div className="space-y-2 px-6">
          {fiat.map((a) => (
            <div key={a.sym} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/60 p-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-background text-lg">
                {a.flag}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{a.sym}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{a.name}</p>
                </div>
                <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                  {hide(a.bal)} {a.sym}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">${hide(a.usd)}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">USD eq.</p>
              </div>
            </div>
          ))}
          <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 py-3 text-[11px] font-semibold text-muted-foreground">
            <Plus className="h-3.5 w-3.5" /> Open new currency wallet
          </button>
        </div>
      </Section>

      {/* Section 3: Card Balances */}
      <Section index="03" title="Card Balances" hint={`$${hide("3,443.00")}`} action={{ label: "Manage", to: "/cards" as const }}>
        <div className="space-y-2 px-6">
          {cardBal.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.key}
                to="/cards"
                className={`flex items-center gap-3 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-r ${c.tint} p-4 active:scale-[0.99]`}
              >
                <div className={`h-11 w-1 shrink-0 rounded-full ${c.stripe}`} />
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-background/60 backdrop-blur">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{c.label}</p>
                  <p translate="no" className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    •••• {c.last4}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">${hide(c.bal)}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Available</p>
                </div>
              </Link>
            );
          })}
        </div>
      </Section>

      {/* Footer meta */}
      <div className="mx-6 mt-8 mb-4 flex items-center justify-between border-t border-border/60 pt-4 text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>FastLink Global · Treasury</span>
        <span translate="no">v1.4 · SGT</span>
      </div>
    </MobileShell>
  );
}

function Section({
  index,
  title,
  hint,
  action,
  children,
}: {
  index: string;
  title: string;
  hint?: string;
  action?: { label: string; to: "/convert" | "/cards" };
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-end justify-between px-6">
        <div className="flex items-center gap-3">
          <span translate="no" className="font-mono text-[10px] font-semibold tracking-widest text-primary">
            {index}
          </span>
          <h2 className="font-display text-lg font-bold">{title}</h2>
          {hint && <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{hint}</span>}
        </div>
        {action && (
          <Link to={action.to} className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary">
            {action.label} <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function MiniAction({ to, icon: Icon, label }: { to: "/pay" | "/convert"; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-1.5 rounded-2xl bg-surface/60 py-3 text-[11px] font-medium active:scale-95">
      <Icon className="h-4 w-4 text-primary" />
      {label}
    </Link>
  );
}

function StablecoinBadge({ sym }: { sym: string }) {
  const color = sym === "USDT" ? "bg-primary/15 text-primary" : "bg-sky-500/15 text-sky-400";
  return (
    <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl font-display text-[10px] font-bold ${color}`}>
      {sym}
    </div>
  );
}
