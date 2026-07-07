import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { ActionModal, type ActionState } from "@/components/ActionModal";
import { QrCode, Send, Store, Banknote, Scan, Download, Search, ChevronRight, Copy, CreditCard } from "lucide-react";
import { useState } from "react";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/pay")({
  head: () => ({
    meta: [
      { title: "FastLink — Pay Center" },
      { name: "description", content: "Receive, pay, scan, transfer, merchant pay and payout — one center." },
    ],
  }),
  component: PayPage,
});

type Mode = "receive" | "pay-qr" | "scan" | "transfer" | "merchant" | "payout";

const modes: { key: Mode; labelKey: string; icon: React.ComponentType<{ className?: string }>; subKey: string }[] = [
  { key: "receive", labelKey: "pay.mode.receive", icon: Download, subKey: "pay.mode.receiveSub" },
  { key: "pay-qr", labelKey: "pay.mode.payqr", icon: QrCode, subKey: "pay.mode.payqrSub" },
  { key: "scan", labelKey: "pay.mode.scan", icon: Scan, subKey: "pay.mode.scanSub" },
  { key: "transfer", labelKey: "pay.mode.transfer", icon: Send, subKey: "pay.mode.transferSub" },
  { key: "merchant", labelKey: "pay.mode.merchant", icon: Store, subKey: "pay.mode.merchantSub" },
  { key: "payout", labelKey: "pay.mode.payout", icon: Banknote, subKey: "pay.mode.payoutSub" },
];

const history = [
  { name: "Uniqlo Tokyo", type: "Merchant", amount: -48.2, time: "Today · 14:02" },
  { name: "HSBC ····3211", type: "Payout", amount: -1200.0, time: "Yesterday" },
  { name: "Alex Rivera", type: "Transfer", amount: -60.0, time: "2 Jul" },
  { name: "Blue Bottle Coffee", type: "Pay QR", amount: -6.85, time: "1 Jul" },
  { name: "Mei Tan", type: "Receive", amount: 240.0, time: "28 Jun" },
];

function PayPage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("receive");
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<{ state: ActionState; title: string; desc: string }>({
    state: "idle",
    title: "",
    desc: "",
  });
  const run = (title: string, desc: string) => {
    setModal({ state: "pending", title, desc });
    setTimeout(() => setModal({ state: "success", title, desc }), 1000);
  };
  const filtered = history.filter((h) => (h.name + h.type).toLowerCase().includes(q.toLowerCase()));

  return (
    <MobileShell>
      <StatusBar title={t("pay.title")} />
      <div className="px-6 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {t("pay.tag")}
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold">{t("pay.h1")}</h1>

        {/* Mode grid */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {modes.map((m) => {
            const Icon = m.icon;
            const on = m.key === mode;
            return (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-colors ${on ? "border-primary bg-primary/10" : "border-border/60 bg-surface/60"}`}
              >
                <div className={`grid h-9 w-9 place-items-center rounded-xl ${on ? "bg-primary text-primary-foreground" : "bg-background text-primary"}`}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <span className="text-[11px] font-semibold">{t(m.labelKey)}</span>
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground">{t(m.subKey)}</span>
              </button>
            );
          })}
        </div>

        {/* Panel */}
        <div className="mt-6 rounded-3xl border border-border/60 bg-surface/60 p-5">
          {mode === "receive" && <ReceivePanel onShare={() => run("QR shared", "Your receive code is ready to accept payments.")} />}
          {mode === "pay-qr" && <PayQrPanel />}
          {mode === "scan" && <ScanPanel onOpen={() => run("Scan complete", "QR decoded. Ready to confirm the payment.")} />}
          {mode === "transfer" && <TransferPanel onSend={() => run("Transfer sent", "120.00 USDT delivered to @mei.fl.")} />}
          {mode === "merchant" && <MerchantPanel onCheckout={() => run("Payment approved", "Merchant checkout completed.")} />}
          {mode === "payout" && <PayoutPanel onReview={() => run("Payout submitted", "1,200.00 USD sent via SWIFT.")} />}
        </div>

        {/* Pay with Card CTA */}
        <Link
          to="/card-pay"
          className="mt-6 flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 active:scale-[0.99]"
        >
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <CreditCard className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t("pay.cardCta")}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("pay.cardCtaSub")}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-primary" />
        </Link>

        {/* History */}
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span translate="no" className="font-mono text-[10px] font-semibold tracking-widest text-primary">04</span>
              <h2 className="font-display text-lg font-bold">{t("pay.history")}</h2>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-surface/60 px-4 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("pay.searchPh")}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="mt-3 space-y-2">
            {filtered.map((h) => (
              <div key={h.name + h.time} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/60 p-4">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${h.amount > 0 ? "bg-primary/15 text-primary" : "bg-muted"}`}>
                  <Send className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{h.name}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{h.type} · {h.time}</p>
                </div>
                <p className={`shrink-0 text-sm font-semibold tabular-nums ${h.amount > 0 ? "text-primary" : ""}`}>
                  {h.amount > 0 ? "+" : ""}{h.amount.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ActionModal
        open={modal.state !== "idle"}
        onClose={() => setModal({ state: "idle", title: "", desc: "" })}
        state={modal.state}
        title={modal.title}
        description={modal.desc}
        successLabel={t("common.viewHistory")}
        onSuccess={() => {
          setModal({ state: "idle", title: "", desc: "" });
          navigate({ to: "/history" });
        }}
      />
    </MobileShell>
  );
}

function PanelTitle({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-4">
      <p className="font-display text-lg font-bold">{title}</p>
      <p className="text-[11px] text-muted-foreground">{desc}</p>
    </div>
  );
}

function QrGraphic({ label }: { label: string }) {
  return (
    <div className="mx-auto grid h-44 w-44 place-items-center rounded-2xl bg-white p-2">
      <div className="h-full w-full bg-[conic-gradient(#0f172a_0deg,#0f172a_10deg,transparent_10deg_20deg,#0f172a_20deg_35deg,transparent_35deg_50deg,#0f172a_50deg_60deg,transparent_60deg_75deg,#0f172a_75deg_90deg)] bg-[length:14px_14px] relative">
        <div className="absolute inset-1/3 grid place-items-center rounded-lg bg-white">
          <span translate="no" className="font-display text-xs font-bold text-black">{label}</span>
        </div>
      </div>
    </div>
  );
}

function ReceivePanel({ onShare }: { onShare: () => void }) {
  return (
    <>
      <PanelTitle title="Receive QR" desc="Share to accept payments in any currency" />
      <QrGraphic label="FL" />
      <div className="mt-4 rounded-2xl bg-background/60 p-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Handle</p>
        <div className="mt-1 flex items-center justify-between">
          <p translate="no" className="font-mono text-sm">@daniel.fl</p>
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>
      <button onClick={onShare} className="mt-3 w-full rounded-2xl bg-gradient-primary py-3 font-display text-sm font-semibold text-primary-foreground shadow-glow">
        Share QR
      </button>
    </>
  );
}

function PayQrPanel() {
  return (
    <>
      <PanelTitle title="Pay QR" desc="Show this code to any merchant terminal" />
      <QrGraphic label="PAY" />
      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Code refreshes every <span translate="no">60s</span> · Amount picked at counter
      </p>
    </>
  );
}

function ScanPanel({ onOpen }: { onOpen: () => void }) {
  return (
    <>
      <PanelTitle title="Scan QR" desc="Point at Alipay, WeChat, UPI, or FastLink codes" />
      <div className="relative mx-auto grid h-52 w-52 place-items-center rounded-3xl border border-primary/40 bg-background">
        <Scan className="h-14 w-14 text-primary" />
        <div className="absolute inset-x-6 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-primary shadow-glow" />
      </div>
      <button onClick={onOpen} className="mt-4 w-full rounded-2xl bg-gradient-primary py-3 font-display text-sm font-semibold text-primary-foreground shadow-glow">
        Open Camera
      </button>
    </>
  );
}

function TransferPanel({ onSend }: { onSend: () => void }) {
  return (
    <>
      <PanelTitle title="Transfer" desc="Send to another FastLink user instantly" />
      <div className="space-y-2">
        <FormRow label="To" value="@mei.fl" />
        <FormRow label="Amount" value="120.00 USDT" big />
        <FormRow label="Note" value="Dinner Friday" />
      </div>
      <button onClick={onSend} className="mt-4 w-full rounded-2xl bg-gradient-primary py-3 font-display text-sm font-semibold text-primary-foreground shadow-glow">
        Send Transfer
      </button>
    </>
  );
}

function MerchantPanel({ onCheckout }: { onCheckout: () => void }) {
  return (
    <>
      <PanelTitle title="Merchant Pay" desc="Pay online checkouts and in-store terminals" />
      <div className="grid grid-cols-2 gap-2">
        {["Shopify", "Amazon", "Uber", "Grab", "Klook", "Booking"].map((m) => (
          <button key={m} className="rounded-2xl border border-border/60 bg-background/60 py-3 text-xs font-semibold">
            {m}
          </button>
        ))}
      </div>
      <button onClick={onCheckout} className="mt-4 w-full rounded-2xl bg-gradient-primary py-3 font-display text-sm font-semibold text-primary-foreground shadow-glow">
        Continue to checkout
      </button>
    </>
  );
}

function PayoutPanel({ onReview }: { onReview: () => void }) {
  return (
    <>
      <PanelTitle title="Payout" desc="Send to any bank account worldwide" />
      <div className="space-y-2">
        <FormRow label="Rail" value="SWIFT · SEPA · FPS · Local" />
        <FormRow label="Beneficiary" value="Daniel Chen · HSBC ····3211" />
        <FormRow label="Amount" value="1,200.00 USD" big />
      </div>
      <button onClick={onReview} className="mt-4 w-full rounded-2xl bg-gradient-primary py-3 font-display text-sm font-semibold text-primary-foreground shadow-glow">
        Review Payout
      </button>
    </>
  );
}

function FormRow({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="rounded-2xl bg-background/60 p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 font-semibold tabular-nums ${big ? "font-display text-xl" : "text-sm"}`}>{value}</p>
    </div>
  );
}
