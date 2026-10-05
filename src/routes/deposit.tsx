import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Loader2, WalletCards } from "lucide-react";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { useBackendSession } from "@/lib/backend-session";
import { useCardListPages } from "@/hooks/use-card-list-pages";

export const Route = createFileRoute("/deposit")({
  component: DepositPage,
});

function DepositPage() {
  const { session } = useBackendSession();
  const cards = useCardListPages(session, null);
  const selected = cards.cards.find((card) => card.cardId === cards.activeId) ?? cards.cards[0];

  return (
    <MobileShell>
      <StatusBar title="USDT Deposit" />
      <div className="px-6 pt-4">
        <h1 className="font-display text-2xl font-bold">USDT deposit fee</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Read-only Phase-1 Card pricing returned by Railway Backend.
        </p>
        {cards.loading && (
          <div className="mt-6 flex items-center gap-2 rounded-2xl border border-border/60 p-4 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading Card pricing
          </div>
        )}
        {!cards.loading && cards.error && (
          <div className="mt-6 flex gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{cards.error} · No stale fee displayed.</span>
          </div>
        )}
        {!cards.loading && !cards.error && selected && (
          <section className="mt-6 rounded-2xl border border-border/60 bg-surface p-5">
            <div className="flex items-center gap-3">
              <WalletCards className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-semibold">{selected.alias ?? `${selected.type} Card`}</p>
                <p className="text-[10px] text-muted-foreground">
                  {selected.cardId} · •••• {selected.last4}
                </p>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-[1fr_auto] gap-y-3 text-xs">
              <dt className="text-muted-foreground">Effective USDT deposit fee</dt>
              <dd className="font-semibold tabular-nums">
                {selected.effectiveFees
                  ? `${selected.effectiveFees.usdtDepositRate}%`
                  : "Unavailable"}
              </dd>
              <dt className="text-muted-foreground">Settlement currency</dt>
              <dd className="font-semibold">{selected.currency}</dd>
              <dt className="text-muted-foreground">Fee template</dt>
              <dd className="font-semibold">
                {selected.effectiveFees?.templateId ?? "Unavailable"}
              </dd>
            </dl>
          </section>
        )}
      </div>
    </MobileShell>
  );
}
