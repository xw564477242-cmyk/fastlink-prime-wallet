import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "get_balances",
  title: "Get balances",
  description: "Returns the demo FastLink account's digital asset, fiat wallet, and card balances.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const data = {
      digital: [
        { symbol: "USDT", amount: 12480.55 },
        { symbol: "USDC", amount: 3210.0 },
      ],
      fiat: [
        { currency: "USD", amount: 8420.12 },
        { currency: "SGD", amount: 1500.0 },
        { currency: "MYR", amount: 2200.5 },
        { currency: "EUR", amount: 640.9 },
      ],
      cards: [
        { name: "Virtual Card", balance: 520.0 },
        { name: "Physical Card", balance: 1280.4 },
        { name: "Travel Card", balance: 300.0 },
      ],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: data,
    };
  },
});
