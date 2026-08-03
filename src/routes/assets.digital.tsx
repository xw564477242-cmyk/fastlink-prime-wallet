import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, Coins, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { useDigitalAssetHistory } from "@/hooks/use-digital-asset-history";
import { useBackendSession } from "@/lib/backend-session";
import {
  WALLET_TRANSACTION_STATUSES,
  WALLET_TRANSACTION_TYPES,
  type WalletTransactionStatusFilter,
  type WalletTransactionTypeFilter,
} from "@/lib/backend-api";
import { walletTransactionSelectionForSnapshot } from "@/lib/wallet-transaction-selection-state";

export const Route = createFileRoute("/assets/digital")({
  head: () => ({
    meta: [
      { title: "FastLink — Digital assets" },
      {
        name: "description",
        content: "Read-only digital asset balances and owned account history.",
      },
    ],
  }),
  component: DigitalAssetsPage,
});

export function DigitalAssetsPage() {
  const { session, invalidate: invalidateSession } = useBackendSession();
  const [type, setType] = useState<WalletTransactionTypeFilter | undefined>();
  const [status, setStatus] = useState<WalletTransactionStatusFilter | undefined>();
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const digital = useDigitalAssetHistory(session, { type, status }, invalidateSession);
  const account = digital.assets.selectedAccount;
  const selection = walletTransactionSelectionForSnapshot(
    selectedTransactionId,
    account?.assetCode ?? null,
    digital.transactions.items,
  );

  useEffect(() => {
    setSelectedTransactionId(null);
  }, [account?.id]);

  useEffect(() => {
    if (
      !digital.transactions.scopeReady ||
      digital.transactions.loading ||
      digital.transactions.refreshing ||
      digital.transactions.error ||
      digital.transactions.refreshError
    ) {
      return;
    }
    setSelectedTransactionId(
      (current) =>
        walletTransactionSelectionForSnapshot(
          current,
          account?.assetCode ?? null,
          digital.transactions.items,
        ).selectedId,
    );
  }, [
    account?.id,
    account?.assetCode,
    digital.transactions.error,
    digital.transactions.items,
    digital.transactions.loading,
    digital.transactions.refreshError,
    digital.transactions.refreshing,
    digital.transactions.scopeKey,
    digital.transactions.scopeReady,
  ]);

  return (
    <MobileShell>
      <StatusBar title="Digital assets" />
      <main className="px-6 pb-10 pt-2">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Home
        </Link>

        <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-semibold">Read-only digital asset view</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Metadata comes from the Wallet asset catalog. Balances and history are limited to
            accounts owned by this authenticated session. Trading, deposit and withdrawal actions
            are not available here.
          </p>
        </div>

        <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
          {digital.assets.accounts.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSelectedTransactionId(null);
                digital.selectAccount(item.id);
              }}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold ${
                item.id === account?.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/60 bg-surface text-muted-foreground"
              }`}
            >
              {item.assetCode}
            </button>
          ))}
          <button
            type="button"
            aria-label="Refresh digital asset accounts"
            onClick={digital.refreshAssets}
            disabled={!digital.canRefreshAssets}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border/60 bg-surface disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${digital.assets.refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {digital.assets.loading && <Loading label="Loading owned digital assets" />}
        {!digital.assets.loading && digital.assets.error && (
          <ErrorMessage message={`${digital.assets.error} · No stale balance displayed.`} />
        )}
        {digital.assets.refreshError && (
          <ErrorMessage message={`${digital.assets.refreshError} · Existing snapshot kept.`} />
        )}
        {!digital.assets.loading && !digital.assets.error && !account && (
          <div className="mt-4 rounded-2xl border border-dashed border-border/60 p-8 text-center text-xs text-muted-foreground">
            No session-owned DIGITAL account was returned.
          </div>
        )}
        {!digital.assets.loading && !digital.assets.error && account && (
          <section className="mt-4 rounded-3xl bg-gradient-card p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/15 text-primary">
                <Coins className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Available balance</p>
                <p translate="no" className="font-display text-2xl font-bold tabular-nums">
                  {account.availableBalance} {account.assetCode}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <Balance label="Current" value={account.currentBalance} asset={account.assetCode} />
              <Balance label="Posted" value={account.postedBalance} asset={account.assetCode} />
              <Balance label="Pending" value={account.pendingBalance} asset={account.assetCode} />
              <Balance label="Status" value={account.status} />
            </div>
            <p className="mt-3 text-[10px] text-muted-foreground">
              Amount strings are displayed exactly as returned by Railway Backend.
            </p>
          </section>
        )}

        {account && (
          <section>
            <h2 className="mt-6 font-display text-lg font-semibold">Owned account history</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Filter
                label="Type"
                ariaLabel="Digital asset transaction type"
                value={type ?? ""}
                values={WALLET_TRANSACTION_TYPES}
                onChange={(value) => {
                  setSelectedTransactionId(null);
                  setType(value === "" ? undefined : (value as WalletTransactionTypeFilter));
                }}
              />
              <Filter
                label="Status"
                ariaLabel="Digital asset transaction status"
                value={status ?? ""}
                values={WALLET_TRANSACTION_STATUSES}
                onChange={(value) => {
                  setSelectedTransactionId(null);
                  setStatus(value === "" ? undefined : (value as WalletTransactionStatusFilter));
                }}
              />
            </div>
            <button
              type="button"
              onClick={digital.refreshHistory}
              disabled={!digital.canRefreshHistory}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 bg-surface/60 py-3 text-xs font-semibold disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${digital.transactions.refreshing ? "animate-spin" : ""}`}
              />
              {digital.transactions.refreshing ? "Refreshing history…" : "Refresh history"}
            </button>
            {digital.transactions.refreshError && (
              <ErrorMessage
                message={`${digital.transactions.refreshError} · Existing history kept.`}
              />
            )}
            {digital.transactions.loading && <Loading label="Loading owned account history" />}
            {!digital.transactions.loading && digital.transactions.error && (
              <ErrorMessage
                message={`${digital.transactions.error} · No stale history displayed.`}
              />
            )}
            {!digital.transactions.loading && !digital.transactions.error && (
              <div className="mt-3 space-y-2">
                {digital.transactions.items.map((item) => {
                  const outgoing = item.direction === "outgoing";
                  const Icon = outgoing ? ArrowUpRight : ArrowDownLeft;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedTransactionId(item.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left ${
                        item.id === selection.selectedId
                          ? "border-primary bg-primary/5"
                          : "border-transparent bg-surface"
                      }`}
                    >
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {item.type.replaceAll("_", " ")}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleString()} · {item.status}
                        </p>
                      </div>
                      <p translate="no" className="shrink-0 text-sm font-semibold tabular-nums">
                        {outgoing ? "−" : "+"}
                        {item.amount} {item.assetCode}
                      </p>
                    </button>
                  );
                })}
                {digital.transactions.items.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-xs text-muted-foreground">
                    No transactions returned for this owned digital account.
                  </div>
                )}
                {digital.transactions.nextCursor && (
                  <button
                    type="button"
                    onClick={() => void digital.loadMore()}
                    disabled={digital.transactions.loadingMore || digital.transactions.refreshing}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 bg-surface/60 py-3 text-xs font-semibold disabled:opacity-50"
                  >
                    {digital.transactions.loadingMore && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {digital.transactions.loadingMore ? "Loading more…" : "Load more"}
                  </button>
                )}
              </div>
            )}
          </section>
        )}
      </main>
    </MobileShell>
  );
}

function Filter({
  label,
  ariaLabel,
  value,
  values,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  value: string;
  values: readonly string[];
  onChange(value: string): void;
}) {
  return (
    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-border/60 bg-surface px-3 py-2 text-xs normal-case tracking-normal text-foreground"
      >
        <option value="">All</option>
        {values.map((item) => (
          <option key={item} value={item}>
            {item.replaceAll("_", " ").toLowerCase()}
          </option>
        ))}
      </select>
    </label>
  );
}

function Balance({ label, value, asset }: { label: string; value: string; asset?: string }) {
  return (
    <div className="rounded-2xl bg-surface/60 p-3">
      <p className="text-muted-foreground">{label}</p>
      <p translate="no" className="mt-1 font-semibold tabular-nums">
        {value}
        {asset ? ` ${asset}` : ""}
      </p>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-surface p-8 text-xs text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin text-primary" /> {label}
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="mt-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
      {message}
    </div>
  );
}
