import { createFileRoute } from "@tanstack/react-router";

import { cardService } from "@/integrations/thredd/thredd.card.service";
import { getCurrentCustomerId } from "@/integrations/thredd/current-customer.server";

export const Route = createFileRoute("/api/cards/virtual")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          alias?: string;
          currency?: string;
        };
        const customerId = getCurrentCustomerId();
        const card = await cardService.createVirtualCard({
          customerId,
          alias: body.alias,
          currency: body.currency,
        });
        return Response.json({ card });
      },
    },
  },
});
