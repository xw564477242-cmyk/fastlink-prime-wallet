import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { ActionModal, type ActionState } from "@/components/ActionModal";
import { Send, User, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/transfer")({
  head: () => ({
    meta: [
      { title: "FastLink — Transfer" },
      { name: "description", content: "Instant fee-free transfers between FastLink users by ID, phone or email." },
    ],
  }),
  component: TransferPage,
});

const CURRENCIES = ["USDT", "USD", "SGD", "MYR"] as const;
type Cur = (typeof CURRENCIES)[number];

const BALANCES: Record<Cur, number> = {
  USDT: 10204.15,
  USD: 5240,
  SGD: 3180.4,
  MYR: 8420.1,
};

function TransferPage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [recipient, setRecipient] = useState("");
  const [currency, setCurrency] = useState<Cur>("USDT");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [modal, setModal] = useState<ActionState>("idle");
  const amt = Number(amount) || 0;

  const confirm = () => {
    setModal("pending");
    setTimeout(() => setModal("success"), 1100);
  };

  return (
    <MobileShell>
      <StatusBar title={t("transfer.title")} />
      <div className="px-6 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t("transfer.tag")}</p>
        <h1 className="mt-1 font-display text-2xl font-bold">{t("transfer.h1")}</h1>

        {/* Recipient */}
        <div className="mt-5">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">{t("transfer.recipient")}</p>
          <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/60 px-4 py-3">
            <User className="h-4 w-4 text-muted-foreground" />
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={t("transfer.recipientPh")}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        {/* Currency */}
        <div className="mt-5">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">{t("transfer.currency")}</p>
          <button
            onClick={() => setPickerOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl border border-border/60 bg-surface/60 px-4 py-3"
          >
            <div>
              <p className="text-sm font-semibold">{currency}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Balance {BALANCES[currency].toLocaleString()} {currency}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
          {pickerOpen && (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {CURRENCIES.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setCurrency(c);
                    setPickerOpen(false);
                  }}
                  className={`rounded-2xl border py-2 text-xs font-semibold ${c === currency ? "border-primary bg-primary/10 text-primary" : "border-border/60 bg-surface/60"}`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Amount */}
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("common.amount")}</p>
            <button onClick={() => setAmount(String(BALANCES[currency]))} className="text-[10px] font-semibold text-primary">{t("common.max")}</button>
          </div>
          <div className="flex items-baseline gap-2 rounded-2xl border border-border/60 bg-surface/60 px-4 py-3">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="min-w-0 flex-1 bg-transparent font-display text-2xl font-bold tabular-nums outline-none placeholder:text-muted-foreground/40"
            />
            <span className="text-xs font-semibold text-muted-foreground">{currency}</span>
          </div>
        </div>

        {/* Note */}
        <div className="mt-5">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Note (optional)</p>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={80}
            placeholder={t("transfer.notePh")}
            className="w-full rounded-2xl border border-border/60 bg-surface/60 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/60"
          />
        </div>

        {/* Review panel */}
        <div className="mt-5 space-y-2 rounded-2xl border border-border/60 bg-surface/60 p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Review</p>
          <Row label="To" value={recipient || "—"} />
          <Row label="Amount" value={`${amt.toFixed(2)} ${currency}`} />
          <Row label="Fee" value="0.00" />
          <Row label="Arrival" value="Instant" />
        </div>

        <button
          onClick={() => setModal("review")}
          disabled={!recipient || amt <= 0}
          className="mt-5 mb-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3 font-display text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> {t("transfer.reviewCta")}
        </button>
      </div>

      <ActionModal
        open={modal !== "idle"}
        onClose={() => setModal("idle")}
        state={modal}
        title={t(modal === "success" ? "transfer.modalSuccessTitle" : "transfer.modalConfirmTitle")}
        description={
          modal === "success"
            ? t("transfer.modalSuccessDesc", { amount: amt.toFixed(2), currency })
            : t("transfer.modalConfirmDesc", { amount: amt.toFixed(2), currency, to: recipient })
        }
        rows={[
          { label: "To", value: recipient || "—" },
          { label: "Amount", value: `${amt.toFixed(2)} ${currency}` },
          { label: "Fee", value: "0.00" },
          { label: "Note", value: note || "—" },
        ]}
        confirmLabel={t("transfer.sendNow")}
        onConfirm={confirm}
        successLabel={t("common.backHome")}
        onSuccess={() => {
          setModal("idle");
          navigate({ to: "/" });
        }}
      />
    </MobileShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold tabular-nums">{value}</span>
    </div>
  );
}
