import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { ActionModal, type ActionState } from "@/components/ActionModal";
import { CreditCard, Wifi, Store } from "lucide-react";
import { useState } from "react";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/card-pay")({
  head: () => ({
    meta: [
      { title: "FastLink — Pay with Card" },
      { name: "description", content: "Mock card checkout simulating a merchant terminal." },
    ],
  }),
  component: CardPayPage,
});

const MERCHANTS = [
  { name: "Uniqlo Tokyo", amount: 48.2, category: "Fashion" },
  { name: "Blue Bottle Coffee", amount: 6.85, category: "Food & Drink" },
  { name: "Apple Store", amount: 128.9, category: "Electronics" },
  { name: "Grab Ride", amount: 12.4, category: "Transport" },
];

function CardPayPage() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [merchant, setMerchant] = useState(MERCHANTS[0]);
  const [modal, setModal] = useState<ActionState>("idle");

  const pay = () => {
    setModal("pending");
    setTimeout(() => setModal("success"), 1200);
  };

  return (
    <MobileShell>
      <StatusBar title={t("page.cardPay")} />
      <div className="px-6 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {t("cp.tag")}
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold">{t("cp.title")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t("cp.desc")}</p>

        <div className="mt-5 space-y-2">
          {MERCHANTS.map((m) => {
            const on = m.name === merchant.name;
            return (
              <button
                key={m.name}
                onClick={() => setMerchant(m)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${on ? "border-primary bg-primary/10" : "border-border/60 bg-surface/60"}`}
              >
                <div className={`grid h-10 w-10 place-items-center rounded-xl ${on ? "bg-primary text-primary-foreground" : "bg-background text-primary"}`}>
                  <Store className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p translate="no" className="truncate text-sm font-semibold">{m.name}</p>
                  <p translate="no" className="text-[10px] uppercase tracking-widest text-muted-foreground">{m.category}</p>
                </div>
                <p translate="no" className="font-semibold tabular-nums">${m.amount.toFixed(2)}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-6 rounded-3xl border border-border/60 bg-surface/60 p-6 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary/10 text-primary">
            <Wifi className="h-9 w-9 rotate-90" />
          </div>
          <p className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">{t("cp.amountDue")}</p>
          <p translate="no" className="mt-1 font-display text-3xl font-bold tabular-nums">${merchant.amount.toFixed(2)}</p>
          <p translate="no" className="mt-1 text-xs text-muted-foreground">{merchant.name}</p>
        </div>

        <button
          onClick={pay}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3 font-display text-sm font-semibold text-primary-foreground shadow-glow"
        >
          <CreditCard className="h-4 w-4" /> {t("cp.tapPay")}
        </button>
      </div>

      <ActionModal
        open={modal !== "idle"}
        onClose={() => setModal("idle")}
        state={modal}
        title={modal === "success" ? t("cp.approved") : t("cp.confirmTitle")}
        description={
          modal === "success"
            ? t("cp.paidTo", { amt: merchant.amount.toFixed(2), name: merchant.name })
            : t("cp.charge", { amt: merchant.amount.toFixed(2) })
        }
        rows={[
          { label: t("cp.merchant"), value: <span translate="no">{merchant.name}</span> },
          { label: t("common.amount"), value: <span translate="no">${merchant.amount.toFixed(2)}</span> },
          { label: t("cp.card"), value: <span translate="no">Virtual •• 4829</span> },
        ]}
        confirmLabel={t("cp.payNow")}
        onConfirm={pay}
        successLabel={t("common.viewHistory")}
        onSuccess={() => {
          setModal("idle");
          navigate({ to: "/history" });
        }}
      />
    </MobileShell>
  );
}
