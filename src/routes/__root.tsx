import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Loader2, ShieldAlert } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { LanguageProvider } from "../lib/i18n";
import { BackendSessionProvider, useBackendSession } from "../lib/backend-session";
import { backendRuntime } from "../lib/backend-api";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "FastLink — Home" },
      { name: "description", content: "Global USDT wallet and premium U Card dashboard." },
      { name: "theme-color", content: "#0e1420" },
      { property: "og:title", content: "FastLink — Home" },
      { property: "og:description", content: "Global USDT wallet and premium U Card dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "FastLink — Home" },
      { name: "twitter:description", content: "Global USDT wallet and premium U Card dashboard." },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1cf7d8ad-b24d-41af-92b2-cb6da4a9881c/id-preview-7ce9dbab--cc264c85-ff17-48ff-9f3c-f2d8837f704a.lovable.app-1783233446256.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1cf7d8ad-b24d-41af-92b2-cb6da4a9881c/id-preview-7ce9dbab--cc264c85-ff17-48ff-9f3c-f2d8837f704a.lovable.app-1783233446256.png",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <BackendSessionProvider>
          <SessionBoundary />
        </BackendSessionProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

function SessionBoundary() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { checking, session, error } = useBackendSession();

  if (pathname === "/auth") return <Outlet />;

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto grid min-h-screen w-full max-w-md place-items-center bg-background px-6 text-foreground">
        <div className="w-full rounded-3xl border border-border/60 bg-surface p-6">
          <ShieldAlert className="h-8 w-8 text-accent" />
          <h1 className="mt-4 font-display text-xl font-bold">Backend session required</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            This wallet only displays data returned by the Railway Backend. Static balances,
            Supabase client sessions, and production fallback data are disabled.
          </p>
          {error && (
            <p className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </p>
          )}
          {backendRuntime.error && (
            <p className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {backendRuntime.error}
            </p>
          )}
          <Link
            to="/auth"
            className="mt-5 flex w-full items-center justify-center rounded-2xl bg-gradient-primary py-3 font-display text-sm font-semibold text-primary-foreground shadow-glow"
          >
            Connect Backend session
          </Link>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
