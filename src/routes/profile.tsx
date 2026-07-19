import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import {
  ChevronRight,
  UserRound,
  ShieldCheck,
  BadgeCheck,
  Lock,
  LifeBuoy,
  LogOut,
  Globe,
  Bell,
  Sparkles,
  Check,
  Receipt,
} from "lucide-react";
import { useState } from "react";
import { useLang, LANG_OPTIONS, type Lang } from "@/lib/i18n";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "FastLink — Profile" },
      { name: "description", content: "Manage your account, KYC, security and support." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { lang, setLang, t } = useLang();
  const navigate = useNavigate();
  const [langOpen, setLangOpen] = useState(false);
  const current = LANG_OPTIONS.find((o) => o.code === lang) ?? LANG_OPTIONS[0];

  const logout = () => {
    try {
      localStorage.removeItem("fastlink.session");
    } catch {
      // Continue to the sign-in screen even when storage is unavailable.
    }
    navigate({ to: "/auth" });
  };

  return (
    <MobileShell>
      <StatusBar title={t("profile.title")} />

      <div className="px-6 pt-4">
        <h1 className="font-display text-2xl font-bold">{t("profile.title")}</h1>

        <div className="mt-5 rounded-3xl bg-gradient-card p-6 shadow-card">
          <div className="flex items-center gap-4">
            <div
              translate="no"
              className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-primary font-display text-xl font-bold text-primary-foreground shadow-glow"
            >
              DC
            </div>
            <div className="min-w-0 flex-1">
              <p translate="no" className="truncate font-display text-lg font-semibold">
                Daniel Chen
              </p>
              <p translate="no" className="truncate text-xs text-muted-foreground">
                daniel.chen@fastlink.io
              </p>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                <BadgeCheck className="h-3 w-3" /> {t("profile.kycVerified")}
              </div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 divide-x divide-border/60 text-center">
            <Stat label={t("profile.accountId")} value="FL-8241" />
            <Stat label={t("profile.since")} value="Mar 2024" />
            <Stat label={t("profile.region")} value="UAE" />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-surface p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {t("profile.kycLevel")}
              </p>
              <BadgeCheck className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 font-display text-lg font-semibold">{t("profile.kycTier")}</p>
            <p className="text-[10px] text-primary">{t("profile.kycTag")}</p>
            <div className="mt-3 flex gap-1">
              <span className="h-1 flex-1 rounded-full bg-primary" />
              <span className="h-1 flex-1 rounded-full bg-primary" />
              <span className="h-1 flex-1 rounded-full bg-muted" />
            </div>
          </div>
          <div className="rounded-2xl bg-surface p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {t("profile.secScore")}
              </p>
              <ShieldCheck className="h-4 w-4 text-accent" />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <p translate="no" className="font-display text-lg font-semibold">
                86
              </p>
              <span translate="no" className="text-[10px] text-muted-foreground">
                / 100
              </span>
            </div>
            <p className="text-[10px] text-accent">{t("profile.secStrong")}</p>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[86%] rounded-full bg-gradient-to-r from-primary to-accent" />
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-surface p-4">
          <p className="text-xs text-muted-foreground">{t("profile.biometricTip")}</p>
        </div>

        <div className="mt-5 space-y-3">
          <Section title={t("profile.account")}>
            <Row
              icon={UserRound}
              label={t("profile.personalInfo")}
              hint={t("profile.personalHint")}
            />
            <RowLink
              to="/kyc"
              icon={BadgeCheck}
              label={t("profile.kycVerification")}
              hint={t("profile.kycHint")}
            />
            <RowLink
              to="/history"
              icon={Receipt}
              label={t("profile.txHistory")}
              hint={t("profile.txHint")}
            />
          </Section>

          <Section title={t("profile.security")}>
            <Row icon={Lock} label={t("profile.changePassword")} />
            <Row icon={ShieldCheck} label={t("profile.twoFa")} hint={t("profile.twoFaHint")} />
            <Row icon={Bell} label={t("profile.loginAlerts")} hint={t("profile.loginAlertsHint")} />
          </Section>

          <Section title={t("profile.preferences")}>
            <button
              onClick={() => setLangOpen((v) => !v)}
              className="flex w-full items-center gap-3 px-5 py-4 text-left active:bg-muted/40"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <Globe className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t("profile.language")}</p>
                <p translate="no" className="truncate text-xs text-muted-foreground">
                  {current.native}
                </p>
              </div>
              <ChevronRight
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${langOpen ? "rotate-90" : ""}`}
              />
            </button>
            {langOpen && (
              <div className="bg-background/40 px-2 py-2">
                {LANG_OPTIONS.map((opt) => {
                  const on = opt.code === lang;
                  return (
                    <button
                      key={opt.code}
                      onClick={() => {
                        setLang(opt.code as Lang);
                        setLangOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${on ? "bg-primary/10 text-primary" : "text-foreground active:bg-muted/40"}`}
                    >
                      <span translate="no" className="font-medium">
                        {opt.native}
                      </span>
                      {on && <Check className="h-4 w-4" />}
                    </button>
                  );
                })}
              </div>
            )}
            <Row icon={Bell} label={t("profile.notifications")} />
          </Section>

          <Section title={t("profile.agent")}>
            <Link
              to="/connect"
              className="flex w-full items-center gap-3 px-5 py-4 text-left active:bg-muted/40"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t("profile.connectAi")}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {t("profile.connectAiHint")}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          </Section>

          <Section title={t("profile.help")}>
            <Row icon={LifeBuoy} label={t("profile.support")} hint={t("profile.supportHint")} />
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 px-5 py-4 text-left active:bg-muted/40"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-destructive/15 text-destructive">
                <LogOut className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-destructive">
                  {t("profile.logout")}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </Section>
        </div>

        <p translate="no" className="mt-6 text-center text-[10px] text-muted-foreground">
          {t("profile.version")}
        </p>
      </div>
    </MobileShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p translate="no" className="mt-1 text-xs font-semibold">
        {value}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      <div className="divide-y divide-border/60 overflow-hidden rounded-2xl bg-surface">
        {children}
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  hint,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <button className="flex w-full items-center gap-3 px-5 py-4 text-left active:bg-muted/40">
      <div
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${danger ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${danger ? "text-destructive" : ""}`}>
          {label}
        </p>
        {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function RowLink({
  to,
  icon: Icon,
  label,
  hint,
}: {
  to: "/kyc" | "/history";
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
}) {
  return (
    <Link to={to} className="flex w-full items-center gap-3 px-5 py-4 text-left active:bg-muted/40">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
