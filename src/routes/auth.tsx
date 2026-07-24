import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { KeyRound, Loader2, CheckCircle2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useLang } from "@/lib/i18n";
import { useBackendSession } from "@/lib/backend-session";
import { backendRuntime } from "@/lib/backend-api";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "FastLink — Sign in" },
      { name: "description", content: "Sign in or register for FastLink." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { t } = useLang();
  const { connect, session } = useBackendSession();
  const [bearerSession, setBearerSession] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "success">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submit = async () => {
    setErrorMsg(null);
    if (!bearerSession.trim()) {
      setErrorMsg("Backend bearer session is required");
      return;
    }
    setStatus("pending");
    try {
      await connect(bearerSession);
      setStatus("success");
      setTimeout(() => navigate({ to: "/" }), 600);
    } catch (e) {
      setStatus("idle");
      setErrorMsg(e instanceof Error ? e.message : t("auth.err.failed"));
    }
  };

  return (
    <MobileShell>
      <StatusBar title={t("page.auth.signIn")} />
      <div className="px-6 pt-6">
        <div
          translate="no"
          className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary font-display text-lg font-bold text-primary-foreground shadow-glow"
        >
          FL
        </div>
        <h1 className="mt-4 text-center font-display text-2xl font-bold">
          Connect Railway Backend
        </h1>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          The session is verified by <code>GET /api/v1/session</code> before wallet data is shown.
        </p>

        <div className="mt-6 rounded-2xl border border-border/60 bg-surface/60 p-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="font-semibold">{backendRuntime.environment ?? "Invalid runtime"}</span>
          </div>
          <p className="mt-2">
            API: {backendRuntime.apiUrl || "Not configured"} · Build {backendRuntime.buildSha}
          </p>
        </div>

        <div className="mt-5">
          <Field
            icon={<KeyRound className="h-4 w-4" />}
            value={bearerSession}
            onChange={setBearerSession}
            placeholder="Backend bearer session"
            type="password"
          />
        </div>

        <button
          disabled={status === "pending" || status === "success"}
          onClick={submit}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3 font-display text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
        >
          {status === "pending" && <Loader2 className="h-4 w-4 animate-spin" />}
          {status === "success" && <CheckCircle2 className="h-4 w-4" />}
          {status === "idle" && "Verify and connect"}
          {status === "pending" && t("common.processing")}
          {status === "success" && t("common.success")}
        </button>

        {errorMsg && (
          <p className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-center text-[11px] text-destructive">
            {errorMsg}
          </p>
        )}
        {session && (
          <p className="mt-4 text-center text-[11px] text-primary">
            Session verified for tenant {session.tenantId}
          </p>
        )}
      </div>
    </MobileShell>
  );
}

function Field({
  icon,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/60 px-4 py-3">
      <span className="text-muted-foreground">{icon}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
      />
    </div>
  );
}
