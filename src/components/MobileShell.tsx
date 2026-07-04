import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Wallet, CreditCard, Activity, User } from "lucide-react";
import type { ReactNode } from "react";

const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/card", label: "Card", icon: CreditCard },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function MobileShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background text-foreground">
      <div className="flex-1 overflow-y-auto pb-24">{children}</div>
      <nav className="fixed bottom-0 left-1/2 z-50 flex w-full max-w-md -translate-x-1/2 border-t border-border/60 bg-surface/95 backdrop-blur-xl">
        <div className="grid w-full grid-cols-5">
          {tabs.map((t) => {
            const active = pathname === t.to;
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className="flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors"
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                </div>
                <span className={active ? "text-primary" : "text-muted-foreground"}>
                  {t.label}
                </span>
              </Link>
            );
          })}
        </div>
        <div className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-background to-transparent" />
      </nav>
    </div>
  );
}

export function StatusBar({ title, right }: { title?: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-6 pt-6 pb-2">
      <div className="text-xs font-medium tabular-nums text-muted-foreground">9:41</div>
      {title && <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</div>}
      <div className="flex items-center gap-1 text-muted-foreground">
        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
        <div className="h-1.5 w-4 rounded-sm border border-current" />
      </div>
      {right}
    </div>
  );
}
