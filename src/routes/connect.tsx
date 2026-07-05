import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileShell, StatusBar } from "@/components/MobileShell";
import { useEffect, useState } from "react";
import { Copy, Check, Sparkles, ExternalLink, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/connect")({
  head: () => ({
    meta: [
      { title: "FastLink — Connect to an AI assistant" },
      {
        name: "description",
        content:
          "Connect ChatGPT or Claude to your FastLink Global Wallet with a single URL.",
      },
    ],
  }),
  component: ConnectPage,
});

function ConnectPage() {
  const [mcpUrl, setMcpUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMcpUrl(new URL("/mcp", window.location.origin).toString());
  }, []);

  async function copy() {
    if (!mcpUrl) return;
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <MobileShell>
      <StatusBar title="Connect" />

      <div className="px-6 pt-4">
        <Link
          to="/profile"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </Link>

        <div className="mt-3 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Agent Integrations
            </p>
            <h1 className="font-display text-2xl font-bold leading-tight">
              Use FastLink from your AI
            </h1>
          </div>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          Connect ChatGPT or Claude to FastLink so you can ask them to check
          balances, quote a conversion, or list your cards on your behalf.
        </p>

        {/* URL card */}
        <div className="mt-5 rounded-3xl bg-gradient-card p-5 shadow-card">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Your FastLink server URL
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-surface/80 p-3">
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
              {mcpUrl || "\u00a0"}
            </code>
            <button
              type="button"
              onClick={copy}
              disabled={!mcpUrl}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </>
              )}
            </button>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Paste this URL into your assistant's connector setup. It always
            points to this deployment.
          </p>
        </div>

        {/* ChatGPT */}
        <ClientCard
          index={1}
          name="ChatGPT"
          badge="Developer mode"
          steps={[
            <>
              Open{" "}
              <ExtLink href="https://chatgpt.com/#settings/Connectors/Advanced">
                ChatGPT → Settings → Connectors → Advanced
              </ExtLink>{" "}
              and turn on Developer mode (read the risk notice shown there).
            </>,
            <>In the chat composer's <b>+</b> menu, turn on Developer mode.</>,
            <>Tap <b>Add sources</b>, then <b>Connect more</b>.</>,
            <>
              Give the connector a name (e.g. <b>FastLink</b>) and paste the
              URL above.
            </>,
            <>Ask ChatGPT to use FastLink — for example, "check my balances".</>,
          ]}
        />

        {/* Claude */}
        <ClientCard
          index={2}
          name="Claude"
          badge="Custom connector"
          steps={[
            <>
              Open{" "}
              <ExtLink href="https://claude.ai/customize/connectors?modal=add-custom-connector">
                Claude → Custom connectors → Add
              </ExtLink>
              .
            </>,
            <>
              Name the connector (e.g. <b>FastLink</b>) and paste the URL above.
            </>,
            <>
              Enable the connector from the chat composer, then ask Claude to
              use FastLink.
            </>,
          ]}
        />

        <div className="mt-5 rounded-2xl border border-border/60 bg-surface/60 p-4">
          <p className="text-[11px] text-muted-foreground">
            Your assistant will discover what it can do automatically once
            connected. FastLink actions run on this account's demo data.
          </p>
        </div>

        <div className="h-8" />
      </div>
    </MobileShell>
  );
}

function ClientCard({
  index,
  name,
  badge,
  steps,
}: {
  index: number;
  name: string;
  badge: string;
  steps: React.ReactNode[];
}) {
  return (
    <div className="mt-5 rounded-3xl bg-surface p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 font-display text-sm font-bold text-primary">
            {index}
          </div>
          <p className="font-display text-lg font-semibold">{name}</p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {badge}
        </span>
      </div>
      <ol className="mt-4 space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
              {i + 1}
            </span>
            <span className="text-foreground/90 leading-relaxed">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2"
    >
      {children}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}
