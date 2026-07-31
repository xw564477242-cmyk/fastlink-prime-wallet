import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftRight, ChevronLeft, Loader2, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { useWalletTransferAccounts } from "@/hooks/use-wallet-transfer-accounts";
import {
  useWalletTransferMutation,
  type AcceptedWalletTransfer,
} from "@/hooks/use-wallet-transfer-mutation";
import { useWalletTransferStatusRefresh } from "@/hooks/use-wallet-transfer-status-refresh";
import {
  backendRuntime,
  isVirtualCardCreateEnvironment,
  type WalletOperationActivity,
} from "@/lib/backend-api";
import { useBackendSession } from "@/lib/backend-session";

export const Route = createFileRoute("/transfer")({
  head: () => ({
    meta: [
      { title: "FastLink — Internal Wallet transfer" },
      {
        name: "description",
        content: "Create one authenticated internal Wallet transfer in SANDBOX or TEST.",
      },
    ],
  }),
  component: InternalWalletTransferPage,
});

function InternalWalletTransferPage() {
  const { checking, session } = useBackendSession();
  const accounts = useWalletTransferAccounts(session);
  const refreshAccounts = accounts.refresh;
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [receipt, setReceipt] = useState<{
    contextKey: string;
    sourceAccountId: string;
    destinationAccountId: string;
    amount: string;
    transferRequestKey: string;
    transferGeneration: number;
    operation: WalletOperationActivity;
  } | null>(null);
  const activeAccounts = useMemo(
    () => accounts.accounts.filter((account) => account.status === "active"),
    [accounts.accounts],
  );
  const source = activeAccounts.find((account) => account.id === sourceAccountId) ?? null;
  const receiptContextKey =
    session && source
      ? JSON.stringify([
          session.actorId,
          session.expiresAt ?? null,
          session.tenantId,
          session.customerId,
          session.environment,
          source.id,
          destinationAccountId,
          amount,
        ])
      : null;
  const visibleReceipt =
    receiptContextKey !== null && receipt?.contextKey === receiptContextKey
      ? receipt.operation
      : null;

  useEffect(() => {
    if (accounts.loading) return;
    if (!activeAccounts.some((account) => account.id === sourceAccountId)) {
      setSourceAccountId(activeAccounts[0]?.id ?? "");
    }
  }, [accounts.loading, activeAccounts, sourceAccountId]);

  const input = useMemo(() => ({ destinationAccountId, amount }), [amount, destinationAccountId]);
  const handleAccepted = useCallback(
    (accepted: AcceptedWalletTransfer) => {
      if (!receiptContextKey || !source) return;
      setReceipt({
        contextKey: receiptContextKey,
        sourceAccountId: source.id,
        destinationAccountId: accepted.input.destinationAccountId,
        amount: accepted.input.amount,
        transferRequestKey: accepted.transferRequestKey,
        transferGeneration: accepted.transferGeneration,
        operation: accepted.operation,
      });
      refreshAccounts();
    },
    [receiptContextKey, refreshAccounts, source],
  );
  const transfer = useWalletTransferMutation(session, source, input, handleAccepted);
  const handleStatusRefreshed = useCallback((operation: WalletOperationActivity) => {
    setReceipt((current) =>
      current && current.operation.id === operation.id ? { ...current, operation } : current,
    );
  }, []);
  const statusRefresh = useWalletTransferStatusRefresh(
    session,
    visibleReceipt ? receipt : null,
    handleStatusRefreshed,
  );
  const runtimeAllowed =
    backendRuntime.error === null && isVirtualCardCreateEnvironment(backendRuntime.environment);

  const changeSource = (value: string) => {
    setReceipt(null);
    setSourceAccountId(value);
  };
  const changeDestination = (value: string) => {
    setReceipt(null);
    setDestinationAccountId(value);
  };
  const changeAmount = (value: string) => {
    setReceipt(null);
    setAmount(value);
  };

  return (
    <MobileShell>
      <StatusBar title="Internal transfer" />
      <main className="px-6 pb-10 pt-2">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Home
        </Link>

        <section className="mt-4 rounded-3xl bg-gradient-card p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/15 text-primary">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold">Wallet account transfer</h1>
              <p className="text-xs text-muted-foreground">
                Exact account ID contract · one request · no automatic retry
              </p>
            </div>
          </div>
        </section>

        {(checking || accounts.loading) && (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-surface p-5 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading scoped Wallet accounts
          </div>
        )}

        {!checking && !session && (
          <Message text="Connect an authenticated Backend session before creating a transfer." />
        )}
        {!checking && session && !runtimeAllowed && (
          <Message text="Wallet transfers are disabled outside SANDBOX and TEST." />
        )}
        {accounts.error && <Message text={`${accounts.error}. No stale account is displayed.`} />}

        {!accounts.loading && session && runtimeAllowed && !accounts.error && (
          <section className="mt-4 space-y-4 rounded-3xl border border-border/60 bg-surface p-5">
            <Field label="Source Wallet account">
              <select
                value={sourceAccountId}
                onChange={(event) => changeSource(event.target.value)}
                className="w-full rounded-2xl border border-border/60 bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              >
                {activeAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.assetCode} · {account.availableBalance} available · {account.id}
                  </option>
                ))}
              </select>
            </Field>

            {source && (
              <div className="flex items-center gap-3 rounded-2xl bg-muted/50 p-4">
                <Wallet className="h-5 w-5 text-primary" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Exact available balance</p>
                  <p translate="no" className="font-semibold tabular-nums">
                    {source.availableBalance} {source.assetCode}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">{source.id}</p>
                </div>
              </div>
            )}

            <Field label="Destination Wallet account ID">
              <input
                type="text"
                value={destinationAccountId}
                onChange={(event) => changeDestination(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="Exact accountId from the recipient"
                className="w-full rounded-2xl border border-border/60 bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              />
            </Field>

            <Field label={`Amount${source ? ` (${source.assetCode})` : ""}`}>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(event) => changeAmount(event.target.value)}
                autoComplete="off"
                placeholder="0.00"
                className="w-full rounded-2xl border border-border/60 bg-background px-4 py-3 text-sm tabular-nums outline-none focus:border-primary"
              />
              <p className="mt-2 text-[10px] text-muted-foreground">
                Positive canonical decimal, up to 18 fractional digits, never above the displayed
                available balance.
              </p>
            </Field>

            {activeAccounts.length === 0 && (
              <Message text="No active customer Wallet account is available for transfer." />
            )}
            {transfer.error && <Message text={transfer.error} />}

            <button
              type="button"
              disabled={!transfer.allowed || transfer.busy}
              onClick={() => void transfer.submit()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {transfer.busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              {transfer.busy ? "Submitting one request…" : "Create transfer operation"}
            </button>
          </section>
        )}

        {visibleReceipt && (
          <TransferReceipt operation={visibleReceipt} statusRefresh={statusRefresh} />
        )}
      </main>
    </MobileShell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold">{label}</span>
      {children}
    </label>
  );
}

function Message({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-border/60 bg-surface p-4 text-xs text-muted-foreground">
      {text}
    </div>
  );
}

function TransferReceipt({
  operation,
  statusRefresh,
}: {
  operation: WalletOperationActivity;
  statusRefresh: ReturnType<typeof useWalletTransferStatusRefresh>;
}) {
  return (
    <section className="mt-4 rounded-3xl border border-primary/30 bg-primary/5 p-5">
      <h2 className="font-display text-base font-semibold">Wallet operation accepted</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        The balance refresh has been requested. The operation status below is authoritative; this
        page does not assume instant settlement.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <ReceiptValue label="Status" value={operation.status} />
        <ReceiptValue label="Direction" value={operation.direction.replaceAll("_", " ")} />
        <ReceiptValue label="Amount" value={`${operation.amount} ${operation.assetCode}`} />
        <ReceiptValue label="Type" value={operation.type.replaceAll("_", " ")} />
      </dl>
      <p className="mt-3 break-all text-[10px] text-muted-foreground">
        Operation ID: {operation.id}
      </p>
      {statusRefresh.error && <Message text={statusRefresh.error} />}
      <button
        type="button"
        disabled={!statusRefresh.allowed || statusRefresh.loading}
        onClick={() => void statusRefresh.refresh()}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-background py-3 text-xs font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 ${statusRefresh.loading ? "animate-spin" : ""}`} />
        {statusRefresh.loading ? "Refreshing once…" : "Refresh operation status"}
      </button>
      <p className="mt-2 text-center text-[10px] text-muted-foreground">
        Manual read only. No polling, retry, or new transfer request.
      </p>
    </section>
  );
}

function ReceiptValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-background/70 p-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd translate="no" className="mt-1 font-semibold capitalize">
        {value}
      </dd>
    </div>
  );
}
