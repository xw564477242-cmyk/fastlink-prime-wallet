import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { ChevronLeft, Sparkles, Wallet, Plane, Plus } from "lucide-react";

export const Route = createFileRoute("/assets/cards")({
  head: () => ({
    meta: [
      { title: "FastLink — Card Accounts" },
      { name: "description", content: "All FastLink card accounts and available balances." },
    ],
  }),
  component: CardAccountsPage,
});

const cardBal = [
  { key: "virtual", label: "Virtual Card", last4: "4829", icon: Sparkles, bal: "1,842.60", tint: "from-primary/20 to-primary/5", stripe: "bg-primary", status: "Active" },
  { key: "physical", label: "Physical Card", last4: "9130", icon: Wallet, bal: "620.40", tint: "from-accent/20 to-accent/5", stripe: "bg-accent", status: "Active" },
  { key: "travel", label: "Travel Card", last4: "2246", icon: Plane, bal: "980.00", tint: "from-sky-500/20 to-sky-500/5", stripe: "bg-sky-400", status: "Active" },
];

function CardAccountsPage() {
  return (
    <MobileShell>
      <StatusBar title="Card Accounts" />
      <div className="flex items-center justify-between px-6 pt-2">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Home
        </Link>
        <Link to="/cards" className="text-xs font-semibold text-primary">Manage Cards</Link>
      </div>

      <div className="px-6 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Total · Card Balance
        </p>
        <p className="mt-2 font-display text-4xl font-bold tabular-nums">$3,443.00</p>
        <p className="mt-1 text-xs text-muted-foreground">{cardBal.length} cards</p>
      </div>

      <div className="mt-6 space-y-2 px-6">
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
                  •••• {c.last4} · {c.status}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">${c.bal}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Available</p>
              </div>
            </Link>
          );
        })}
        <Link to="/cards" className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 py-3 text-[11px] font-semibold text-muted-foreground">
          <Plus className="h-3.5 w-3.5" /> Apply for new card
        </Link>
      </div>
      <div className="h-8" />
    </MobileShell>
  );
}
