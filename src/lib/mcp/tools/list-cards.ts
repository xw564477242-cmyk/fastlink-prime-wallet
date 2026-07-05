import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "list_cards",
  title: "List cards",
  description: "List the FastLink cards on the demo account with status, alias, and balance.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const cards = [
      { id: "virtual", alias: "Daily Spend", type: "Virtual", status: "active", balance: 520.0, currency: "USD" },
      { id: "physical", alias: "Platinum", type: "Physical", status: "active", balance: 1280.4, currency: "USD" },
      { id: "travel", alias: "Trip Wallet", type: "Travel", status: "frozen", balance: 300.0, currency: "USD" },
    ];
    return {
      content: [{ type: "text", text: JSON.stringify(cards, null, 2) }],
      structuredContent: { cards },
    };
  },
});
