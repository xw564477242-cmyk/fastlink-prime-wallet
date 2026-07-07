import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { ActionModal, type ActionState } from "@/components/ActionModal";
import { ArrowDown, RefreshCw, Info, ChevronDown, Zap, Shield } from "lucide-react";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/convert")({
  head: () => ({
    meta: [
      { title: "FastLink — Convert" },
      { name: "description", content: "Zero-fee conversion between stablecoins and 30+ fiat currencies." },
    ],
  }),
  component: ConvertPage,
});

type Currency = { sym: string; name: string; kind: "digital" | "fiat"; flag?: string };

const currencies: Currency[] = [
  { sym: "USDT", name: "Tether", kind: "digital" },
  { sym: "USDC", name: "USD Coin", kind: "digital" },
  { sym: "USD", name: "US Dollar", kind: "fiat", flag: "🇺🇸" },
  { sym: "SGD", name: "Singapore Dollar", kind: "fiat", flag: "🇸🇬" },
  { sym: "MYR", name: "Malaysian Ringgit", kind: "fiat", flag: "🇲🇾" },
  { sym: "EUR", name: "Euro", kind: "fiat", flag: "🇪🇺" },
];

// mock USD-anchored rates
const usdRate: Record<string, number> = {
  USDT: 1.0, USDC: 1.0, USD: 1.0, SGD: 1.352, MYR: 4.72, EUR: 0.9187,
};

const pairs = [
  ["USDT", "SGD"],
  ["USDT", "MYR"],
  ["USDT", "EUR"],
  ["USD", "USDT"],
  ["EUR", "USDT"],
  ["SGD", "MYR"],
];

function ConvertPage() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("500");
  const [from, setFrom] = useState("USDT");
  const [to, setTo] = useState("SGD");
  const [pickerFor, setPickerFor] = useState<"from" | "to" | null>(null);
  const [modal, setModal] = useState<ActionState>("idle");

  const rate = useMemo(() => usdRate[to] / usdRate[from], [from, to]);
  const parsed = parseFloat(amount || "0") || 0;
  const result = (parsed * rate).toFixed(2);
  const swap = () => { const f = from; setFrom(to); setTo(f); };

  const confirm = () => {
    setModal("pending");
    setTimeout(() => setModal("success"), 1000);
  };

  return (
    <MobileShell>
      <StatusBar title="Convert" />
      <div className="px-6 pt-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              FastLink FX Desk
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold">Convert</h1>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-[10px] font-semibold text-primary">
            <Zap className="h-3 w-3" /> Live · 0 fee
          </div>
        </div>

        <div className="relative mt-6 space-y-2">
          <FxCard label="You send" symbol={from} onPick={() => setPickerFor("from")} value={amount} onChange={setAmount} balance="10,204.15" />
          <button
            onClick={swap}
            className="absolute left-1/2 top-1/2 z-10 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-glow active:scale-95"
          >
            <ArrowDown className="h-5 w-5" />
          </button>
          <FxCard label="You receive" symbol={to} onPick={() => setPickerFor("to")} value={result} readOnly balance={to === "SGD" ? "3,180.40" : "—"} />
        </div>

        <div className="mt-5 rounded-2xl border border-border/60 bg-surface/60 p-4">
          <RateRow icon={RefreshCw} label="Mid-market rate" value={`1 ${from} = ${rate.toFixed(4)} ${to}`} />
          <div className="my-3 h-px bg-border" />
          <RateRow label="Network fee" value="Free" accent />
          <RateRow label="FX spread" value="0.00%" accent />
          <RateRow label="Arrival" value="Instant" />
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-border/60 bg-surface/40 p-3">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
          <p className="text-[11px] text-muted-foreground">
            Rate locked for <span translate="no">10s</span>. FastLink Treasury settles across 30+ currencies with a single click — no wire, no correspondent bank.
          </p>
        </div>

        <button
          onClick={() => setModal("review")}
          disabled={parsed <= 0 || from === to}
          className="mt-5 w-full rounded-2xl bg-gradient-primary py-4 font-display text-base font-semibold text-primary-foreground shadow-glow active:scale-[0.98] disabled:opacity-50"
        >
          Convert {parsed.toFixed(2)} {from} → {result} {to}
        </button>

        {/* Quick pairs */}
        <div className="mt-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Popular pairs
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {pairs.map(([a, b]) => {
              const r = usdRate[b] / usdRate[a];
              return (
                <button
                  key={`${a}-${b}`}
                  onClick={() => { setFrom(a); setTo(b); }}
                  className="rounded-2xl border border-border/60 bg-surface/60 p-3 text-left active:scale-95"
                >
                  <p className="font-mono text-xs font-semibold">{a} → {b}</p>
                  <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                    1 = {r.toFixed(4)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2 rounded-2xl border border-border/60 bg-surface/40 p-4">
          <Shield className="h-4 w-4 text-primary" />
          <p className="text-[11px] text-muted-foreground">
            All conversions cleared through <span className="font-semibold text-foreground">FastLink Global Ltd.</span> · Regulated MSO
          </p>
        </div>
      </div>

      {pickerFor && (
        <CurrencyPicker
          onClose={() => setPickerFor(null)}
          onPick={(sym) => {
            if (pickerFor === "from") setFrom(sym); else setTo(sym);
            setPickerFor(null);
          }}
        />
      )}
    </MobileShell>
  );
}

function FxCard({
  label, symbol, onPick, value, onChange, readOnly, balance,
}: {
  label: string; symbol: string; onPick: () => void;
  value: string; onChange?: (v: string) => void; readOnly?: boolean; balance: string;
}) {
  const c = currencies.find((x) => x.sym === symbol);
  return (
    <div className="rounded-3xl border border-border/60 bg-surface/60 p-5">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>{label}</span>
        <span>Bal · {balance}</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <input
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
          inputMode="decimal"
          className="min-w-0 flex-1 bg-transparent font-display text-3xl font-bold tabular-nums outline-none"
        />
        <button
          onClick={onPick}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-background px-3 py-2 text-sm font-semibold"
        >
          {c?.flag && <span className="text-base leading-none">{c.flag}</span>}
          {symbol}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function RateRow({ label, value, icon: Icon, accent }: { label: string; value: string; icon?: React.ComponentType<{ className?: string }>; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </span>
      <span className={`tabular-nums font-semibold ${accent ? "text-primary" : ""}`}>{value}</span>
    </div>
  );
}

function CurrencyPicker({ onClose, onPick }: { onClose: () => void; onPick: (s: string) => void }) {
  const digital = currencies.filter((c) => c.kind === "digital");
  const fiat = currencies.filter((c) => c.kind === "fiat");
  return (
    <div className="fixed inset-x-0 bottom-0 top-0 z-50 mx-auto flex max-w-md items-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full rounded-t-3xl border-t border-border/60 bg-background p-6">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Digital</p>
        <div className="mt-2 space-y-1">
          {digital.map((c) => (
            <PickerRow key={c.sym} c={c} onPick={() => onPick(c.sym)} />
          ))}
        </div>
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Fiat</p>
        <div className="mt-2 space-y-1">
          {fiat.map((c) => (
            <PickerRow key={c.sym} c={c} onPick={() => onPick(c.sym)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PickerRow({ c, onPick }: { c: Currency; onPick: () => void }) {
  return (
    <button onClick={onPick} className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-surface active:scale-[0.98]">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-surface text-sm">
        {c.flag ?? <span className="font-mono text-[10px] font-bold text-primary">{c.sym.slice(0, 3)}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{c.sym}</p>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{c.name}</p>
      </div>
    </button>
  );
}
