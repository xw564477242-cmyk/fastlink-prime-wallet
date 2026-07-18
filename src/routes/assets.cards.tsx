import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { ChevronLeft, Sparkles, Wallet, Plane, Plus } from "lucide-react";
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

const cardBal = [
  { key: "virtual", labelKey: "card.virtual", last4: "4829", icon: Sparkles, bal: "1,842.60", tint: "from-primary/20 to-primary/5", stripe: "bg-primary" },
  { key: "physical", labelKey: "card.physical", last4: "9130", icon: Wallet, bal: "620.40", tint: "from-accent/20 to-accent/5", stripe: "bg-accent" },
  { key: "travel", labelKey: "card.travel", last4: "2246", icon: Plane, bal: "980.00", tint: "from-sky-500/20 to-sky-500/5", stripe: "bg-sky-400" },
];

function CardAccountsPage() {
  const { t } = useLang();
  return (
    <MobileShell>
      <StatusBar title={t("assets.cards.title")} />
      <div className="flex items-center justify-between px-6 pt-2">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> {t("nav.home")}
        </Link>
        <Link to="/cards" className="text-xs font-semibold text-primary">{t("assets.cards.manage")}</Link>
      </div>

      <div className="px-6 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {t("assets.cards.total")}
        </p>
        <p translate="no" className="mt-2 font-display text-4xl font-bold tabular-nums">$3,443.00</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("assets.cards.count", { n: cardBal.length })}</p>
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
                <p className="text-sm font-semibold">{t(c.labelKey)}</p>
                <p translate="no" className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  •••• {c.last4} · <span translate="yes">{t("card.status.active")}</span>
                </p>
              </div>
              <div className="text-right">
                <p translate="no" className="text-sm font-semibold tabular-nums">${c.bal}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("common.available")}</p>
              </div>
            </Link>
          );
        })}
        <Link to="/cards" className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 py-3 text-[11px] font-semibold text-muted-foreground">
          <Plus className="h-3.5 w-3.5" /> {t("assets.cards.apply")}
        </Link>
      </div>
      <div className="h-8" />
    </MobileShell>
  );
}
