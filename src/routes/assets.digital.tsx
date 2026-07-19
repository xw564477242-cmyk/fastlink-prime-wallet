import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, ChevronLeft, Plus } from "lucide-react";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/assets/digital")({
  head: () => ({
    meta: [
      { title: "FastLink — Digital Assets" },
      { name: "description", content: "All crypto asset balances in one view." },
    ],
  }),
  component: DigitalAssetsPage,
});

const assets = [
  { sym: "USDT", bal: "10,204.15", usd: "10,204.15", change: "+0.01%", chain: "TRC20 · ERC20" },
  { sym: "USDC", bal: "4,120.00", usd: "4,120.00", change: "0.00%", chain: "ERC20" },
  { sym: "BTC", bal: "0.0000", usd: "0.00", change: "—", chain: "BTC" },
  { sym: "ETH", bal: "0.0000", usd: "0.00", change: "—", chain: "ERC20" },
];

function DigitalAssetsPage() {
  const { t } = useLang();
  return (
    <MobileShell>
      <StatusBar title={t("assets.digital.title")} />
      <div className="flex items-center justify-between px-6 pt-2">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> {t("nav.home")}
        </Link>
        <Link to="/assets/fiat" className="text-xs font-semibold text-primary">
          {t("assets.linkFiat")}
        </Link>
      </div>

      <div className="px-6 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {t("assets.digital.total")}
        </p>
        <p translate="no" className="mt-2 font-display text-4xl font-bold tabular-nums">
          $14,324.15
        </p>
        <p translate="no" className="mt-1 text-xs text-primary">
          {t("assets.digital.change24h")}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2 px-6">
        <Action to="/deposit" icon={ArrowDownToLine} label={t("home.deposit")} />
        <Action to="/withdraw" icon={ArrowUpFromLine} label={t("home.withdraw")} />
        <Action to="/convert" icon={ArrowLeftRight} label={t("home.convert")} />
      </div>

      <div className="mt-6 space-y-2 px-6">
        {assets.map((a) => (
          <div
            key={a.sym}
            className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/60 p-4"
          >
            <div
              translate="no"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/15 font-display text-[10px] font-bold text-primary"
            >
              {a.sym}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p translate="no" className="text-sm font-semibold">
                  {a.sym}
                </p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t(`cur.${a.sym}`)}
                </p>
              </div>
              <p translate="no" className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                {a.chain}
              </p>
            </div>
            <div className="text-right">
              <p translate="no" className="text-sm font-semibold tabular-nums">
                ${a.usd}
              </p>
              <p translate="no" className="text-[10px] tabular-nums text-primary">
                {a.change}
              </p>
            </div>
          </div>
        ))}
        <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 py-3 text-[11px] font-semibold text-muted-foreground">
          <Plus className="h-3.5 w-3.5" /> {t("assets.digital.add")}
        </button>
      </div>
      <div className="h-8" />
    </MobileShell>
  );
}

function Action({
  to,
  icon: Icon,
  label,
}: {
  to: "/deposit" | "/withdraw" | "/convert";
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-1.5 rounded-2xl bg-surface/60 py-3 text-[11px] font-medium active:scale-95"
    >
      <Icon className="h-4 w-4 text-primary" />
      {label}
    </Link>
  );
}
