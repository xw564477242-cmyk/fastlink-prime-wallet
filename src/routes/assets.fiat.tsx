import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { ChevronLeft, Plus, ArrowLeftRight } from "lucide-react";
import { useLang } from "@/lib/i18n";

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
  { sym: "USD", bal: "5,240.00", flag: "🇺🇸", usd: "5,240.00" },
  { sym: "SGD", bal: "3,180.40", flag: "🇸🇬", usd: "2,352.94" },
  { sym: "MYR", bal: "8,420.10", flag: "🇲🇾", usd: "1,782.30" },
  { sym: "EUR", bal: "2,180.50", flag: "🇪🇺", usd: "2,373.23" },
];

function FiatWalletsPage() {
  const { t } = useLang();
  return (
    <MobileShell>
      <StatusBar title={t("assets.fiat.title")} />
      <div className="flex items-center justify-between px-6 pt-2">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> {t("nav.home")}
        </Link>
        <Link to="/assets/cards" className="text-xs font-semibold text-primary">{t("assets.linkCards")}</Link>
      </div>

      <div className="px-6 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {t("assets.fiat.total")}
        </p>
        <p translate="no" className="mt-2 font-display text-4xl font-bold tabular-nums">$11,748.47</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("assets.fiat.count", { n: fiat.length })}</p>
      </div>

      <div className="mt-6 px-6">
        <Link to="/convert" className="flex items-center justify-center gap-2 rounded-2xl bg-primary/15 py-3 text-xs font-semibold text-primary">
          <ArrowLeftRight className="h-4 w-4" /> {t("assets.fiat.convertCurrency")}
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
                <p translate="no" className="text-sm font-semibold">{a.sym}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{t(`cur.${a.sym}`)}</p>
              </div>
              <p translate="no" className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{a.bal} {a.sym}</p>
            </div>
            <div className="text-right">
              <p translate="no" className="text-sm font-semibold tabular-nums">${a.usd}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("assets.fiat.usdEq")}</p>
            </div>
          </div>
        ))}
        <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 py-3 text-[11px] font-semibold text-muted-foreground">
          <Plus className="h-3.5 w-3.5" /> {t("assets.fiat.openNew")}
        </button>
      </div>
      <div className="h-8" />
    </MobileShell>
  );
}
