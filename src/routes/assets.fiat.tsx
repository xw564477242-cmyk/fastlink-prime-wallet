import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  Loader2,
  Wallet,
} from "lucide-react";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { useBackendSession } from "@/lib/backend-session";
import { useWalletAccountHistory } from "@/hooks/use-wallet-account-history";

export const Route = createFileRoute("/assets/fiat")({
  head: () => ({
    meta: [
      { title: "FastLink — Wallet Accounts" },
      { name: "description", content: "Scoped Wallet balances and transaction history." },
    ],
  }),
  component: WalletAccountsPage,
});

function WalletAccountsPage() {
  const { session } = useBackendSession();
  const { accounts, transactions, selectAccount, loadMore } = useWalletAccountHistory(session);
  const selected =
    accounts.accounts.find((account) => account.assetCode === accounts.selectedAssetCode) ?? null;

  return (
    <MobileShell>
      <StatusBar title="Wallet accounts" />
      <div className="px-6 pt-2">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Home
        </Link>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {accounts.accounts.map((account) => (
            <button
              key={account.assetCode}
              type="button"
              onClick={() => selectAccount(account.assetCode)}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold ${
                account.assetCode === selected?.assetCode
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/60 bg-surface text-muted-foreground"
              }`}
            >
              {account.assetCode}
            </button>
          ))}
        </div>

        {accounts.loading && (
          <div className="grid h-48 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        {!accounts.loading && accounts.error && (
          <ErrorMessage message={`${accounts.error} · No stale Wallet account displayed.`} />
        )}
        {!accounts.loading && !accounts.error && selected && (
          <div className="mt-4 rounded-3xl bg-gradient-card p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/15 text-primary">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Available balance</p>
                <p translate="no" className="font-display text-2xl font-bold tabular-nums">
                  {selected.availableBalance} {selected.assetCode}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <Balance label="Ledger" value={selected.ledgerBalance} asset={selected.assetCode} />
              <Balance label="Pending" value={selected.pendingBalance} asset={selected.assetCode} />
            </div>
            <p className="mt-3 text-[10px] text-muted-foreground">
              Amount strings are displayed exactly as returned by Railway Backend.
            </p>
          </div>
        )}

        <h2 className="mt-6 font-display text-lg font-semibold">Account history</h2>
        {transactions.loading && (
          <div className="grid h-40 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        {!transactions.loading && transactions.error && (
          <ErrorMessage message={`${transactions.error} · No stale Wallet history displayed.`} />
        )}
        {!transactions.loading && !transactions.error && (
          <div className="mt-3 space-y-2">
            {transactions.items.map((item) => {
              const outgoing = item.direction === "outgoing";
              const Icon = outgoing ? ArrowUpRight : ArrowDownLeft;
              return (
                <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-surface p-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.type.replaceAll("_", " ")}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString()} · {item.status}
                    </p>
                  </div>
                  <p translate="no" className="shrink-0 text-sm font-semibold tabular-nums">
                    {outgoing ? "−" : "+"}
                    {item.amount} {item.assetCode}
                  </p>
                </div>
              );
            })}
            {transactions.items.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-xs text-muted-foreground">
                No Wallet transactions returned for this account.
              </div>
            )}
            {transactions.nextCursor && (
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={transactions.loadingMore}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 bg-surface/60 py-3 text-xs font-semibold disabled:opacity-50"
              >
                {transactions.loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                {transactions.loadingMore ? "Loading more…" : "Load more transactions"}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="h-8" />
    </MobileShell>
  );
}

function Balance({ label, value, asset }: { label: string; value: string; asset: string }) {
  return (
    <div className="rounded-2xl bg-background/40 p-3">
      <p className="text-muted-foreground">{label}</p>
      <p translate="no" className="mt-1 font-semibold tabular-nums">
        {value} {asset}
      </p>
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="mt-4 flex gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
