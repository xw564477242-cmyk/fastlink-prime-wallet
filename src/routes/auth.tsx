import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { Mail, Lock, User, Loader2, CheckCircle2 } from "lucide-react";
import { useState } from "react";

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
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("daniel@fastlink.app");
  const [password, setPassword] = useState("demo1234");
  const [name, setName] = useState("Daniel Chen");
  const [status, setStatus] = useState<"idle" | "pending" | "success">("idle");

  const submit = async () => {
    setStatus("pending");
    await new Promise((r) => setTimeout(r, 900));
    try {
      localStorage.setItem(
        "fastlink.session",
        JSON.stringify({ email, name: mode === "register" ? name : "Daniel Chen", at: Date.now() }),
      );
    } catch {}
    setStatus("success");
    setTimeout(() => navigate({ to: "/" }), 700);
  };

  return (
    <MobileShell>
      <StatusBar title={mode === "login" ? "Sign In" : "Register"} />
      <div className="px-6 pt-6">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary font-display text-lg font-bold text-primary-foreground shadow-glow">
          FL
        </div>
        <h1 className="mt-4 text-center font-display text-2xl font-bold">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          {mode === "login" ? "Sign in to continue to FastLink." : "Join the FastLink global wallet."}
        </p>

        <div className="mt-6 flex gap-2 rounded-2xl bg-surface p-1 text-xs font-semibold">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-xl py-2 transition-colors ${mode === m ? "bg-background text-primary shadow" : "text-muted-foreground"}`}
            >
              {m === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          {mode === "register" && (
            <Field icon={<User className="h-4 w-4" />} value={name} onChange={setName} placeholder="Full name" />
          )}
          <Field icon={<Mail className="h-4 w-4" />} value={email} onChange={setEmail} placeholder="Email" />
          <Field
            icon={<Lock className="h-4 w-4" />}
            value={password}
            onChange={setPassword}
            placeholder="Password"
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
          {status === "idle" && (mode === "login" ? "Sign In" : "Create Account")}
          {status === "pending" && "Please wait…"}
          {status === "success" && "Success"}
        </button>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Demo mode — any email and password is accepted.
        </p>
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
