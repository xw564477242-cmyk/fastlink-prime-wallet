import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, RefreshCw, XCircle } from "lucide-react";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { useKycStatus } from "@/hooks/use-kyc-status";
import { useBackendSession } from "@/lib/backend-session";

export const Route = createFileRoute("/kyc")({
  head: () => ({
    meta: [
      { title: "FastLink — KYC Status" },
      { name: "description", content: "Read-only KYC review status from FastLink Backend." },
    ],
  }),
  component: KycPage,
});

const statusPresentation = {
  PENDING: { label: "Pending review", Icon: Clock3, className: "text-amber-400" },
  APPROVED: { label: "Approved", Icon: CheckCircle2, className: "text-emerald-400" },
  REJECTED: { label: "Rejected", Icon: XCircle, className: "text-destructive" },
} as const;

export function KycPage() {
  const { session } = useBackendSession();
  const kyc = useKycStatus(session);
  const presentation = kyc.snapshot ? statusPresentation[kyc.snapshot.status] : null;

  return (
    <MobileShell>
      <StatusBar title="KYC verification" />
      <div className="px-6 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">Verification status</h1>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Read-only status for the current verified Backend session.
            </p>
          </div>
          <button
            type="button"
            onClick={kyc.refresh}
            disabled={!kyc.canRefresh}
            aria-label="Refresh KYC status"
            className="flex shrink-0 items-center gap-2 rounded-full border border-border/60 bg-surface px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {kyc.loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {kyc.loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {!kyc.canRefresh && (
          <div className="mt-5 flex gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>KYC status is available only for verified SANDBOX or TEST sessions.</span>
          </div>
        )}

        {kyc.error && (
          <div className="mt-5 flex gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {kyc.error}
              {kyc.snapshot ? " · The last verified status for this session is retained." : ""}
            </span>
          </div>
        )}

        <section className="mt-5 rounded-3xl border border-border/60 bg-surface p-5">
          {kyc.snapshot && presentation ? (
            <>
              <div className={`flex items-center gap-3 ${presentation.className}`}>
                <presentation.Icon className="h-7 w-7" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Current status
                  </p>
                  <p className="font-display text-xl font-bold">{presentation.label}</p>
                </div>
              </div>
              <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
                <dt className="text-muted-foreground">Reviewed at</dt>
                <dd className="text-right font-semibold">
                  {kyc.snapshot.reviewedAt
                    ? new Date(kyc.snapshot.reviewedAt).toLocaleString()
                    : "Not reviewed"}
                </dd>
              </dl>
            </>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No verified KYC status loaded. Use Refresh to request the current status.
            </div>
          )}
        </section>

        <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
          Refresh performs one same-origin read. This page cannot upload documents or change a KYC
          decision.
        </p>
      </div>
    </MobileShell>
  );
}
