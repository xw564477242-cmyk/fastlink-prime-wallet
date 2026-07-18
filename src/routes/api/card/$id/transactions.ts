import { createFileRoute } from "@tanstack/react-router";

import { cardService } from "@/integrations/thredd/thredd.card.service";
import { assertOwnsCard, requireCustomerId, toErrorResponse } from "@/integrations/thredd/current-customer.server";

export const Route = createFileRoute("/api/card/$id/transactions")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          const customerId = await requireCustomerId(request);
          await assertOwnsCard(params.id, customerId);
          const txns = await cardService.getCardTransactions(params.id);
          return Response.json({ transactions: txns });
        } catch (err) {
          return toErrorResponse(err);
        }
      },
    },
  },
});
