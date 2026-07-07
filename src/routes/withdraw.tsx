import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { ActionModal, type ActionState } from "@/components/ActionModal";
import { ShieldAlert, Clock, ChevronDown, ArrowUpFromLine } from "lucide-react";
import { useState } from "react";

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
      <StatusBar title="Withdraw" />
      <div className="px-6 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Step 01 / 02</p>
        <h1 className="mt-1 font-display text-2xl font-bold">Withdraw Crypto</h1>
        <p className="mt-1 text-xs text-muted-foreground">Send USDT to an external wallet. Confirm the network before sending.</p>

        {/* Asset */}
        <div className="mt-5">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Asset</p>
          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-surface/60 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/15 font-display text-[10px] font-bold text-primary">USDT</div>
              <div>
                <p className="text-sm font-semibold">Tether</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Available {AVAILABLE.toLocaleString()} USDT</p>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* Network */}
        <div className="mt-5">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Network</p>
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
                  <p className="mt-0.5 text-[9px] uppercase tracking-widest text-muted-foreground">fee {n.fee} USDT</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Address */}
        <div className="mt-5">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Withdrawal Address</p>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={`Paste ${network} address`}
            className="w-full rounded-2xl border border-border/60 bg-surface/60 px-4 py-3 font-mono text-xs outline-none focus:border-primary"
          />
        </div>

        {/* Amount */}
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Amount</p>
            <button onClick={() => setAmount(String(AVAILABLE))} className="text-[10px] font-semibold text-primary">MAX</button>
          </div>
          <div className="flex items-baseline gap-2 rounded-2xl border border-border/60 bg-surface/60 px-4 py-3">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="min-w-0 flex-1 bg-transparent font-display text-2xl font-bold tabular-nums outline-none placeholder:text-muted-foreground/40"
            />
            <span className="text-xs font-semibold text-muted-foreground">USDT</span>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Available: <span className="tabular-nums text-foreground">{AVAILABLE.toLocaleString()} USDT</span>
          </p>
        </div>

        {/* Summary */}
        <div className="mt-5 space-y-2 rounded-2xl border border-border/60 bg-surface/60 p-4">
          <Row label="Network Fee" value={`${net.fee} USDT`} />
          <Row label="Estimated Arrival" value={net.eta} icon={<Clock className="h-3.5 w-3.5" />} />
          <div className="border-t border-border/60 pt-2">
            <Row label="You will receive" value={`${receive.toFixed(2)} USDT`} bold />
          </div>
        </div>

        {/* AML */}
        <div className="mt-4 flex gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-4">
          <ShieldAlert className="h-4 w-4 shrink-0 text-accent" />
          <div>
            <p className="text-[11px] font-semibold text-accent">AML · Travel Rule</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Transfers over threshold amounts may require originator and beneficiary information under the FATF Travel Rule. Additional verification may be requested.
            </p>
          </div>
        </div>

        <button
          onClick={() => setModal("review")}
          disabled={!address || amt <= 0}
          className="mt-5 mb-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3 font-display text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
        >
          <ArrowUpFromLine className="h-4 w-4" /> Review Withdrawal
        </button>
      </div>

      <ActionModal
        open={modal !== "idle"}
        onClose={() => setModal("idle")}
        state={modal}
        title={modal === "success" ? "Withdrawal submitted" : "Confirm withdrawal"}
        description={
          modal === "success"
            ? `Broadcasting on ${network}. Track progress in History.`
            : `Send ${amt.toFixed(2)} USDT via ${network} to your external wallet.`
        }
        rows={[
          { label: "To", value: <span className="font-mono">{address.slice(0, 6)}…{address.slice(-4)}</span> },
          { label: "Amount", value: `${amt.toFixed(2)} USDT` },
          { label: "Fee", value: `${net.fee} USDT` },
          { label: "You receive", value: `${receive.toFixed(2)} USDT` },
        ]}
        confirmLabel="Confirm & Send"
        onConfirm={confirm}
        successLabel="View History"
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
      <span className={`tabular-nums ${bold ? "font-display text-base font-bold" : "text-xs font-semibold"}`}>{value}</span>
    </div>
  );
}
