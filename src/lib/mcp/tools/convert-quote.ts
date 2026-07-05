import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const USD_RATES: Record<string, number> = {
  USDT: 1, USDC: 1, USD: 1, SGD: 0.74, MYR: 0.21, EUR: 1.08, HKD: 0.128,
};

export default defineTool({
  name: "convert_quote",
  title: "Get conversion quote",
  description: "Quote a zero-fee FX/crypto conversion between two supported currencies.",
  inputSchema: {
    from: z.string().min(2).max(6).describe("Source currency, e.g. USDT, USD, SGD."),
    to: z.string().min(2).max(6).describe("Target currency, e.g. USDC, EUR, MYR."),
    amount: z.number().positive().describe("Amount in the source currency."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ from, to, amount }) => {
    const f = from.toUpperCase();
    const t = to.toUpperCase();
    const fromRate = USD_RATES[f];
    const toRate = USD_RATES[t];
    if (!fromRate || !toRate) {
      return {
        content: [{ type: "text", text: `Unsupported currency. Supported: ${Object.keys(USD_RATES).join(", ")}` }],
        isError: true,
      };
    }
    const rate = fromRate / toRate;
    const result = amount * rate;
    const out = { from: f, to: t, amount, rate, result, fee: 0 };
    return {
      content: [{ type: "text", text: `${amount} ${f} ≈ ${result.toFixed(4)} ${t} (rate ${rate.toFixed(6)}, zero fee)` }],
      structuredContent: out,
    };
  },
});
