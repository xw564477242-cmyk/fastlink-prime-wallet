// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import type { Plugin } from "vite";
import { appendFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

function localErrorCollectorFallbackPlugin(): Plugin {
  return {
    name: "fastlink:error-collector-fallback",
    enforce: "pre",
    configureServer(server) {
      const outputFile = resolve(server.config.root, ".lovable/runtime-errors.log");

      server.middlewares.use("/__lovable/error-collector", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "method_not_allowed" }));
          return;
        }

        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }

          const body = Buffer.concat(chunks).toString("utf8");
          await mkdir(resolve(server.config.root, ".lovable"), { recursive: true });
          await appendFile(outputFile, `${body}\n`, "utf8");
        } catch (error) {
          server.config.logger.warn(
            `[fastlink:error-collector-fallback] ignored collector write failure: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }

        res.statusCode = 204;
        res.end();
      });
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [localErrorCollectorFallbackPlugin(), mcpPlugin()],
  },
});
