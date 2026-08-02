import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeftRight,
  ChevronLeft,
  Clock3,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useReducer, useState, type ReactNode } from "react";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { useFxQuote } from "@/hooks/use-fx-quote";
import { backendRuntime } from "@/lib/backend-api";
import { useBackendSession } from "@/lib/backend-session";

const ASSETS = ["USD", "MYR", "SGD", "EUR", "GBP", "USDT"] as const;

export const Route = createFileRoute("/convert")({
  head: () => ({
    meta: [
      { title: "FastLink — FX quote preview" },
      {
        name: "description",
        content: "Request one authenticated synthetic FX quote in SANDBOX or TEST.",
      },
    ],
  }),
  component: ConvertPage,
});

export function ConvertPage() {
  const { checking, session } = useBackendSession();
  const [sourceAssetCode, setSourceAssetCode] = useState("USD");
  const [targetAssetCode, setTargetAssetCode] = useState("MYR");
  const [sourceAmount, setSourceAmount] = useState("100");
  const [inputGeneration, changeInputGeneration] = useReducer((value: number) => value + 1, 0);
  const quote = useFxQuote(
    session,
    { sourceAssetCode, targetAssetCode, sourceAmount },
    inputGeneration,
  );

  const changeSource = (value: string) => {
    changeInputGeneration();
    setSourceAssetCode(value);
  };
  const changeTarget = (value: string) => {
    changeInputGeneration();
    setTargetAssetCode(value);
  };
  const changeAmount = (value: string) => {
    changeInputGeneration();
    setSourceAmount(value);
  };

  const runtimeReady =
    backendRuntime.error === null &&
    (backendRuntime.environment === "SANDBOX" || backendRuntime.environment === "TEST");

  return (
    <MobileShell>
      <StatusBar title="Synthetic FX" />
      <header className="flex items-center gap-3 px-6 pt-3">
        <Link
          to="/"
          aria-label="Back to wallet home"
          className="grid h-10 w-10 place-items-center rounded-full bg-surface"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-primary">Read-only preview</p>
          <h1 className="font-display text-xl font-semibold">Currency conversion quote</h1>
        </div>
      </header>

      <main className="px-6 pb-10 pt-5">
        <section className="rounded-3xl border border-border/60 bg-surface p-5 shadow-card">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display font-semibold">One synthetic quote</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Each click sends one authenticated quote request. It does not submit a conversion,
                move funds, poll, or retry automatically.
              </p>
            </div>
          </div>

          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void quote.requestQuote();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="From">
                <select
                  aria-label="Source asset"
                  value={sourceAssetCode}
                  onChange={(event) => changeSource(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-border bg-background px-3 text-sm"
                >
                  {ASSETS.map((asset) => (
                    <option key={asset}>{asset}</option>
                  ))}
                </select>
              </Field>
              <Field label="To">
                <select
                  aria-label="Target asset"
                  value={targetAssetCode}
                  onChange={(event) => changeTarget(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-border bg-background px-3 text-sm"
                >
                  {ASSETS.map((asset) => (
                    <option key={asset}>{asset}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Source amount">
              <input
                aria-label="Source amount"
                inputMode="decimal"
                autoComplete="off"
                value={sourceAmount}
                onChange={(event) => changeAmount(event.target.value)}
                className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm tabular-nums"
                placeholder="100"
              />
            </Field>
            <button
              type="submit"
              disabled={checking || quote.busy || !quote.allowed}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              {quote.busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              {quote.busy ? "One quote request in progress" : "Preview one quote"}
            </button>
          </form>
        </section>

        {!checking && (!session || !runtimeReady) && (
          <Message
            tone="warning"
            text="Quote preview requires a matching, unexpired SANDBOX or TEST wallet session. No request was sent."
          />
        )}
        {quote.error && (
          <Message tone={quote.sessionInvalid ? "warning" : "error"} text={quote.error} />
        )}
        {quote.busy && quote.quote && (
          <Message text="A new quote request is pending; the last verified quote for these exact inputs remains visible." />
        )}
        {quote.quote && <QuotePreview quote={quote.quote} />}
      </main>
    </MobileShell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Message({
  text,
  tone = "neutral",
}: {
  text: string;
  tone?: "neutral" | "warning" | "error";
}) {
  const style =
    tone === "error"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : tone === "warning"
        ? "border-warning/40 bg-warning/10 text-warning"
        : "border-border/60 bg-surface text-muted-foreground";
  return (
    <div className={`mt-4 flex gap-2 rounded-2xl border p-4 text-xs ${style}`}>
      {tone !== "neutral" && <AlertTriangle className="h-4 w-4 shrink-0" />}
      <span>{text}</span>
    </div>
  );
}

function QuotePreview({ quote }: { quote: NonNullable<ReturnType<typeof useFxQuote>["quote"]> }) {
  return (
    <section className="mt-4 rounded-3xl border border-primary/30 bg-primary/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-primary">
            Verified quote preview
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold">
            {quote.sourceAmount} {quote.sourceAssetCode} → {quote.targetAmount}{" "}
            {quote.targetAssetCode}
          </h2>
        </div>
        <span className="rounded-full bg-primary/15 px-2 py-1 text-[10px] font-semibold text-primary">
          {quote.environment}
        </span>
      </div>
      <dl className="mt-5 space-y-3 text-xs">
        <QuoteRow label="Quote ID" value={quote.quoteId} />
        <QuoteRow label="Source asset" value={quote.sourceAssetCode} />
        <QuoteRow label="Target asset" value={quote.targetAssetCode} />
        <QuoteRow label="Source amount" value={quote.sourceAmount} />
        <QuoteRow label="Target amount" value={quote.targetAmount} />
        <QuoteRow label="Rate" value={quote.rate} />
        <QuoteRow label="Environment" value={quote.environment} />
        <QuoteRow
          label="Expires at"
          value={quote.expiresAt}
          icon={<Clock3 className="h-3.5 w-3.5" />}
        />
      </dl>
      <p className="mt-5 rounded-2xl bg-background/50 p-3 text-[11px] leading-5 text-muted-foreground">
        Preview only. There is no conversion confirmation or funds-movement action on this page.
      </p>
    </section>
  );
}

function QuoteRow({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd translate="no" className="max-w-[65%] break-all text-right font-medium tabular-nums">
        {value}
      </dd>
    </div>
  );
}
