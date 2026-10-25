// Offline packaging only. No dotenv, install, serve, deploy or backend access.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
export default defineConfig({
  tanstackStart: { server: { entry: "server" } },
  vite: {
    envDir: false,
    cacheDir: ".cache-b13",
    define: { "import.meta.env.FASTLINK_PREVIEW_BUILD": "true" },
    build: { emptyOutDir: false },
  },
});
