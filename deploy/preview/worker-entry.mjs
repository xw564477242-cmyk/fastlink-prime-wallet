// Copied verbatim to .preview-build/publish/worker.js after the Cloudflare-target SSR build.
import server from "./server/index.mjs";
import { previewAccess, previewProxy } from "./preview-gateway.js";
export default {
  async fetch(request, env, ctx) {
    try {
      const binding = await previewAccess(request, env);
      const path = new URL(request.url).pathname;
      if (path === "/api" || path.startsWith("/api/")) return await previewProxy(request, binding);
      return await server.fetch(request, env, ctx);
    } catch {
      return new Response("Preview unavailable", {
        status: 503,
        headers: { "cache-control": "no-store" },
      });
    }
  },
};
