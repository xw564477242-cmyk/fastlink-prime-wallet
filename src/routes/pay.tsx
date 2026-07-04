import { createFileRoute } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { QrCode, Send, Store, Banknote, Search, Users, ChevronRight, Scan } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/pay")({
  head: () => ({
    meta: [
      { title: "FastLink — Pay" },
      { name: "description", content: "Pay via QR, transfer, merchant, and payout globally." },
    ],
  }),
  component: PayPage,
});

const contacts = [
  { name: "Alex", init: "AL", color: "bg-primary/20 text-primary" },
  { name: "Mei", init: "ME", color: "bg-accent/20 text-accent" },
  { name: "Kenji", init: "KE", color: "bg-sky-500/20 text-sky-400" },
  { name: "Sofia", init: "SO", color: "bg-purple-500/20 text-purple-400" },
];

const history = [
  { name: "Merchant · Uniqlo Tokyo", type: "Merchant Pay", amount: -48.2, time: "Today, 14:02" },
  { name: "Payout · HSBC ****3211", type: "Payout", amount: -1200.0, time: "Yesterday" },
  { name: "Alex Rivera", type: "Transfer", amount: -60.0, time: "2 Jul" },
  { name: "QR · Blue Bottle Coffee", type: "Pay QR", amount: -6.85, time: "1 Jul" },
];

function PayPage() {
  const [q, setQ] = useState("");
  const filtered = history.filter((h) => (h.name + h.type).toLowerCase().includes(q.toLowerCase()));

  return (
    <MobileShell>
      <StatusBar title="Pay" />
      <div className="px-6 pt-4">
        <h1 className="font-display text-2xl font-bold">Send & Pay</h1>
        <p className="mt-1 text-xs text-muted-foreground">Move money anywhere in seconds</p>

        {/* Scan hero */}
        <div className="mt-5 flex items-center justify-between overflow-hidden rounded-3xl bg-gradient-primary p-5 text-primary-foreground shadow-glow">
          <div>
            <p className="text-[10px] uppercase tracking-widest opacity-80">Scan to Pay</p>
            <p className="mt-1 font-display text-lg font-bold">Pay any QR instantly</p>
            <p className="mt-0.5 text-[11px] opacity-80">Supports Alipay · WeChat · UPI</p>
          </div>
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-background/20 backdrop-blur">
            <Scan className="h-8 w-8" />
          </div>
        </div>

        {/* Actions grid */}
        <div className="mt-5 grid grid-cols-4 gap-2">
          <PayAction icon={QrCode} label="Pay QR" />
          <PayAction icon={Send} label="Transfer" />
          <PayAction icon={Store} label="Merchant" />
          <PayAction icon={Banknote} label="Payout" />
        </div>

        {/* Wallet integrations */}
        <div className="mt-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Connected wallets</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <WalletTile brand="Apple Pay" sub="Added · iPhone" tone="bg-white/10" logo="" glyph="" />
            <WalletTile brand="Google Pay" sub="Added · Pixel" tone="bg-white/10" logo="" glyph="G" />
            <WalletTile brand="Alipay" sub="Link account" tone="bg-sky-500/15" glyph="支" />
            <WalletTile brand="WeChat Pay" sub="Link account" tone="bg-emerald-500/15" glyph="微" />
          </div>
        </div>

        {/* Contacts */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Frequent</p>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
            {contacts.map((c) => (
              <button key={c.name} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
                <div translate="no" className={`grid h-14 w-14 place-items-center rounded-full font-display text-sm font-bold ${c.color}`}>
                  {c.init}
                </div>
                <span className="text-[11px]">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Search history */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold">History</h3>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-surface px-4 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search payments"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="mt-3 space-y-2">
            {filtered.map((h) => (
              <div key={h.name} className="flex items-center gap-3 rounded-2xl bg-surface p-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted">
                  <Send className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{h.name}</p>
                  <p className="text-[11px] text-muted-foreground">{h.type} · {h.time}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums">{h.amount.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MobileShell>
  );
}

function PayAction({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button className="flex flex-col items-center gap-2 rounded-2xl bg-surface py-4 active:scale-95">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}

function WalletTile({ brand, sub, tone, glyph }: { brand: string; sub: string; tone: string; logo?: string; glyph?: string }) {
  return (
    <button className={`flex items-center gap-3 rounded-2xl ${tone} p-3 text-left backdrop-blur active:scale-95`}>
      <div translate="no" className="grid h-10 w-10 place-items-center rounded-xl bg-background/60 font-display text-sm font-bold">
        {glyph || brand[0]}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold">{brand}</p>
        <p className="truncate text-[10px] text-muted-foreground">{sub}</p>
      </div>
    </button>
  );
}
