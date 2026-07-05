import { defineMcp } from "@lovable.dev/mcp-js";
import getBalances from "./tools/get-balances";
import convertQuote from "./tools/convert-quote";
import listCards from "./tools/list-cards";

export default defineMcp({
  name: "fastlink-mcp",
  title: "FastLink Global Wallet",
  version: "0.1.0",
  instructions:
    "Tools for the FastLink demo global wallet. Use `get_balances` to read digital, fiat, and card balances; `convert_quote` for zero-fee FX/crypto conversion quotes; `list_cards` to see virtual, physical, and travel cards.",
  tools: [getBalances, convertQuote, listCards],
});
