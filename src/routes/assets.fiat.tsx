import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { ChevronLeft, Plus, ArrowLeftRight } from "lucide-react";

export const Route = createFileRoute("/assets/fiat")({
  head: () => ({
    meta: [
      { title: "FastLink — Fiat Wallets" },
      { name: "description", content: "Multi-currency fiat wallets and balances." },
    ],
  }),
  component: FiatWalletsPage,
});

const fiat = [
  { sym: "USD", name: "US Dollar", bal: "5,240.00", flag: "🇺🇸", usd: "5,240.00" },
  { sym: "SGD", name: "Singapore Dollar", bal: "3,180.40", flag: "🇸🇬", usd: "2,352.94" },
  { sym: "MYR", name: "Malaysian Ringgit", bal: "8,420.10", flag: "🇲🇾", usd: "1,782.30" },
  { sym: "EUR", name: "Euro", bal: "2,180.50", flag: "🇪🇺", usd: "2,373.23" },
];

function FiatWalletsPage() {
  return (
    <MobileShell>
      <StatusBar title="Fiat Wallets" />
      <div className="flex items-center justify-between px-6 pt-2">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Home
        </Link>
        <Link to="/assets" className="text-xs font-semibold text-primary">All Assets</Link>
      </div>

      <div className="px-6 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Total · Fiat (USD eq.)
        </p>
        <p className="mt-2 font-display text-4xl font-bold tabular-nums">$11,748.47</p>
        <p className="mt-1 text-xs text-muted-foreground">4 currencies</p>
      </div>

      <div className="mt-6 px-6">
        <Link to="/convert" className="flex items-center justify-center gap-2 rounded-2xl bg-primary/15 py-3 text-xs font-semibold text-primary">
          <ArrowLeftRight className="h-4 w-4" /> Convert currency
        </Link>
      </div>

      <div className="mt-6 space-y-2 px-6">
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
              <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{a.bal} {a.sym}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums">${a.usd}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">USD eq.</p>
            </div>
          </div>
        ))}
        <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 py-3 text-[11px] font-semibold text-muted-foreground">
          <Plus className="h-3.5 w-3.5" /> Open new currency wallet
        </button>
      </div>
      <div className="h-8" />
    </MobileShell>
  );
}
