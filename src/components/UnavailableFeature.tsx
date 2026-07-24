import { Link } from "@tanstack/react-router";
import { AlertTriangle, ChevronLeft } from "lucide-react";
import { MobileShell, StatusBar } from "./MobileShell";
import { backendRuntime } from "@/lib/backend-api";

export function UnavailableFeature({ title, detail }: { title: string; detail?: string }) {
  return (
    <MobileShell>
      <StatusBar title={title} />
      <div className="px-6 pt-4">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Home
        </Link>
        <div className="mt-8 rounded-3xl border border-accent/30 bg-accent/10 p-6">
          <AlertTriangle className="h-8 w-8 text-accent" />
          <h1 className="mt-4 font-display text-xl font-bold">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {detail ??
              "Unavailable · Railway Backend does not expose an authenticated end-user contract for this feature."}
          </p>
          <div className="mt-5 rounded-2xl bg-background/40 p-3 text-[10px] uppercase tracking-widest text-muted-foreground">
            {backendRuntime.environment ?? "INVALID ENVIRONMENT"} · Build {backendRuntime.buildSha}
          </div>
        </div>
      </div>
    </MobileShell>
  );
}
