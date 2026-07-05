import { createFileRoute, Link } from "@tanstack/react-router";
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
} from "lucide-react";

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
  return (
    <MobileShell>
      <StatusBar title="Profile" />

      <div className="px-6 pt-4">
        <h1 className="font-display text-2xl font-bold">Profile</h1>

        {/* User card */}
        <div className="mt-5 rounded-3xl bg-gradient-card p-6 shadow-card">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-primary font-display text-xl font-bold text-primary-foreground shadow-glow">
              DC
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-lg font-semibold">Daniel Chen</p>
              <p className="truncate text-xs text-muted-foreground">daniel.chen@fastlink.io</p>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                <BadgeCheck className="h-3 w-3" /> KYC Verified · Tier 2
              </div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 divide-x divide-border/60 text-center">
            <Stat label="Account ID" value="FL-8241" />
            <Stat label="Since" value="Mar 2024" />
            <Stat label="Region" value="UAE" />
          </div>
        </div>

        {/* KYC + Security */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-surface p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">KYC Level</p>
              <BadgeCheck className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 font-display text-lg font-semibold">Tier 2</p>
            <p className="text-[10px] text-primary">Verified · Advanced</p>
            <div className="mt-3 flex gap-1">
              <span className="h-1 flex-1 rounded-full bg-primary" />
              <span className="h-1 flex-1 rounded-full bg-primary" />
              <span className="h-1 flex-1 rounded-full bg-muted" />
            </div>
          </div>
          <div className="rounded-2xl bg-surface p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Security Score</p>
              <ShieldCheck className="h-4 w-4 text-accent" />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <p className="font-display text-lg font-semibold">86</p>
              <span className="text-[10px] text-muted-foreground">/ 100</span>
            </div>
            <p className="text-[10px] text-accent">Strong</p>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[86%] rounded-full bg-gradient-to-r from-primary to-accent" />
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-surface p-4">
          <p className="text-xs text-muted-foreground">
            Enable biometric login to reach a score of 100 and unlock Tier 3 KYC benefits.
          </p>
        </div>


        {/* Menu */}
        <div className="mt-5 space-y-3">
          <Section title="Account">
            <Row icon={UserRound} label="Personal Information" hint="Name, address, phone" />
            <Row icon={BadgeCheck} label="KYC & Verification" hint="Tier 2 · Verified" />
          </Section>

          <Section title="Security">
            <Row icon={Lock} label="Change Password" />
            <Row icon={ShieldCheck} label="Two-Factor Authentication" hint="Enabled" />
            <Row icon={Bell} label="Login Alerts" hint="On" />
          </Section>

          <Section title="Preferences">
            <Row icon={Globe} label="Language" hint="English" />
            <Row icon={Bell} label="Notifications" />
          </Section>

          <Section title="Agent Integrations">
            <Link
              to="/connect"
              className="flex w-full items-center gap-3 px-5 py-4 text-left active:bg-muted/40"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">Connect ChatGPT or Claude</p>
                <p className="truncate text-xs text-muted-foreground">
                  Use FastLink from your AI assistant
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          </Section>

          <Section title="Help">
            <Row icon={LifeBuoy} label="Support Center" hint="24/7 chat" />
            <Row icon={LogOut} label="Log Out" danger />
          </Section>
        </div>

        <p className="mt-6 text-center text-[10px] text-muted-foreground">
          FastLink v2.4.1 · Global USDT Wallet & U Card
        </p>
      </div>
    </MobileShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-xs font-semibold">{value}</p>
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
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
          danger ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${danger ? "text-destructive" : ""}`}>{label}</p>
        {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
