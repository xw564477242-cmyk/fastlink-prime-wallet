import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { ActionModal, type ActionState } from "@/components/ActionModal";
import { ShieldAlert, Clock, ChevronDown, ArrowUpFromLine } from "lucide-react";
import { useState } from "react";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/withdraw")({
  head: () => ({
    meta: [
      { title: "FastLink — Withdraw" },
      { name: "description", content: "Withdraw USDT from your FastLink wallet to an external address." },
    ],
  }),
  component: WithdrawPage,
});

const NETWORKS = [
  { key: "TRC20", name: "Tron · TRC20", fee: 1, eta: "~1 min" },
  { key: "ERC20", name: "Ethereum · ERC20", fee: 4.5, eta: "~3 min" },
  { key: "BEP20", name: "BNB Smart Chain · BEP20", fee: 0.3, eta: "~30 sec" },
] as const;

const AVAILABLE = 10204.15;

function WithdrawPage() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [network, setNetwork] = useState<(typeof NETWORKS)[number]["key"]>("TRC20");
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [modal, setModal] = useState<ActionState>("idle");
  const net = NETWORKS.find((n) => n.key === network)!;
  const amt = Number(amount) || 0;
  const receive = Math.max(0, amt - net.fee);

  const confirm = () => {
    setModal("pending");
    setTimeout(() => setModal("success"), 1200);
  };

  return (
    <MobileShell>
      <StatusBar title={t("page.withdraw")} />
      <div className="px-6 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t("withdraw.step")}</p>
        <h1 className="mt-1 font-display text-2xl font-bold">{t("withdraw.title")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t("withdraw.desc")}</p>

        <div className="mt-5">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">{t("common.asset")}</p>
          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-surface/60 px-4 py-3">
            <div className="flex items-center gap-3">
              <div translate="no" className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/15 font-display text-[10px] font-bold text-primary">USDT</div>
              <div>
                <p className="text-sm font-semibold">{t("deposit.tether")}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("withdraw.available", { n: AVAILABLE.toLocaleString() })}</p>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">{t("common.network")}</p>
          <div className="grid grid-cols-3 gap-2">
            {NETWORKS.map((n) => {
              const on = n.key === network;
              return (
                <button
                  key={n.key}
                  onClick={() => setNetwork(n.key)}
                  className={`rounded-2xl border p-3 text-left transition-colors ${on ? "border-primary bg-primary/10" : "border-border/60 bg-surface/60"}`}
                >
                  <p translate="no" className={`text-xs font-semibold ${on ? "text-primary" : ""}`}>{n.key}</p>
                  <p className="mt-0.5 text-[9px] uppercase tracking-widest text-muted-foreground">{t("withdraw.feeShort", { n: n.fee })}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">{t("withdraw.addr")}</p>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t("withdraw.paste", { net: network })}
            className="w-full rounded-2xl border border-border/60 bg-surface/60 px-4 py-3 font-mono text-xs outline-none focus:border-primary"
          />
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("common.amount")}</p>
            <button onClick={() => setAmount(String(AVAILABLE))} className="text-[10px] font-semibold text-primary">{t("common.max")}</button>
          </div>
          <div className="flex items-baseline gap-2 rounded-2xl border border-border/60 bg-surface/60 px-4 py-3">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="min-w-0 flex-1 bg-transparent font-display text-2xl font-bold tabular-nums outline-none placeholder:text-muted-foreground/40"
            />
            <span translate="no" className="text-xs font-semibold text-muted-foreground">USDT</span>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            {t("common.available")}: <span translate="no" className="tabular-nums text-foreground">{AVAILABLE.toLocaleString()} USDT</span>
          </p>
        </div>

        <div className="mt-5 space-y-2 rounded-2xl border border-border/60 bg-surface/60 p-4">
          <Row label={t("deposit.networkFee")} value={`${net.fee} USDT`} />
          <Row label={t("withdraw.est")} value={net.eta} icon={<Clock className="h-3.5 w-3.5" />} />
          <div className="border-t border-border/60 pt-2">
            <Row label={t("withdraw.receive")} value={`${receive.toFixed(2)} USDT`} bold />
          </div>
        </div>

        <div className="mt-4 flex gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-4">
          <ShieldAlert className="h-4 w-4 shrink-0 text-accent" />
          <div>
            <p className="text-[11px] font-semibold text-accent">{t("withdraw.aml")}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {t("withdraw.amlBody")}
            </p>
          </div>
        </div>

        <button
          onClick={() => setModal("review")}
          disabled={!address || amt <= 0}
          className="mt-5 mb-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3 font-display text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
        >
          <ArrowUpFromLine className="h-4 w-4" /> {t("withdraw.reviewBtn")}
        </button>
      </div>

      <ActionModal
        open={modal !== "idle"}
        onClose={() => setModal("idle")}
        state={modal}
        title={modal === "success" ? t("withdraw.submitted") : t("withdraw.confirmTitle")}
        description={
          modal === "success"
            ? t("withdraw.broadcasting", { net: network })
            : t("withdraw.sendDesc", { amt: amt.toFixed(2), net: network })
        }
        rows={[
          { label: t("common.to"), value: <span translate="no" className="font-mono">{address.slice(0, 6)}…{address.slice(-4)}</span> },
          { label: t("common.amount"), value: <span translate="no">{amt.toFixed(2)} USDT</span> },
          { label: t("common.fee"), value: <span translate="no">{net.fee} USDT</span> },
          { label: t("withdraw.receive"), value: <span translate="no">{receive.toFixed(2)} USDT</span> },
        ]}
        confirmLabel={t("withdraw.confirmSend")}
        onConfirm={confirm}
        successLabel={t("common.viewHistory")}
        onSuccess={() => {
          setModal("idle");
          navigate({ to: "/history" });
        }}
      />
    </MobileShell>
  );
}

function Row({ label, value, icon, bold }: { label: string; value: string; icon?: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <span translate="no" className={`tabular-nums ${bold ? "font-display text-base font-bold" : "text-xs font-semibold"}`}>{value}</span>
    </div>
  );
}
