import { createFileRoute } from "@tanstack/react-router";

import { cardService } from "@/integrations/thredd/thredd.card.service";
import { getCurrentCustomerId } from "@/integrations/thredd/current-customer.server";

export const Route = createFileRoute("/api/card/list")({
  server: {
    handlers: {
      GET: async () => {
        const customerId = getCurrentCustomerId();
        const cards = await cardService.getCardList(customerId);
        return Response.json({ cards });
      },
    },
  },
});
