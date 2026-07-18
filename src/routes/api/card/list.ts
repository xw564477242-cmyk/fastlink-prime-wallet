import { createFileRoute } from "@tanstack/react-router";

import { cardService } from "@/integrations/thredd/thredd.card.service";
import { requireCustomerId, toErrorResponse } from "@/integrations/thredd/current-customer.server";

export const Route = createFileRoute("/api/card/list")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const customerId = await requireCustomerId(request);
          const cards = await cardService.getCardList(customerId);
          return Response.json({ cards });
        } catch (err) {
          return toErrorResponse(err);
        }
      },
    },
  },
});
