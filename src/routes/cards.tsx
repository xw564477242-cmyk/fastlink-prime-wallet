import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import {
  AlertTriangle,
  Copy,
  CreditCard,
  Loader2,
  Plus,
  RefreshCw,
  Snowflake,
  Sun,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { backendApi, type WalletCard } from "@/lib/backend-api";
import { useBackendSession } from "@/lib/backend-session";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/cards")({
  validateSearch: (search: Record<string, unknown>): { cardId?: string } =>
    typeof search.cardId === "string" ? { cardId: search.cardId } : {},
  head: () => ({
    meta: [
      { title: "FastLink — Card Center" },
      { name: "description", content: "Cards returned by FastLink Railway Backend." },
    ],
  }),
  component: CardsPage,
});

function CardsPage() {
  const { t } = useLang();
  const { token, session } = useBackendSession();
  const navigate = useNavigate({ from: "/cards" });
  const { cardId } = Route.useSearch();
  const [cards, setCards] = useState<WalletCard[]>([]);
  const [activeId, setActiveId] = useState<string | null>(cardId ?? null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = useMemo(
    () => cards.find((card) => card.cardId === activeId) ?? cards[0],
    [cards, activeId],
  );

  const loadCards = async () => {
    setLoading(true);
    setError(null);
    setCards([]);
    try {
      const rows = await backendApi.listCards(token);
      setCards(rows);
      setActiveId(
        rows.some((card) => card.cardId === activeId) ? activeId : (rows[0]?.cardId ?? null),
      );
    } catch (reason) {
      setCards([]);
      setError(reason instanceof Error ? reason.message : "Railway Backend is unavailable");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCards();
    // The active URL selection is applied during the initial Backend load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const refreshCurrent = async () => {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      const card = await backendApi.getCard(token, current.cardId);
      setCards((rows) => rows.map((row) => (row.cardId === card.cardId ? card : row)));
    } catch (reason) {
      setCards([]);
      setActiveId(null);
      setError(reason instanceof Error ? reason.message : "Railway Backend is unavailable");
    } finally {
      setBusy(false);
    }
  };

  const toggleFrozen = async () => {
    if (!current) return;
    const frozen = current.status === "frozen";
    const allowed = frozen ? current.capabilities.unfreeze : current.capabilities.freeze;
    if (!allowed) {
      setError("This card operation is unavailable in the current Backend/provider state.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const card = await backendApi.setFrozen(token, current.cardId, !frozen);
      setCards((rows) => rows.map((row) => (row.cardId === card.cardId ? card : row)));
    } catch (reason) {
      setCards([]);
      setActiveId(null);
      setError(reason instanceof Error ? reason.message : "Railway Backend is unavailable");
    } finally {
      setBusy(false);
    }
  };

  const issueVirtual = async () => {
    setBusy(true);
    setError(null);
    try {
      const card = await backendApi.createVirtualCard(token, {
        currency: "USD",
        alias: t("cards.defaultVirtualAlias"),
      });
      setCards((rows) => [card, ...rows]);
      setActiveId(card.cardId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Railway Backend is unavailable");
    } finally {
      setBusy(false);
    }
  };

  return (
    <MobileShell>
      <StatusBar title={t("page.cards")} />
      <div className="px-6 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Railway Backend
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold">{t("cards.myCards")}</h1>
          </div>
          <button
            onClick={() => void issueVirtual()}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" /> {t("cards.issueNew")}
          </button>
        </div>

        {error && (
          <div className="mt-4 flex gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error} · No stale card data displayed.</span>
          </div>
        )}

        {loading && (
          <div className="grid h-[50vh] place-items-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {!loading && !error && cards.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-border/60 p-8 text-center">
            <CreditCard className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No cards returned by Railway Backend.
            </p>
          </div>
        )}

        {!loading && current && (
          <>
            <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
              {cards.map((card) => (
                <button
                  key={card.cardId}
                  onClick={() => {
                    setActiveId(card.cardId);
                    void navigate({ search: { cardId: card.cardId }, replace: true });
                  }}
                  className={`shrink-0 rounded-2xl border px-4 py-3 text-left ${
                    card.cardId === current.cardId
                      ? "border-primary bg-primary/10"
                      : "border-border/60 bg-surface/60"
                  }`}
                >
                  <p className="text-xs font-semibold">{card.alias ?? card.type}</p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    •••• {card.last4 || "Unavailable"}
                  </p>
                </button>
              ))}
            </div>

            <div className="relative mt-6 aspect-[1.586] overflow-hidden rounded-3xl bg-gradient-visa p-6 shadow-card">
              {current.status === "frozen" && (
                <div className="absolute inset-0 z-10 grid place-items-center bg-background/60 backdrop-blur-md">
                  <div className="text-center">
                    <Snowflake className="mx-auto h-8 w-8 text-primary" />
                    <p className="mt-2 text-sm font-semibold">{t("cards.frozen")}</p>
                  </div>
                </div>
              )}
              <div className="relative text-white">
                <p className="text-[10px] uppercase tracking-widest text-white/60">
                  FastLink · {current.type}
                </p>
                <p className="mt-1 text-xs font-semibold">{current.alias ?? "FastLink Card"}</p>
                <p className="mt-8 font-mono text-xl font-semibold tracking-[0.35em]">
                  •••• •••• •••• {current.last4 || "••••"}
                </p>
                <div className="mt-6 flex items-end justify-between">
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-white/60">
                      Backend user
                    </p>
                    <p className="max-w-40 truncate text-xs font-semibold">
                      {session?.actorId ?? "Unavailable"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-white/60">
                      {t("cards.expiry")}
                    </p>
                    <p className="text-xs font-semibold">{current.expiry}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric
                label={t("cards.cardBalance")}
                value={`${current.balance.toFixed(2)} ${current.currency}`}
              />
              <Metric label="Status" value={current.status.toUpperCase()} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <CardAction
                onClick={() => void toggleFrozen()}
                disabled={busy}
                label={current.status === "frozen" ? t("cards.unfreeze") : t("cards.freeze")}
                icon={
                  current.status === "frozen" ? (
                    <Sun className="h-5 w-5" />
                  ) : (
                    <Snowflake className="h-5 w-5" />
                  )
                }
              />
              <CardAction
                onClick={() => void refreshCurrent()}
                disabled={busy}
                label={t("cards.refresh")}
                icon={<RefreshCw className="h-5 w-5" />}
              />
            </div>

            <div className="mt-4 rounded-2xl border border-border/60 bg-surface/60 p-5">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {t("cards.details")}
              </p>
              <div className="mt-3 divide-y divide-border">
                <Detail
                  label={t("cards.number")}
                  value={`•••• ${current.last4 || "Unavailable"}`}
                />
                <Detail label={t("cards.expiry")} value={current.expiry} />
                <Detail label={t("cards.pin")} value="Unavailable" />
                <Detail label={t("cards.cvv")} value="Unavailable" />
              </div>
              <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">
                PIN, CVV, physical-card application, and card funding are disabled because the
                Railway Backend end-user API does not expose those contracts.
              </p>
            </div>
          </>
        )}
      </div>
    </MobileShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-surface/60 p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-base font-bold tabular-nums">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm">{value}</span>
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    </div>
  );
}

function CardAction({
  onClick,
  label,
  icon,
  disabled,
}: {
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-surface/60 py-3 text-xs font-semibold disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  );
}
