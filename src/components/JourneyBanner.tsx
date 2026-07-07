import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";

type Step = {
  key: string;
  title: string;
  to: "/auth" | "/kyc" | "/deposit" | "/convert" | "/cards" | "/card-pay" | "/history";
};

const STEPS: Step[] = [
  { key: "register", title: "Register", to: "/auth" },
  { key: "kyc", title: "Complete KYC", to: "/kyc" },
  { key: "deposit", title: "Deposit USDT", to: "/deposit" },
  { key: "convert", title: "Convert to USD", to: "/convert" },
  { key: "fund", title: "Fund Card", to: "/cards" },
  { key: "pay", title: "Pay with Card", to: "/card-pay" },
  { key: "history", title: "View History", to: "/history" },
];

export function JourneyBanner() {
  return (
    <div className="mx-6 mt-6 rounded-3xl border border-border/60 bg-surface/60 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
            MVP Demo Journey
          </p>
          <h3 className="mt-1 font-display text-base font-bold">Try the full flow</h3>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
          7 steps
        </span>
      </div>
      <div className="mt-4 space-y-1.5">
        {STEPS.map((s, i) => (
          <Link
            key={s.key}
            to={s.to}
            className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-background/40 active:bg-background/60"
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 font-mono text-[10px] font-bold text-primary">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.title}</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}

// exported for potential future use
export { CheckCircle2, Circle };
