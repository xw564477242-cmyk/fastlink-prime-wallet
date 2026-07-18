import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getBalances from "./tools/get-balances";
import convertQuote from "./tools/convert-quote";
import listCards from "./tools/list-cards";

// The OAuth issuer must be the direct Supabase host (not the .lovable.cloud
// proxy) so mcp-js can fetch the RFC 8414 discovery document and validate
// tokens. `VITE_SUPABASE_PROJECT_ID` is inlined at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "fastlink-mcp",
  title: "FastLink Global Wallet",
  version: "0.1.0",
  instructions:
    "Tools for the FastLink demo global wallet. Use `get_balances` to read digital, fiat, and card balances; `convert_quote` for zero-fee FX/crypto conversion quotes; `list_cards` to see virtual, physical, and travel cards.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getBalances, convertQuote, listCards],
});
