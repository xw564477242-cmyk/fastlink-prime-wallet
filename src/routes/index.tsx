import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  QrCode,
  CreditCard,
  Send,
  Bell,
  Eye,
  EyeOff,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/i18n";
import { backendApi, type WalletCard, type WalletCardTransaction } from "@/lib/backend-api";
import { useBackendSession } from "@/lib/backend-session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FastLink — Home" },
      { name: "description", content: "FastLink wallet connected to Railway Backend." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const [hidden, setHidden] = useState(false);
  const [cards, setCards] = useState<WalletCard[]>([]);
  const [transactions, setTransactions] = useState<WalletCardTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLang();
  const { token, session } = useBackendSession();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      setCards([]);
      setTransactions([]);
      try {
        const rows = await backendApi.listCards(token);
        const groups = await Promise.all(
          rows.map((card) => backendApi.cardTransactions(token, card.cardId)),
        );
        if (cancelled) return;
        setCards(rows);
        setTransactions(
          groups
            .flat()
            .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
            .slice(0, 4),
        );
      } catch (reason) {
        if (!cancelled) {
          setCards([]);
          setTransactions([]);
          setError(reason instanceof Error ? reason.message : "Railway Backend is unavailable");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const cardTotals = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const card of cards) {
      grouped.set(card.currency, (grouped.get(card.currency) ?? 0) + card.balance);
    }
    return [...grouped.entries()];
  }, [cards]);

  const actions = [
    { icon: ArrowDownToLine, label: t("home.deposit"), href: "/deposit" as const },
    { icon: ArrowUpFromLine, label: t("home.withdraw"), href: "/withdraw" as const },
    { icon: ArrowLeftRight, label: t("home.convert"), href: "/convert" as const },
    { icon: QrCode, label: t("home.pay"), href: "/pay" as const },
    { icon: Send, label: t("home.transfer"), href: "/transfer" as const },
    { icon: CreditCard, label: t("home.cards"), href: "/cards" as const },
  ];

  return (
    <MobileShell>
      <StatusBar />
      <div className="flex items-center justify-between px-6 pt-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-primary font-bold text-primary-foreground shadow-glow">
            FL
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{t("home.welcome")}</p>
            <p translate="no" className="truncate text-sm font-semibold">
              {session?.actorId ?? "Unavailable"}
            </p>
          </div>
        </div>
        <button className="relative grid h-11 w-11 place-items-center rounded-full bg-surface">
          <Bell className="h-5 w-5" />
        </button>
      </div>

      <div className="mx-6 mt-6 overflow-hidden rounded-3xl bg-gradient-card p-6 shadow-card">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {t("home.totalBalance")}
          </p>
          <button onClick={() => setHidden((value) => !value)} className="text-muted-foreground">
            {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-3 font-display text-3xl font-bold tracking-tight" translate="no">
          {hidden ? "••••••" : "Unavailable"}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Railway Backend has no authenticated end-user wallet asset-summary contract.
        </p>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <MiniStat
            to="/assets/digital"
            label={t("home.digital")}
            value={hidden ? "••••" : "Unavailable"}
          />
          <MiniStat
            to="/assets/fiat"
            label={t("home.fiat")}
            value={hidden ? "••••" : "Unavailable"}
          />
          <MiniStat
            to="/assets/cards"
            label={t("home.card")}
            value={
              hidden
                ? "••••"
                : cardTotals.length
                  ? cardTotals
                      .map(([currency, value]) => `${value.toFixed(2)} ${currency}`)
                      .join(" · ")
                  : "Unavailable"
            }
            tone="accent"
          />
        </div>
      </div>

      {loading && (
        <div className="mx-6 mt-4 flex items-center gap-2 rounded-2xl bg-surface p-4 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading Railway Backend data
        </div>
      )}
      {!loading && error && (
        <div className="mx-6 mt-4 flex gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error} · No stale data displayed.</span>
        </div>
      )}

      <div className="mx-6 mt-6 grid grid-cols-3 gap-2">
        {actions.map((action) => (
          <Link
            key={action.label}
            to={action.href}
            className="flex flex-col items-center gap-2 rounded-2xl bg-surface py-4 transition-transform active:scale-95"
          >
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">
              <action.icon className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-medium">{action.label}</span>
          </Link>
        ))}
      </div>

      <div className="mx-6 mt-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold">{t("home.recent")}</h3>
          <Link to="/history" className="text-xs text-primary">
            {t("home.seeAll")}
          </Link>
        </div>
        <div className="mt-3 space-y-2">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center gap-3 rounded-2xl bg-surface p-4"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-foreground">
                <CreditCard className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{transaction.merchant}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(transaction.timestamp).toLocaleString()}
                </p>
              </div>
              <p translate="no" className="shrink-0 text-sm font-semibold tabular-nums">
                {transaction.amount.toFixed(2)} {transaction.currency}
              </p>
            </div>
          ))}
          {!loading && !error && transactions.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
              No transactions returned by Railway Backend.
            </div>
          )}
        </div>
      </div>
    </MobileShell>
  );
}

function MiniStat({
  to,
  label,
  value,
  tone,
}: {
  to: "/assets/digital" | "/assets/fiat" | "/assets/cards";
  label: string;
  value: string;
  tone?: "accent";
}) {
  return (
    <Link to={to} className="group rounded-2xl bg-background/40 p-3 text-left backdrop-blur">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p
        translate="no"
        className={`mt-1 break-words font-display text-xs font-semibold tabular-nums ${tone === "accent" ? "text-accent" : ""}`}
      >
        {value}
      </p>
    </Link>
  );
}
