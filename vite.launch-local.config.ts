// Local build only: never initialise a Cloudflare/Nitro deployment target.
// This does not replace or certify the production deployment configuration.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
export default defineConfig({ nitro: false, tanstackStart: { server: { entry: "server" } } });
