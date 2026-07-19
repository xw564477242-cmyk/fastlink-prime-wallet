import { createFileRoute } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { QrCode, ScanLine, Store, Wallet, CreditCard, Coins, Check } from "lucide-react";
import { useState } from "react";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/merchant-pay")({
  head: () => ({
    meta: [
      { title: "FastLink — Merchant Pay" },
      {
        name: "description",
        content: "Pay merchants by scanning a QR code with USDT, fiat or your FastLink card.",
      },
    ],
  }),
  component: MerchantPayPage,
});

function MerchantPayPage() {
  const { t } = useLang();
  const [scanned, setScanned] = useState(false);
  const [source, setSource] = useState<"usdt" | "fiat" | "card">("usdt");

  const FUNDING = [
    { key: "usdt" as const, label: t("mp.usdtWallet"), sub: t("mp.usdtBal"), icon: Coins },
    { key: "fiat" as const, label: t("mp.fiatWallet"), sub: t("mp.fiatBal"), icon: Wallet },
    { key: "card" as const, label: t("mp.cardWallet"), sub: "•••• 4829", icon: CreditCard },
  ];

  return (
    <MobileShell>
      <StatusBar title={t("page.merchantPay")} />
      <div className="px-6 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {t("mp.tag")}
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold">{t("mp.title")}</h1>

        {!scanned ? (
          <button
            onClick={() => setScanned(true)}
            className="mt-6 flex w-full flex-col items-center gap-3 rounded-3xl border border-dashed border-primary/40 bg-primary/5 px-6 py-10"
          >
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/15 text-primary">
              <ScanLine className="h-8 w-8" />
            </div>
            <p className="font-display text-sm font-semibold">{t("mp.scan")}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("mp.scanAlign")}
            </p>
          </button>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-4 rounded-3xl border border-border/60 bg-surface/60 p-5">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent/15 text-accent">
                <Store className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t("mp.merchant")}
                </p>
                <p translate="no" className="truncate text-base font-semibold">
                  Uniqlo · Ion Orchard
                </p>
                <p
                  translate="no"
                  className="text-[10px] uppercase tracking-widest text-muted-foreground"
                >
                  Order #FL-88231
                </p>
              </div>
              <button
                onClick={() => setScanned(false)}
                className="text-[10px] font-semibold uppercase text-primary"
              >
                {t("common.change")}
              </button>
            </div>

            <div className="rounded-3xl border border-border/60 bg-surface/60 p-5">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {t("mp.order")}
              </p>
              <p translate="no" className="mt-1 font-display text-3xl font-bold tabular-nums">
                $128.40
              </p>
              <div className="mt-4 space-y-1.5 border-t border-border/60 pt-3">
                <Row label="AIRism Cotton Tee ×2" value="$39.80" />
                <Row label="Ultra Light Down Jacket" value="$88.60" />
                <Row label="GST 8%" value="$9.51" />
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                {t("mp.funding")}
              </p>
              <div className="space-y-2">
                {FUNDING.map((f) => {
                  const on = f.key === source;
                  const Icon = f.icon;
                  return (
                    <button
                      key={f.key}
                      onClick={() => setSource(f.key)}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${on ? "border-primary bg-primary/10" : "border-border/60 bg-surface/60"}`}
                    >
                      <div
                        className={`grid h-10 w-10 place-items-center rounded-xl ${on ? "bg-primary/20 text-primary" : "bg-background/60 text-muted-foreground"}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{f.label}</p>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          {f.sub}
                        </p>
                      </div>
                      {on && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <button className="mb-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3 font-display text-sm font-semibold text-primary-foreground shadow-glow">
              <QrCode className="h-4 w-4" />{" "}
              <span translate="no">{t("mp.confirm", { amt: "128.40" })}</span>
            </button>
          </div>
        )}
      </div>
    </MobileShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span translate="no" className="text-[11px] text-muted-foreground">
        {label}
      </span>
      <span translate="no" className="text-xs font-semibold tabular-nums">
        {value}
      </span>
    </div>
  );
}
