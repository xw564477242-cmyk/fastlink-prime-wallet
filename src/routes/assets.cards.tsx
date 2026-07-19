import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Loader2, Plane, Plus, Sparkles, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import type { CardType, ThreddCard } from "@/integrations/thredd/thredd.types";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/assets/cards")({
  head: () => ({
    meta: [
      { title: "FastLink — Card Accounts" },
      { name: "description", content: "All FastLink card accounts and available balances." },
    ],
  }),
  component: CardAccountsPage,
});

const META: Record<
  CardType,
  { labelKey: string; icon: typeof Sparkles; tint: string; stripe: string }
> = {
  virtual: {
    labelKey: "card.virtual",
    icon: Sparkles,
    tint: "from-primary/20 to-primary/5",
    stripe: "bg-primary",
  },
  physical: {
    labelKey: "card.physical",
    icon: Wallet,
    tint: "from-accent/20 to-accent/5",
    stripe: "bg-accent",
  },
  travel: {
    labelKey: "card.travel",
    icon: Plane,
    tint: "from-sky-500/20 to-sky-500/5",
    stripe: "bg-sky-400",
  },
};

function CardAccountsPage() {
  const { t } = useLang();
  const [cards, setCards] = useState<ThreddCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { authFetch } = await import("@/lib/authFetch");
        const response = await authFetch("/api/card/list");
        const body = (await response.json()) as { cards?: ThreddCard[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
        if (!cancelled) setCards(body.cards ?? []);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : t("cards.loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const totals = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const card of cards)
      grouped.set(card.currency, (grouped.get(card.currency) ?? 0) + card.balance);
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [cards]);

  return (
    <MobileShell>
      <StatusBar title={t("assets.cards.title")} />
      <div className="flex items-center justify-between px-6 pt-2">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> {t("nav.home")}
        </Link>
        <Link to="/cards" className="text-xs font-semibold text-primary">
          {t("assets.cards.manage")}
        </Link>
      </div>

      <div className="px-6 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {t("assets.cards.total")}
        </p>
        <div translate="no" className="mt-2 space-y-1 font-display text-4xl font-bold tabular-nums">
          {(totals.length ? totals : [["USD", 0] as const]).map(([currency, total]) => (
            <p key={currency}>
              {currency}{" "}
              {total.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("assets.cards.count", { n: cards.length })}
        </p>
      </div>

      <div className="mt-6 space-y-2 px-6">
        {loading && (
          <div className="grid place-items-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        {!loading && error && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive">
            {error}
          </div>
        )}
        {!loading &&
          !error &&
          cards.map((card) => {
            const meta = META[card.type];
            const Icon = meta.icon;
            return (
              <Link
                key={card.cardId}
                to="/cards"
                search={{ cardId: card.cardId }}
                className={`flex items-center gap-3 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-r ${meta.tint} p-4 active:scale-[0.99]`}
              >
                <div className={`h-11 w-1 shrink-0 rounded-full ${meta.stripe}`} />
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-background/60">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{card.alias ?? t(meta.labelKey)}</p>
                  <p
                    translate="no"
                    className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
                  >
                    •••• {card.last4}
                  </p>
                </div>
                <div className="text-right">
                  <p translate="no" className="text-sm font-semibold tabular-nums">
                    {card.balance.toFixed(2)} {card.currency}
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {t("common.available")}
                  </p>
                </div>
              </Link>
            );
          })}
        {!loading && !error && cards.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-xs text-muted-foreground">
            {t("cards.noCards")}
          </div>
        )}
        <Link
          to="/cards"
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 py-3 text-[11px] font-semibold text-muted-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> {t("assets.cards.apply")}
        </Link>
      </div>
      <div className="h-8" />
    </MobileShell>
  );
}
