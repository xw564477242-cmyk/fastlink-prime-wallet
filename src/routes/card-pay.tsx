import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { ActionModal, type ActionState } from "@/components/ActionModal";
import { CreditCard, Wifi, Store } from "lucide-react";
import { useState } from "react";

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
  const [merchant, setMerchant] = useState(MERCHANTS[0]);
  const [modal, setModal] = useState<ActionState>("idle");

  const pay = () => {
    setModal("pending");
    setTimeout(() => setModal("success"), 1200);
  };

  return (
    <MobileShell>
      <StatusBar title="Pay with Card" />
      <div className="px-6 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Merchant Checkout
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold">Tap to Pay</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Simulate a contactless card payment at a merchant terminal.
        </p>

        {/* Merchant list */}
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
                  <p className="truncate text-sm font-semibold">{m.name}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{m.category}</p>
                </div>
                <p className="font-semibold tabular-nums">${m.amount.toFixed(2)}</p>
              </button>
            );
          })}
        </div>

        {/* Terminal */}
        <div className="mt-6 rounded-3xl border border-border/60 bg-surface/60 p-6 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary/10 text-primary">
            <Wifi className="h-9 w-9 rotate-90" />
          </div>
          <p className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">Amount due</p>
          <p className="mt-1 font-display text-3xl font-bold tabular-nums">${merchant.amount.toFixed(2)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{merchant.name}</p>
        </div>

        <button
          onClick={pay}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3 font-display text-sm font-semibold text-primary-foreground shadow-glow"
        >
          <CreditCard className="h-4 w-4" /> Tap Virtual Card to Pay
        </button>
      </div>

      <ActionModal
        open={modal !== "idle"}
        onClose={() => setModal("idle")}
        state={modal}
        title={modal === "success" ? "Payment approved" : "Confirm payment"}
        description={
          modal === "success"
            ? `Paid $${merchant.amount.toFixed(2)} to ${merchant.name}.`
            : `Charge $${merchant.amount.toFixed(2)} to your Virtual Card •• 4829.`
        }
        rows={[
          { label: "Merchant", value: merchant.name },
          { label: "Amount", value: `$${merchant.amount.toFixed(2)}` },
          { label: "Card", value: "Virtual •• 4829" },
        ]}
        confirmLabel="Pay Now"
        onConfirm={pay}
        successLabel="View History"
        onSuccess={() => {
          setModal("idle");
          navigate({ to: "/history" });
        }}
      />
    </MobileShell>
  );
}
