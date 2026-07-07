import { createFileRoute } from "@tanstack/react-router";

import { cardService } from "@/integrations/thredd/thredd.card.service";

export const Route = createFileRoute("/api/card/$id/transactions")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const txns = await cardService.getCardTransactions(params.id);
        return Response.json({ transactions: txns });
      },
    },
  },
});
