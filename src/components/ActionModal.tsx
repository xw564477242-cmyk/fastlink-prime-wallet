import { CheckCircle2, Loader2, X } from "lucide-react";
import type { ReactNode } from "react";
import { useLang } from "@/lib/i18n";

export type ActionState = "idle" | "review" | "pending" | "success";

export function ActionModal({
  open,
  onClose,
  state,
  title,
  description,
  rows,
  confirmLabel,
  onConfirm,
  successLabel,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  state: ActionState;
  title: string;
  description?: string;
  rows?: Array<{ label: string; value: ReactNode }>;
  confirmLabel?: string;
  onConfirm?: () => void;
  successLabel?: string;
  onSuccess?: () => void;
}) {
  const { t } = useLang();
  if (!open) return null;
  return (
    <div
      className="fixed inset-x-0 bottom-0 top-0 z-50 mx-auto flex max-w-md items-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-3xl border-t border-border/60 bg-background p-6 pb-8"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />

        {state === "success" ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <h3 className="mt-3 font-display text-lg font-bold">{title}</h3>
            {description && (
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            )}
            <button
              onClick={onSuccess ?? onClose}
              className="mt-6 w-full rounded-2xl bg-gradient-primary py-3 font-display text-sm font-semibold text-primary-foreground shadow-glow"
            >
              {successLabel ?? t("common.done")}
            </button>
          </div>
        ) : state === "pending" ? (
          <div className="py-8 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-accent" />
            <h3 className="mt-3 font-display text-base font-semibold">{t("common.processing")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{t("common.pleaseWait")}</p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-lg font-bold">{title}</h3>
                {description && (
                  <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                )}
              </div>
              <button onClick={onClose} className="text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            {rows && rows.length > 0 && (
              <div className="mt-4 space-y-2 rounded-2xl border border-border/60 bg-surface/60 p-4">
                {rows.map((r) => (
                  <div key={r.label} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="font-semibold tabular-nums">{r.value}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-5 flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-2xl border border-border/60 bg-surface/60 py-3 text-sm font-semibold"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 rounded-2xl bg-gradient-primary py-3 font-display text-sm font-semibold text-primary-foreground shadow-glow"
              >
                {confirmLabel ?? t("common.confirm")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
