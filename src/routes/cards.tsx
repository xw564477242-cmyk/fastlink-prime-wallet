import { createFileRoute } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import {
  Snowflake,
  Sun,
  Eye,
  EyeOff,
  Copy,
  KeyRound,
  Wifi,
  Sparkles,
  Plane,
  Wallet,
  Pencil,
  Plus,
  ArrowDownToLine,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/cards")({
  head: () => ({
    meta: [
      { title: "FastLink — Card Center" },
      { name: "description", content: "Virtual, physical and travel cards with freeze, PIN, CVV, alias and funding." },
    ],
  }),
  component: CardsPage,
});

const cards = [
  {
    key: "virtual",
    label: "Virtual",
    tag: "Instant · Online",
    icon: Sparkles,
    last4: "4829",
    exp: "08/29",
    cvv: "428",
    pin: "7249",
    grad: "bg-gradient-visa",
    balance: 1842.6,
    stripe: "bg-primary",
    limit: "5,000",
  },
  {
    key: "physical",
    label: "Physical",
    tag: "Metal · Contactless",
    icon: Wallet,
    last4: "9130",
    exp: "11/28",
    cvv: "512",
    pin: "3082",
    grad: "bg-gradient-physical",
    balance: 620.4,
    stripe: "bg-accent",
    limit: "10,000",
  },
  {
    key: "travel",
    label: "Travel",
    tag: "0% FX · 30 currencies",
    icon: Plane,
    last4: "2246",
    exp: "03/30",
    cvv: "907",
    pin: "5610",
    grad: "bg-gradient-primary",
    balance: 980.0,
    stripe: "bg-sky-400",
    limit: "7,500",
  },
] as const;

function CardsPage() {
  const [active, setActive] = useState<(typeof cards)[number]["key"]>("virtual");
  const [frozen, setFrozen] = useState<Record<string, boolean>>({});
  const [showPin, setShowPin] = useState(false);
  const [showCvv, setShowCvv] = useState(false);
  const [aliases, setAliases] = useState<Record<string, string>>({
    virtual: "Daily Spend",
    physical: "Wallet Card",
    travel: "Trip Card",
  });
  const [funding, setFunding] = useState("100");
  const current = cards.find((c) => c.key === active)!;
  const isFrozen = !!frozen[active];

  return (
    <MobileShell>
      <StatusBar title="Card Center" />
      <div className="px-6 pt-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              FastLink Card Center
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold">My Cards</h1>
          </div>
          <button className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary">
            <Plus className="h-3.5 w-3.5" /> Issue new
          </button>
        </div>

        {/* Card type selector */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {cards.map((c) => {
            const Icon = c.icon;
            const on = active === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setActive(c.key)}
                className={`flex flex-col items-start gap-2 rounded-2xl border p-3 text-left transition-colors ${on ? "border-primary bg-primary/10" : "border-border/60 bg-surface/60"}`}
              >
                <div className="flex w-full items-center justify-between">
                  <Icon className={`h-4 w-4 ${on ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-primary" : "bg-transparent"}`} />
                </div>
                <div>
                  <p className="text-xs font-semibold">{c.label} Card</p>
                  <p translate="no" className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                    •••• {c.last4}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Card */}
        <div className={`relative mt-6 aspect-[1.586] w-full overflow-hidden rounded-3xl p-6 shadow-card ${current.grad}`}>
          <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_60%)]" />
          {isFrozen && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-md">
              <div className="flex flex-col items-center gap-2 text-foreground">
                <Snowflake className="h-8 w-8 text-primary" />
                <p className="text-sm font-semibold">Card Frozen</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">All transactions paused</p>
              </div>
            </div>
          )}
          <div className="relative flex items-start justify-between text-white">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/60">FastLink · {current.label}</p>
              <p className="mt-1 text-xs font-semibold text-white/90">{aliases[active]}</p>
              <p className="mt-0.5 text-[10px] text-white/60">{current.tag}</p>
            </div>
            <Wifi className="h-5 w-5 rotate-90 text-white/80" />
          </div>
          <div translate="no" className="relative mt-6 font-mono text-lg font-semibold tracking-[0.3em] text-white">
            4829 3819 4432 {current.last4}
          </div>
          <div className="relative mt-4 flex items-end justify-between text-white">
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

        {/* Balance */}
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-border/60 bg-surface/60 px-5 py-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Card Balance</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums">
              ${current.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Daily Limit</p>
            <p className="mt-1 text-sm font-semibold tabular-nums">${current.limit}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          <CardAction
            onClick={() => setFrozen((f) => ({ ...f, [active]: !f[active] }))}
            active={isFrozen}
            label={isFrozen ? "Unfreeze" : "Freeze"}
            icon={isFrozen ? <Sun className="h-5 w-5" /> : <Snowflake className="h-5 w-5" />}
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
          <CardAction onClick={() => {}} label="Details" icon={<Copy className="h-5 w-5" />} />
        </div>

        {/* Alias */}
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/60 p-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/20 text-accent">
            <Pencil className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Card Alias</p>
            <input
              value={aliases[active]}
              onChange={(e) => setAliases((a) => ({ ...a, [active]: e.target.value }))}
              maxLength={30}
              className="w-full bg-transparent text-sm font-semibold outline-none"
            />
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground">{aliases[active].length}/30</span>
        </div>

        {/* Card Funding */}
        <div className="mt-4 rounded-2xl border border-border/60 bg-surface/60 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                <ArrowDownToLine className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Card Funding</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">From USDT Wallet → Card Balance</p>
              </div>
            </div>
          </div>
          <div className="flex items-baseline gap-2 rounded-2xl bg-background/60 px-4 py-3">
            <span className="text-lg font-semibold text-muted-foreground">$</span>
            <input
              value={funding}
              onChange={(e) => setFunding(e.target.value)}
              inputMode="decimal"
              className="min-w-0 flex-1 bg-transparent font-display text-2xl font-bold tabular-nums outline-none"
            />
            <span className="text-xs font-semibold text-muted-foreground">USDT</span>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {["50", "100", "500", "Max"].map((q) => (
              <button
                key={q}
                onClick={() => setFunding(q === "Max" ? "10204.15" : q)}
                className="rounded-full bg-background/60 py-1.5 text-[11px] font-semibold text-muted-foreground"
              >
                {q}
              </button>
            ))}
          </div>
          <button className="mt-3 w-full rounded-2xl bg-gradient-primary py-3 font-display text-sm font-semibold text-primary-foreground shadow-glow">
            Fund {current.label} Card
          </button>
        </div>

        {/* Details */}
        <div className="mt-4 rounded-2xl border border-border/60 bg-surface/60 p-5">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Card Details</p>
          <div className="mt-3 divide-y divide-border">
            <Detail label="Number" value={`4829 3819 4432 ${current.last4}`} copyable />
            <Detail label="Expiry" value={current.exp} />
            <Detail label="CVV" value={showCvv ? current.cvv : "•••"} />
            <Detail label="PIN" value={showPin ? current.pin.split("").join(" ") : "• • • •"} />
            <Detail label="Issuer" value="Licensed partner institution" />
          </div>
        </div>

        {/* Physical Card Application */}
        <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-display text-sm font-bold">Apply for Physical Card</p>
                <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-accent">
                  Pending KYC
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Get a contactless FastLink card delivered to your address after KYC approval.
              </p>
            </div>
          </div>
          <button className="mt-4 w-full rounded-2xl bg-gradient-primary py-3 font-display text-sm font-semibold text-primary-foreground shadow-glow">
            Start Application
          </button>
        </div>

        <p className="mt-6 mb-2 text-center text-[10px] leading-relaxed tracking-wide text-muted-foreground">
          Issued by licensed partner financial institution. FastLink provides wallet and card program services.
        </p>
      </div>
    </MobileShell>
  );
}

function Detail({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-medium tabular-nums">{value}</span>
        {copyable && <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
    </div>
  );
}

function CardAction({ onClick, label, icon, active }: { onClick: () => void; label: string; icon: React.ReactNode; active?: boolean }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 rounded-2xl border border-border/60 bg-surface/60 py-3 text-[10px] font-semibold active:scale-95">
      <div className={`grid h-9 w-9 place-items-center rounded-xl ${active ? "bg-accent/20 text-accent" : "bg-primary/15 text-primary"}`}>
        {icon}
      </div>
      {label}
    </button>
  );
}
