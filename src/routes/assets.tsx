import { createFileRoute } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  Search,
  Plus,
  CreditCard,
  ChevronDown,
  X,
  Info,
  RefreshCw,
} from "lucide-react";
import { useState, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

type DigitalAsset = {
  sym: string;
  name: string;
  bal: string;
  usd: string;
  chg: number;
  color: string;
  networks: string[];
};

type FiatAsset = {
  sym: string;
  name: string;
  bal: string;
  flag: string;
};

const digital: DigitalAsset[] = [
  { sym: "USDT", name: "Tether", bal: "10,204.15", usd: "$10,204.15", chg: 0.01, color: "from-emerald-500 to-teal-500", networks: ["TRC20", "ERC20", "BEP20", "Polygon"] },
  { sym: "USDC", name: "USD Coin", bal: "4,120.00", usd: "$4,120.00", chg: 0.0, color: "from-sky-500 to-blue-600", networks: ["ERC20", "Solana", "BEP20"] },
  { sym: "BTC", name: "Bitcoin", bal: "0.0821", usd: "$5,320.40", chg: 1.42, color: "from-amber-500 to-orange-600", networks: ["Bitcoin", "Lightning"] },
  { sym: "ETH", name: "Ethereum", bal: "0.482", usd: "$1,842.20", chg: -0.86, color: "from-indigo-500 to-purple-600", networks: ["ERC20", "Arbitrum", "Optimism"] },
];

const fiat: FiatAsset[] = [
  { sym: "USD", name: "US Dollar", bal: "5,240.00", flag: "🇺🇸" },
  { sym: "EUR", name: "Euro", bal: "2,180.50", flag: "🇪🇺" },
  { sym: "HKD", name: "HK Dollar", bal: "1,148.20", flag: "🇭🇰" },
];

const fiatSymbols = fiat.map((f) => f.sym);
const digitalSymbols = digital.map((d) => d.sym);

// convert rates (mock) — 1 unit source -> target
const rates: Record<string, Record<string, number>> = {
  USDT: { EUR: 0.9187, USD: 1.0, HKD: 7.82, USDC: 0.9998, BTC: 0.0000155, ETH: 0.000262 },
  USDC: { EUR: 0.9185, USD: 1.0, HKD: 7.82, USDT: 1.0002 },
  BTC: { USDT: 64500, USD: 64500, EUR: 59254 },
  ETH: { USDT: 3820, USD: 3820, EUR: 3510 },
  USD: { USDT: 1.0, USDC: 1.0, EUR: 0.9187, HKD: 7.82, BTC: 0.0000155, ETH: 0.000262 },
  EUR: { USDT: 1.088, USDC: 1.088, USD: 1.088, HKD: 8.51, BTC: 0.0000169 },
  HKD: { USDT: 0.128, USD: 0.128, EUR: 0.1175 },
};

type ActionKind =
  | { kind: "deposit"; sym: string }
  | { kind: "withdraw"; sym: string }
  | { kind: "convert"; from: string; to: string }
  | { kind: "fund-card"; sym: string }
  | { kind: "create" }
  | null;

export const Route = createFileRoute("/assets")({
  head: () => ({
    meta: [
      { title: "FastLink — Wallets" },
      { name: "description", content: "Digital assets, fiat wallets and instant conversion." },
    ],
  }),
  component: AssetsPage,
});

function AssetsPage() {
  const [tab, setTab] = useState<"digital" | "fiat">("digital");
  const [action, setAction] = useState<ActionKind>(null);
  const [query, setQuery] = useState("");

  const filteredDigital = useMemo(
    () => digital.filter((a) => (a.sym + a.name).toLowerCase().includes(query.toLowerCase())),
    [query],
  );
  const filteredFiat = useMemo(
    () => fiat.filter((a) => (a.sym + a.name).toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  return (
    <MobileShell>
      <StatusBar title="Wallets" />
      <div className="px-6 pt-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">My Wallets</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Total portfolio · <span className="text-foreground font-semibold">$28,412.90</span>
            </p>
          </div>
          <button
            onClick={() => setAction({ kind: "create" })}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-2 text-xs font-semibold text-primary active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" /> Add Asset
          </button>
        </div>

        {/* Allocation */}
        <div className="mt-5 rounded-3xl bg-surface p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Asset Allocation</p>
          <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[52%] bg-primary" />
            <div className="h-full w-[18%] bg-sky-500" />
            <div className="h-full w-[30%] bg-accent" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
            <Legend dot="bg-primary" label="USDT" pct="52%" />
            <Legend dot="bg-sky-500" label="USDC" pct="18%" />
            <Legend dot="bg-accent" label="Fiat" pct="30%" />
          </div>
        </div>

        {/* Global quick actions */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          <ActionBtn onClick={() => setAction({ kind: "deposit", sym: "USDT" })} icon={ArrowDownToLine} label="Deposit" />
          <ActionBtn onClick={() => setAction({ kind: "withdraw", sym: "USDT" })} icon={ArrowUpFromLine} label="Withdraw" />
          <ActionBtn onClick={() => setAction({ kind: "convert", from: "USDT", to: "EUR" })} icon={ArrowLeftRight} label="Convert" />
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-2 rounded-full bg-surface p-1">
          {[
            { k: "digital", l: "Digital Assets" },
            { k: "fiat", l: "Fiat Wallets" },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k as "digital" | "fiat")}
              className={`flex-1 rounded-full py-2 text-xs font-semibold transition-colors ${tab === t.k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {t.l}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-surface px-4 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search asset"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-muted-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {tab === "digital"
            ? filteredDigital.map((a) => (
                <DigitalRow key={a.sym} a={a} onAction={setAction} />
              ))
            : filteredFiat.map((a) => (
                <FiatRow key={a.sym} a={a} onAction={setAction} />
              ))}

          {tab === "digital" && (
            <button
              onClick={() => setAction({ kind: "create" })}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-surface/40 py-4 text-xs font-semibold text-muted-foreground active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" /> Create new wallet
            </button>
          )}
        </div>
      </div>

      <ActionSheet action={action} onOpenChange={(o) => !o && setAction(null)} setAction={setAction} />
    </MobileShell>
  );
}

function DigitalRow({ a, onAction }: { a: DigitalAsset; onAction: (a: ActionKind) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br ${a.color} font-display text-xs font-bold text-white`}>
          {a.sym.slice(0, 3)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{a.name}</p>
          <p className="text-[11px] text-muted-foreground tabular-nums">{a.bal} {a.sym}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums">{a.usd}</p>
          <p className={`inline-flex items-center gap-0.5 text-[10px] tabular-nums ${a.chg >= 0 ? "text-primary" : "text-destructive"}`}>
            {a.chg >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {a.chg >= 0 ? "+" : ""}{a.chg.toFixed(2)}%
          </p>
        </div>
        <ChevronDown className={`ml-1 h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="grid grid-cols-4 gap-1.5 border-t border-border/60 p-3">
          <RowAction icon={ArrowDownToLine} label="Deposit" onClick={() => onAction({ kind: "deposit", sym: a.sym })} />
          <RowAction icon={ArrowUpFromLine} label="Withdraw" onClick={() => onAction({ kind: "withdraw", sym: a.sym })} />
          <RowAction icon={ArrowLeftRight} label="Convert" onClick={() => onAction({ kind: "convert", from: a.sym, to: "EUR" })} />
          <RowAction icon={Plus} label="Create" onClick={() => onAction({ kind: "create" })} />
        </div>
      )}
    </div>
  );
}

function FiatRow({ a, onAction }: { a: FiatAsset; onAction: (a: ActionKind) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted text-lg">{a.flag}</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{a.name}</p>
          <p className="text-[11px] text-muted-foreground">{a.sym}</p>
        </div>
        <p className="text-sm font-semibold tabular-nums">{a.bal}</p>
        <ChevronDown className={`ml-1 h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="grid grid-cols-3 gap-1.5 border-t border-border/60 p-3">
          <RowAction icon={CreditCard} label="Fund Card" onClick={() => onAction({ kind: "fund-card", sym: a.sym })} />
          <RowAction icon={ArrowLeftRight} label="To Crypto" onClick={() => onAction({ kind: "convert", from: a.sym, to: "USDT" })} />
          <RowAction icon={ArrowDownToLine} label="Deposit" onClick={() => onAction({ kind: "deposit", sym: a.sym })} />
        </div>
      )}
    </div>
  );
}

function RowAction({ icon: Icon, label, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-xl bg-background/60 py-2.5 text-[10px] font-medium active:scale-95"
    >
      <Icon className="h-4 w-4 text-primary" />
      {label}
    </button>
  );
}

function ActionBtn({ onClick, icon: Icon, label }: { onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 rounded-2xl bg-surface py-4 active:scale-95">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}

function Legend({ dot, label, pct }: { dot: string; label: string; pct: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto tabular-nums font-semibold text-foreground">{pct}</span>
    </div>
  );
}

// ============= Action Sheet =============

function ActionSheet({
  action,
  onOpenChange,
  setAction,
}: {
  action: ActionKind;
  onOpenChange: (open: boolean) => void;
  setAction: (a: ActionKind) => void;
}) {
  return (
    <Sheet open={!!action} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-md rounded-t-3xl border-border/60 bg-background p-0">
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-muted" />
        <div className="px-6 pb-8 pt-4">
          {action?.kind === "deposit" && <DepositPanel sym={action.sym} />}
          {action?.kind === "withdraw" && <WithdrawPanel sym={action.sym} />}
          {action?.kind === "convert" && (
            <ConvertPanel from={action.from} to={action.to} setAction={setAction} />
          )}
          {action?.kind === "fund-card" && <FundCardPanel sym={action.sym} />}
          {action?.kind === "create" && <CreatePanel />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PanelHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <SheetHeader className="mb-4 text-left">
      <SheetTitle className="font-display text-xl">{title}</SheetTitle>
      <SheetDescription className="text-xs">{desc}</SheetDescription>
    </SheetHeader>
  );
}

function DepositPanel({ sym }: { sym: string }) {
  const asset = digital.find((d) => d.sym === sym);
  const networks = asset?.networks ?? ["Bank Transfer", "SEPA", "SWIFT"];
  const [net, setNet] = useState(networks[0]);
  return (
    <>
      <PanelHeader title={`Deposit ${sym}`} desc={asset ? "Send crypto to the address below" : "Fund your fiat wallet"} />
      <div className="space-y-3">
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Network</p>
          <div className="flex flex-wrap gap-2">
            {networks.map((n) => (
              <button
                key={n}
                onClick={() => setNet(n)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${net === n ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-surface p-5 text-center">
          <div className="mx-auto grid h-40 w-40 place-items-center rounded-xl bg-white p-2">
            <div className="h-full w-full bg-[conic-gradient(#0f172a_0deg,#0f172a_10deg,transparent_10deg_20deg,#0f172a_20deg_35deg,transparent_35deg_50deg,#0f172a_50deg_60deg)] bg-[length:12px_12px]" />
          </div>
          <p className="mt-3 truncate font-mono text-xs">T9zK…c3aE2v · {net}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">Min. deposit 1 {sym} · ~1 min</p>
        </div>
        <button className="w-full rounded-2xl bg-gradient-primary py-4 font-display text-sm font-semibold text-primary-foreground shadow-glow active:scale-[0.98]">
          Copy Address
        </button>
      </div>
    </>
  );
}

function WithdrawPanel({ sym }: { sym: string }) {
  const asset = digital.find((d) => d.sym === sym);
  const networks = asset?.networks ?? ["Bank Transfer", "SEPA", "SWIFT"];
  const [net, setNet] = useState(networks[0]);
  const [amount, setAmount] = useState("");
  const [addr, setAddr] = useState("");
  return (
    <>
      <PanelHeader title={`Withdraw ${sym}`} desc="Send to an external address or bank" />
      <div className="space-y-3">
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Network</p>
          <div className="flex flex-wrap gap-2">
            {networks.map((n) => (
              <button
                key={n}
                onClick={() => setNet(n)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${net === n ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-surface p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Address</p>
          <input
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            placeholder="Paste destination"
            className="mt-1 w-full bg-transparent font-mono text-sm outline-none"
          />
        </div>
        <div className="rounded-2xl bg-surface p-4">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>Amount</span>
            <span>Fee 0.1 {sym}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="min-w-0 flex-1 bg-transparent font-display text-2xl font-bold tabular-nums outline-none"
            />
            <span className="text-sm font-semibold">{sym}</span>
          </div>
        </div>
        <button className="w-full rounded-2xl bg-gradient-primary py-4 font-display text-sm font-semibold text-primary-foreground shadow-glow active:scale-[0.98]">
          Withdraw {sym}
        </button>
      </div>
    </>
  );
}

function ConvertPanel({ from: initFrom, to: initTo, setAction }: { from: string; to: string; setAction: (a: ActionKind) => void }) {
  const [from, setFrom] = useState(initFrom);
  const [to, setTo] = useState(initTo);
  const [amount, setAmount] = useState("500");
  const rate = rates[from]?.[to] ?? 1;
  const parsed = parseFloat(amount || "0") || 0;
  const result = (parsed * rate).toFixed(from === "BTC" || from === "ETH" ? 4 : 2);
  const allSymbols = [...digitalSymbols, ...fiatSymbols];

  return (
    <>
      <PanelHeader title="Convert" desc="Instant zero-fee swap between crypto and fiat" />
      <div className="relative space-y-2">
        <SwapCard label="You pay" symbol={from} onSymbol={setFrom} value={amount} onChange={setAmount} options={allSymbols} />
        <button
          onClick={() => { const f = from; setFrom(to); setTo(f); }}
          className="absolute left-1/2 top-1/2 z-10 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-glow"
        >
          <ArrowLeftRight className="h-4 w-4" />
        </button>
        <SwapCard label="You receive" symbol={to} onSymbol={setTo} value={result} readOnly options={allSymbols} />
      </div>
      <div className="mt-4 rounded-2xl bg-surface p-4">
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
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-2xl border border-border/60 bg-surface/40 p-3">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
        <p className="text-[11px] text-muted-foreground">
          Rate locked for 10s. Converted funds credit to your {to} wallet instantly.
        </p>
      </div>
      <button
        onClick={() => setAction(null)}
        className="mt-5 w-full rounded-2xl bg-gradient-primary py-4 font-display text-base font-semibold text-primary-foreground shadow-glow active:scale-[0.98]"
      >
        Convert {parsed.toFixed(2)} {from}
      </button>
    </>
  );
}

function SwapCard({
  label, symbol, onSymbol, value, onChange, readOnly, options,
}: {
  label: string; symbol: string; onSymbol: (s: string) => void;
  value: string; onChange?: (v: string) => void; readOnly?: boolean; options: string[];
}) {
  return (
    <div className="rounded-3xl bg-surface p-5">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="mt-3 flex items-center gap-3">
        <input
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
          inputMode="decimal"
          className="min-w-0 flex-1 bg-transparent font-display text-3xl font-bold tabular-nums outline-none"
        />
        <select
          value={symbol}
          onChange={(e) => onSymbol(e.target.value)}
          className="shrink-0 rounded-full bg-background px-3 py-2 text-sm font-semibold outline-none"
        >
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function FundCardPanel({ sym }: { sym: string }) {
  const [amount, setAmount] = useState("");
  return (
    <>
      <PanelHeader title={`Fund Card from ${sym}`} desc="Move balance to your FastLink Platinum card" />
      <div className="space-y-3">
        <div className="rounded-3xl bg-gradient-visa p-5 text-white shadow-card">
          <p className="text-[10px] uppercase tracking-widest text-white/60">Platinum · •••• 4829</p>
          <p className="mt-2 font-display text-lg font-semibold tabular-nums">$1,842.60</p>
        </div>
        <div className="rounded-2xl bg-surface p-4">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>Amount</span>
            <span>Balance {sym}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="min-w-0 flex-1 bg-transparent font-display text-2xl font-bold tabular-nums outline-none"
            />
            <span className="text-sm font-semibold">{sym}</span>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {["50", "100", "500", "Max"].map((q) => (
            <button
              key={q}
              onClick={() => setAmount(q === "Max" ? "1000" : q)}
              className="rounded-full bg-surface py-2 text-xs font-semibold text-muted-foreground active:scale-95"
            >
              {q}
            </button>
          ))}
        </div>
        <button className="w-full rounded-2xl bg-gradient-primary py-4 font-display text-sm font-semibold text-primary-foreground shadow-glow active:scale-[0.98]">
          Fund Card
        </button>
      </div>
    </>
  );
}

function CreatePanel() {
  const [q, setQ] = useState("");
  const list = [
    { sym: "SOL", name: "Solana" },
    { sym: "TON", name: "Toncoin" },
    { sym: "MATIC", name: "Polygon" },
    { sym: "XRP", name: "Ripple" },
    { sym: "DAI", name: "Dai" },
    { sym: "ARB", name: "Arbitrum" },
  ].filter((a) => (a.sym + a.name).toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PanelHeader title="Create Wallet" desc="Add a new digital asset wallet to your portfolio" />
      <div className="flex items-center gap-2 rounded-2xl bg-surface px-4 py-2.5">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search token"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
        {list.map((a) => (
          <button
            key={a.sym}
            className="flex w-full items-center gap-3 rounded-2xl bg-surface p-4 text-left active:scale-[0.98]"
          >
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 font-display text-xs font-bold text-primary">
              {a.sym.slice(0, 3)}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{a.name}</p>
              <p className="text-[11px] text-muted-foreground">{a.sym}</p>
            </div>
            <Plus className="h-4 w-4 text-primary" />
          </button>
        ))}
      </div>
    </>
  );
}
