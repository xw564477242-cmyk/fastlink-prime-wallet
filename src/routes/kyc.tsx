import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { BadgeCheck, IdCard, Camera, MapPin, Loader2, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/kyc")({
  head: () => ({
    meta: [
      { title: "FastLink — KYC Verification" },
      {
        name: "description",
        content: "Complete identity verification to unlock FastLink features.",
      },
    ],
  }),
  component: KycPage,
});

type Step = 0 | 1 | 2 | 3;
type Status = "not_started" | "pending" | "approved";

function KycPage() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [step, setStep] = useState<Step>(0);
  const [status, setStatus] = useState<Status>("not_started");
  const [docType, setDocType] = useState<"passport" | "id_card" | "driver_license">("passport");
  const [docNumber, setDocNumber] = useState("A12345678");
  const [address, setAddress] = useState("1 Marina Blvd, Singapore");
  const [selfie, setSelfie] = useState(false);

  const submit = async () => {
    setStatus("pending");
    await new Promise((r) => setTimeout(r, 1400));
    setStatus("approved");
  };

  return (
    <MobileShell>
      <StatusBar title={t("page.kyc")} />
      <div className="px-6 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {t("kyc.tag")}
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold">{t("kyc.title")}</h1>

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border/60 bg-surface/60 px-4 py-3">
          {status === "approved" ? (
            <CheckCircle2 className="h-4 w-4 text-primary" />
          ) : status === "pending" ? (
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
          ) : (
            <BadgeCheck className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-xs font-semibold">{t(`kyc.status.${status}`)}</span>
        </div>

        <div className="mt-4 flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        {status === "approved" ? (
          <div className="mt-8 rounded-2xl border border-primary/40 bg-primary/10 p-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <h2 className="mt-3 font-display text-lg font-bold">{t("kyc.verifiedTier2")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{t("kyc.verifiedDesc")}</p>
            <button
              onClick={() => navigate({ to: "/" })}
              className="mt-5 w-full rounded-2xl bg-gradient-primary py-3 font-display text-sm font-semibold text-primary-foreground shadow-glow"
            >
              {t("common.backHome")}
            </button>
          </div>
        ) : status === "pending" ? (
          <div className="mt-8 rounded-2xl border border-border/60 bg-surface/60 p-6 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-accent" />
            <h2 className="mt-3 font-display text-base font-semibold">{t("kyc.reviewing")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{t("kyc.reviewingDesc")}</p>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {step === 0 && (
              <StepCard title={t("kyc.chooseDoc")} icon={<IdCard className="h-4 w-4" />}>
                <div className="grid grid-cols-3 gap-2">
                  {(["passport", "id_card", "driver_license"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDocType(d)}
                      className={`rounded-2xl border p-3 text-xs font-semibold ${docType === d ? "border-primary bg-primary/10 text-primary" : "border-border/60 bg-surface/60"}`}
                    >
                      {t(`kyc.doc.${d}`)}
                    </button>
                  ))}
                </div>
              </StepCard>
            )}
            {step === 1 && (
              <StepCard title={t("kyc.docNumber")} icon={<IdCard className="h-4 w-4" />}>
                <input
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  className="w-full rounded-2xl border border-border/60 bg-surface/60 px-4 py-3 font-mono text-sm outline-none"
                />
              </StepCard>
            )}
            {step === 2 && (
              <StepCard title={t("kyc.selfie")} icon={<Camera className="h-4 w-4" />}>
                <button
                  onClick={() => setSelfie(true)}
                  className={`w-full rounded-2xl border py-6 text-sm font-semibold ${selfie ? "border-primary bg-primary/10 text-primary" : "border-dashed border-border/60 bg-surface/60"}`}
                >
                  {selfie ? t("kyc.selfieCaptured") : t("kyc.selfieTap")}
                </button>
              </StepCard>
            )}
            {step === 3 && (
              <StepCard title={t("kyc.address")} icon={<MapPin className="h-4 w-4" />}>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-2xl border border-border/60 bg-surface/60 px-4 py-3 text-sm outline-none"
                />
              </StepCard>
            )}

            <div className="flex gap-2">
              {step > 0 && (
                <button
                  onClick={() => setStep((s) => (s - 1) as Step)}
                  className="flex-1 rounded-2xl border border-border/60 bg-surface/60 py-3 text-sm font-semibold"
                >
                  {t("common.back")}
                </button>
              )}
              {step < 3 ? (
                <button
                  onClick={() => setStep((s) => (s + 1) as Step)}
                  className="flex-1 rounded-2xl bg-gradient-primary py-3 font-display text-sm font-semibold text-primary-foreground shadow-glow"
                >
                  {t("common.continue")}
                </button>
              ) : (
                <button
                  onClick={submit}
                  className="flex-1 rounded-2xl bg-gradient-primary py-3 font-display text-sm font-semibold text-primary-foreground shadow-glow"
                >
                  {t("kyc.submit")}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </MobileShell>
  );
}

function StepCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-surface/40 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}
