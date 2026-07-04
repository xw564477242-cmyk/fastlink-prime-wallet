import { createFileRoute } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { ArrowDown, RefreshCw, ChevronDown, Info } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/convert")({
  head: () => ({
    meta: [
      { title: "FastLink — Convert" },
      { name: "description", content: "Instant crypto and fiat conversions at market rates." },
    ],
  }),
  component: ConvertPage,
});

const rate = 0.9187;

function ConvertPage() {
  const [amount, setAmount] = useState("500");
  const [from, setFrom] = useState("USDT");
  const [to, setTo] = useState("EUR");
  const parsed = parseFloat(amount || "0") || 0;
  const result = (parsed * rate).toFixed(2);

  const swap = () => {
    const f = from;
    setFrom(to);
    setTo(f);
  };

  return (
    <MobileShell>
      <StatusBar title="Convert" />
      <div className="px-6 pt-4">
        <h1 className="font-display text-2xl font-bold">Convert</h1>
        <p className="mt-1 text-xs text-muted-foreground">Zero-fee swap between digital and fiat</p>

        <div className="relative mt-6 space-y-2">
          <ConvertCard label="You pay" symbol={from} onSymbol={setFrom} value={amount} onChange={setAmount} balance="10,204.15" />
          <button
            onClick={swap}
            className="absolute left-1/2 top-1/2 z-10 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-glow active:scale-95"
          >
            <ArrowDown className="h-5 w-5" />
          </button>
          <ConvertCard label="You receive" symbol={to} onSymbol={setTo} value={result} readOnly balance="2,180.50" />
        </div>

        <div className="mt-5 rounded-2xl bg-surface p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5" /> Rate
            </span>
            <span className="tabular-nums font-semibold">1 {from} ≈ {rate} {to}</span>
          </div>
          <div className="my-3 h-px bg-border" />
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Network fee</span>
            <span className="tabular-nums font-semibold text-primary">Free</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Est. arrival</span>
            <span className="font-semibold">Instant</span>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-border/60 bg-surface/40 p-3">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
          <p className="text-[11px] text-muted-foreground">
            Locked rate valid for <span translate="no">10s</span>. Converted funds are credited to your {to} wallet immediately.
          </p>
        </div>

        <button className="mt-6 w-full rounded-2xl bg-gradient-primary py-4 font-display text-base font-semibold text-primary-foreground shadow-glow active:scale-[0.98]">
          Convert {parsed.toFixed(2)} {from}
        </button>

        <div className="mt-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Quick swap</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              ["USDT", "EUR"],
              ["USDT", "USD"],
              ["USDC", "USDT"],
              ["BTC", "USDT"],
            ].map(([a, b]) => (
              <button
                key={`${a}-${b}`}
                onClick={() => { setFrom(a); setTo(b); }}
                className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 text-xs font-semibold active:scale-95"
              >
                <span>{a} → {b}</span>
                <span className="text-primary">Swap</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </MobileShell>
  );
}

function ConvertCard({
  label, symbol, onSymbol, value, onChange, readOnly, balance,
}: {
  label: string; symbol: string; onSymbol?: (s: string) => void;
  value: string; onChange?: (v: string) => void; readOnly?: boolean; balance: string;
}) {
  return (
    <div className="rounded-3xl bg-surface p-5">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>{label}</span>
        <span>Balance: {balance}</span>
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
          onClick={() => {
            const next = prompt("Symbol", symbol);
            if (next) onSymbol?.(next.toUpperCase());
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-background px-3 py-2 text-sm font-semibold"
        >
          {symbol}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
