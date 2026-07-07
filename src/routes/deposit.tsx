import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { ActionModal, type ActionState } from "@/components/ActionModal";
import { Copy, QrCode, ShieldAlert, Clock, CheckCircle2, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/deposit")({
  head: () => ({
    meta: [
      { title: "FastLink — Deposit" },
      { name: "description", content: "Deposit USDT to your FastLink wallet via TRC20, ERC20 or BEP20." },
    ],
  }),
  component: DepositPage,
});

const NETWORKS = [
  { key: "TRC20", name: "Tron · TRC20", fee: "0 USDT", eta: "~1 min", confirms: "1 / 1", addr: "TQn9Y2khDD95J42FQtQTdwVVR5NNXA1QoP" },
  { key: "ERC20", name: "Ethereum · ERC20", fee: "≈ 3.20 USDT", eta: "~3 min", confirms: "12 / 12", addr: "0x8B2F7A4d1e9A0c8Bf3d7C1A4E9F0B2D5C7A1B4E9" },
  { key: "BEP20", name: "BNB Smart Chain · BEP20", fee: "≈ 0.20 USDT", eta: "~30 sec", confirms: "15 / 15", addr: "0x3F1D8E2A9C4B6D5F7E0A1C3D2B5F8E9A4C6D1B2F" },
] as const;

function DepositPage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [network, setNetwork] = useState<(typeof NETWORKS)[number]["key"]>("TRC20");
  const [copied, setCopied] = useState(false);
  const [assetOpen, setAssetOpen] = useState(false);
  const [modal, setModal] = useState<ActionState>("idle");
  const net = NETWORKS.find((n) => n.key === network)!;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(net.addr);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <MobileShell>
      <StatusBar title={t("deposit.title")} />
      <div className="px-6 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t("deposit.step")}</p>
        <h1 className="mt-1 font-display text-2xl font-bold">{t("deposit.h1")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t("deposit.sub")}</p>

        {/* Asset selector */}
        <div className="mt-5">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">{t("common.asset")}</p>
          <button
            onClick={() => setAssetOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl border border-border/60 bg-surface/60 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/15 font-display text-[10px] font-bold text-primary">USDT</div>
              <div className="text-left">
                <p className="text-sm font-semibold">Tether</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">USDT · Stablecoin</p>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
          {assetOpen && (
            <p className="mt-2 rounded-xl bg-muted/40 px-3 py-2 text-[10px] text-muted-foreground">
              {t("deposit.onlyUsdt")}
            </p>
          )}
        </div>

        {/* Network selector */}
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
                  <p className={`text-xs font-semibold ${on ? "text-primary" : ""}`}>{n.key}</p>
                  <p className="mt-0.5 text-[9px] uppercase tracking-widest text-muted-foreground">{n.eta}</p>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">{t("deposit.selected", { name: net.name })}</p>
        </div>

        {/* QR + address */}
        <div className="mt-5 rounded-3xl border border-border/60 bg-surface/60 p-5">
          <div className="mx-auto grid h-48 w-48 place-items-center rounded-2xl bg-background">
            <div className="grid h-40 w-40 place-items-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/10">
              <QrCode className="h-20 w-20 text-primary" strokeWidth={1.2} />
            </div>
          </div>
          <p className="mt-4 text-center text-[10px] uppercase tracking-widest text-muted-foreground">{t("deposit.qrLabel", { network })}</p>
          <div translate="no" className="mt-2 break-all rounded-2xl bg-background/60 px-4 py-3 text-center font-mono text-xs">
            {net.addr}
          </div>
          <button
            onClick={copy}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3 font-display text-sm font-semibold text-primary-foreground shadow-glow"
          >
            {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? t("common.copied") : t("deposit.copyAddress")}
          </button>
        </div>

        {/* Meta */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <MetaCell icon={<CheckCircle2 className="h-4 w-4" />} label={t("deposit.confirmations")} value={net.confirms} />
          <MetaCell icon={<Clock className="h-4 w-4" />} label={t("deposit.eta")} value={net.eta} />
          <MetaCell label={t("deposit.min")} value="1 USDT" />
          <MetaCell label={t("deposit.networkFee")} value={net.fee} />
        </div>

        {/* Risk */}
        <div className="mt-4 flex gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-4">
          <ShieldAlert className="h-4 w-4 shrink-0 text-accent" />
          <div>
            <p className="text-[11px] font-semibold text-accent">{t("deposit.risk")}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {t("deposit.riskDesc", { network })}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setModal("pending");
            setTimeout(() => setModal("success"), 900);
          }}
          className="mt-5 mb-2 w-full rounded-2xl border border-primary/40 bg-primary/10 py-3 font-display text-sm font-semibold text-primary"
        >
          {t("deposit.completed")}
        </button>
      </div>

      <ActionModal
        open={modal !== "idle"}
        onClose={() => setModal("idle")}
        state={modal}
        title={t("deposit.modalTitle")}
        description={t("deposit.modalDesc", { network })}
        successLabel={t("common.viewHistory")}
        onSuccess={() => {
          setModal("idle");
          navigate({ to: "/history" });
        }}
      />
    </MobileShell>
  );
}

function MetaCell({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-surface/60 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <p className="text-[10px] uppercase tracking-widest">{label}</p>
      </div>
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
