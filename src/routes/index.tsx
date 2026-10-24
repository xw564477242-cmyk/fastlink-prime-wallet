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
  RefreshCw,
  History,
  ShieldCheck,
  Layers,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { backendApi, type WalletCardTransaction } from "@/lib/backend-api";
import { useBackendSession } from "@/lib/backend-session";
import { useHomeWalletBalances } from "@/hooks/use-home-wallet-balances";
import { clientRequestAllowed, isWalletOnlyPreview } from "@/lib/launch-readonly-policy";

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
  const [transactions, setTransactions] = useState<WalletCardTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLang();
  const { session, invalidate } = useBackendSession();
  const walletOnly = isWalletOnlyPreview();
  const balancesSupported = clientRequestAllowed("/v1/wallet/balances");
  const walletBalances = useHomeWalletBalances(balancesSupported ? session : null, invalidate);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      setTransactions([]);
      // The Wallet-only preview reads wallet history on /history, never card transactions.
      if (walletOnly) {
        setLoading(false);
        return;
      }
      try {
        if (!session) throw new Error("Authenticated session is required");
        const { cards: rows } = await backendApi.listCards();
        const groups = await Promise.all(
          rows.map((card) => backendApi.cardTransactions(session, card.cardId, { limit: 4 })),
        );
        if (cancelled) return;
        setTransactions(
          groups
            .flatMap((page) => page.transactions)
            .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
            .slice(0, 4),
        );
      } catch (reason) {
        if (!cancelled) {
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
  }, [session, walletOnly]);

  const actions = [
    { icon: Layers, label: t("nav.assets"), href: "/assets/digital" as const },
    { icon: History, label: t("page.history"), href: "/history" as const },
    { icon: ShieldCheck, label: t("page.kyc"), href: "/kyc" as const },
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
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {t("home.totalBalance")}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Refresh Wallet balances"
              onClick={walletBalances.refresh}
              disabled={!walletBalances.canRefresh}
              className="text-muted-foreground disabled:opacity-40"
            >
              <RefreshCw className={`h-4 w-4 ${walletBalances.refreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              aria-label={hidden ? "Show Wallet balances" : "Hide Wallet balances"}
              onClick={() => setHidden((value) => !value)}
              className="text-muted-foreground"
            >
              {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div
          className="mt-3 max-h-40 space-y-1 overflow-y-auto font-display text-3xl font-bold tracking-tight"
          translate="no"
        >
          {hidden ? (
            <p>••••••</p>
          ) : walletBalances.accounts.length ? (
            walletBalances.accounts.map((account) => (
              <p key={account.assetCode}>
                {account.availableBalance} {account.assetCode}
              </p>
            ))
          ) : (
            <p>Unavailable</p>
          )}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Authenticated Wallet balances are shown per asset without cross-currency aggregation.
        </p>
        {walletBalances.loading && (
          <p className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading Wallet balances
          </p>
        )}
        {!walletBalances.loading && walletBalances.error && (
          <p className="mt-2 text-[10px] text-destructive">
            {walletBalances.error} · No stale Wallet balance displayed.
          </p>
        )}
        {walletOnly && !session && (
          <p className="mt-2 text-[10px] text-muted-foreground">请先登录后查看余额。</p>
        )}
        {walletOnly &&
          session &&
          !walletBalances.loading &&
          !walletBalances.error &&
          walletBalances.accounts.length === 0 && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              当前账户未返回钱包账户；这不表示余额为零。
            </p>
          )}
        {walletBalances.refreshError && (
          <p className="mt-2 text-[10px] text-destructive">
            {walletBalances.refreshError} · Existing verified balances kept.
          </p>
        )}
        <div className="mt-5 grid grid-cols-3 gap-2">
          <MiniStat to="/assets/digital" label={t("home.digital")} value="查看明细" />
          <MiniStat to="/assets/fiat" label={t("home.fiat")} value="查看明细" />
          <MiniStat to="/cards" label={t("home.card")} value="查看卡状态" tone="accent" />
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
                {transaction.amountMinor} {transaction.currency} minor units
              </p>
            </div>
          ))}
          {walletOnly && (
            <Link
              to="/history"
              className="flex items-center gap-3 rounded-2xl border border-border/50 bg-surface p-4 text-xs leading-5 text-muted-foreground"
            >
              <History className="h-5 w-5 shrink-0 text-primary" />
              查看真实钱包交易记录，按币种筛选并展开详情。卡片交易尚未开放。
            </Link>
          )}
          {!walletOnly && !loading && !error && transactions.length === 0 && (
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
  to: "/assets/digital" | "/assets/fiat" | "/cards";
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
