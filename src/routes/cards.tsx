import { createFileRoute } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { Snowflake, Sun, Eye, EyeOff, Copy, KeyRound, Wifi, Sparkles, Plane, Briefcase, Wallet, Pencil, Plus } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/cards")({
  head: () => ({
    meta: [
      { title: "FastLink — Cards" },
      { name: "description", content: "Virtual, physical, travel and business cards." },
    ],
  }),
  component: CardsPage,
});

const cards = [
  { key: "virtual", label: "Virtual", icon: Sparkles, last4: "4829", exp: "08/29", grad: "bg-gradient-visa", desc: "Instant · Global online" },
  { key: "physical", label: "Physical", icon: Wallet, last4: "9130", exp: "11/28", grad: "bg-gradient-physical", desc: "Metal · Contactless" },
  { key: "travel", label: "Travel", icon: Plane, last4: "2246", exp: "03/30", grad: "bg-gradient-primary", desc: "0% FX · Multi-currency" },
  { key: "business", label: "Business", icon: Briefcase, last4: "7714", exp: "05/29", grad: "bg-gradient-card", desc: "Team · Expense limits" },
] as const;

function CardsPage() {
  const [active, setActive] = useState<(typeof cards)[number]["key"]>("virtual");
  const [frozen, setFrozen] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showCvv, setShowCvv] = useState(false);
  const [alias, setAlias] = useState("Daily Spend");
  const current = cards.find((c) => c.key === active)!;

  return (
    <MobileShell>
      <StatusBar title="Cards" />
      <div className="px-6 pt-4">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">My Cards</h1>
            <p className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-accent">
              <Sparkles className="h-3 w-3" /> FastLink Platinum
            </p>
          </div>
          <button className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold">
            <Plus className="h-3.5 w-3.5" /> New
          </button>
        </div>

        {/* Card type selector */}
        <div className="mt-5 grid grid-cols-4 gap-2">
          {cards.map((c) => {
            const Icon = c.icon;
            const on = active === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setActive(c.key)}
                className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 text-[10px] font-semibold transition-colors ${on ? "bg-primary/15 text-primary" : "bg-surface text-muted-foreground"}`}
              >
                <Icon className="h-4 w-4" />
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Card */}
        <div className={`relative mt-6 aspect-[1.586] w-full overflow-hidden rounded-3xl p-6 shadow-card ${current.grad}`}>
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
              <p className="text-[10px] uppercase tracking-widest text-white/60">FastLink · {current.label}</p>
              <p className="mt-1 text-xs font-semibold text-white/90">{alias}</p>
            </div>
            <Wifi className="h-5 w-5 rotate-90 text-white/80" />
          </div>
          <div translate="no" className="mt-8 font-display text-xl font-semibold tracking-[0.3em] text-white">
            •••• •••• •••• {current.last4}
          </div>
          <div className="mt-4 flex items-end justify-between text-white">
            <div>
              <p className="text-[9px] uppercase tracking-widest text-white/60">Cardholder</p>
              <p translate="no" className="text-xs font-semibold">DANIEL CHEN</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest text-white/60">Expiry</p>
              <p className="text-xs font-semibold tabular-nums">{current.exp}</p>
            </div>
            <p translate="no" className="font-display text-lg font-bold italic text-white">VISA</p>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground">{current.desc}</p>

        {/* Balance + Fund */}
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-surface px-5 py-4">
          <div>
            <p className="text-xs text-muted-foreground">Card Balance</p>
            <p className="mt-0.5 font-display text-xl font-bold">$1,842.60</p>
          </div>
          <button className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
            Card Funding
          </button>
        </div>

        {/* Controls */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          <CardAction onClick={() => setFrozen((v) => !v)} active={frozen} label={frozen ? "Unfreeze" : "Freeze"} icon={frozen ? <Sun className="h-5 w-5" /> : <Snowflake className="h-5 w-5" />} />
          <CardAction onClick={() => setShowPin((v) => !v)} active={showPin} label="View PIN" icon={<KeyRound className="h-5 w-5" />} />
          <CardAction onClick={() => setShowCvv((v) => !v)} active={showCvv} label="View CVV" icon={showCvv ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />} />
          <CardAction onClick={() => {}} label="Details" icon={<Copy className="h-5 w-5" />} />
        </div>

        {/* Alias */}
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-surface p-4">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-accent/20 text-accent">
            <Pencil className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Card Alias</p>
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              className="w-full bg-transparent text-sm font-semibold outline-none"
            />
          </div>
        </div>

        {/* Details */}
        <div className="mt-4 rounded-2xl bg-surface p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Card Details</p>
          <div className="mt-3 divide-y divide-border">
            <Detail label="Card Number" value={`4829 3819 4432 ${current.last4}`} copyable />
            <Detail label="Expiry" value={current.exp} />
            <Detail label="CVV" value={showCvv ? "428" : "•••"} />
            <Detail label="PIN" value={showPin ? "7 2 4 9" : "• • • •"} />
            <Detail label="Daily Limit" value="$5,000.00" />
          </div>
        </div>

        {/* Wallets add */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <AddWallet brand="Apple Pay" glyph="" />
          <AddWallet brand="Google Pay" glyph="G" />
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

function CardAction({ onClick, label, icon, active }: { onClick: () => void; label: string; icon: React.ReactNode; active?: boolean }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 rounded-2xl bg-surface py-4 text-[11px] font-medium active:scale-95">
      <div className={`grid h-10 w-10 place-items-center rounded-full ${active ? "bg-accent/20 text-accent" : "bg-primary/15 text-primary"}`}>
        {icon}
      </div>
      {label}
    </button>
  );
}

function AddWallet({ brand, glyph }: { brand: string; glyph: string }) {
  return (
    <button className="flex items-center justify-between rounded-2xl bg-surface p-4 active:scale-95">
      <div className="flex items-center gap-3">
        <div translate="no" className="grid h-9 w-9 place-items-center rounded-xl bg-background font-display text-sm font-bold">
          {glyph || brand[0]}
        </div>
        <div className="text-left">
          <p className="text-xs font-semibold">Add to {brand}</p>
          <p className="text-[10px] text-muted-foreground">One tap setup</p>
        </div>
      </div>
      <Plus className="h-4 w-4 text-primary" />
    </button>
  );
}
