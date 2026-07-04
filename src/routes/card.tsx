import { createFileRoute } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { Snowflake, Sun, Eye, EyeOff, Copy, KeyRound, Wifi, Sparkles } from "lucide-react";
import { useState } from "react";


export const Route = createFileRoute("/card")({
  head: () => ({
    meta: [
      { title: "FastLink — U Card" },
      { name: "description", content: "Manage your Virtual and Physical U Card." },
    ],
  }),
  component: CardPage,
});

function CardPage() {
  const [tab, setTab] = useState<"virtual" | "physical">("virtual");
  const [frozen, setFrozen] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showCvv, setShowCvv] = useState(false);

  const current = tab === "virtual"
    ? { last4: "4829", holder: "DANIEL CHEN", exp: "08/29", gradient: "bg-gradient-visa" }
    : { last4: "9130", holder: "DANIEL CHEN", exp: "11/28", gradient: "bg-gradient-physical" };

  return (
    <MobileShell>
      <StatusBar title="U Card" />

      <div className="px-6 pt-4">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">My Cards</h1>
            <p className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-accent">
              <Sparkles className="h-3 w-3" /> FastLink Platinum
            </p>
          </div>
        </div>

        {/* Card toggle */}
        <div className="mt-5 flex gap-2 rounded-full bg-surface p-1">
          {[
            { k: "virtual", l: "Virtual" },
            { k: "physical", l: "Physical" },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k as "virtual" | "physical")}
              className={`flex-1 rounded-full py-2 text-xs font-semibold transition-colors ${
                tab === t.k ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {t.l}
            </button>
          ))}
        </div>

        {/* Card */}
        <div
          className={`relative mt-6 aspect-[1.586] w-full overflow-hidden rounded-3xl p-6 shadow-card ${current.gradient}`}
        >
          {frozen && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-md">
              <div className="flex flex-col items-center gap-2 text-white">
                <Snowflake className="h-8 w-8" />
                <p className="text-sm font-semibold">Card Frozen</p>
              </div>
            </div>
          )}
          <div className="flex items-start justify-between text-white">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/60">FastLink</p>
              <p className="mt-1 text-xs font-semibold text-white/90">Platinum · {tab === "virtual" ? "Virtual" : "Physical"}</p>
            </div>
            <Wifi className="h-5 w-5 rotate-90 text-white/80" />
          </div>
          <div className="mt-8 font-display text-xl font-semibold tracking-[0.3em] text-white">
            •••• •••• •••• {current.last4}
          </div>
          <div className="mt-4 flex items-end justify-between text-white">
            <div>
              <p className="text-[9px] uppercase tracking-widest text-white/60">Cardholder</p>
              <p className="text-xs font-semibold">{current.holder}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest text-white/60">Expiry</p>
              <p className="text-xs font-semibold tabular-nums">{current.exp}</p>
            </div>
            <p className="font-display text-lg italic font-bold text-white">VISA</p>
          </div>
        </div>

        {/* Balance strip */}
        <div className="mt-5 flex items-center justify-between rounded-2xl bg-surface px-5 py-4">
          <div>
            <p className="text-xs text-muted-foreground">Card Balance</p>
            <p className="mt-0.5 font-display text-xl font-bold">$1,842.60</p>
          </div>
          <button className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
            Top Up
          </button>
        </div>

        {/* Controls */}
        <div className="mt-5 grid grid-cols-4 gap-2">
          <CardAction
            onClick={() => setFrozen((v) => !v)}
            active={frozen}
            label={frozen ? "Unfreeze" : "Freeze"}
            icon={frozen ? <Sun className="h-5 w-5" /> : <Snowflake className="h-5 w-5" />}
          />
          <CardAction
            onClick={() => setShowPin((v) => !v)}
            active={showPin}
            label={showPin ? "Hide PIN" : "View PIN"}
            icon={<KeyRound className="h-5 w-5" />}
          />
          <CardAction
            onClick={() => setShowCvv((v) => !v)}
            active={showCvv}
            label={showCvv ? "Hide CVV" : "View CVV"}
            icon={showCvv ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          />
          <CardAction
            onClick={() => {}}
            label="Top Up"
            icon={<Copy className="h-5 w-5" />}
          />
        </div>

        {/* Details */}
        <div className="mt-5 rounded-2xl bg-surface p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Card Details</p>
          <div className="mt-3 divide-y divide-border">
            <Detail label="Card Number" value={`4829 3819 4432 ${current.last4}`} copyable />
            <Detail label="Expiry" value={current.exp} />
            <Detail label="CVV" value={showCvv ? "428" : "•••"} />
            <Detail label="PIN" value={showPin ? "7 2 4 9" : "• • • •"} />
            <Detail label="Daily Limit" value="$5,000.00" />
          </div>
        </div>

      </div>
    </MobileShell>
  );
}

function Detail({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium tabular-nums">{value}</span>
        {copyable && <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
    </div>
  );
}

function CardAction({
  onClick,
  label,
  icon,
  active,
}: {
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-2xl bg-surface py-4 text-[11px] font-medium active:scale-95"
    >
      <div
        className={`grid h-10 w-10 place-items-center rounded-full ${
          active ? "bg-accent/20 text-accent" : "bg-primary/15 text-primary"
        }`}
      >
        {icon}
      </div>
      {label}
    </button>
  );
}
