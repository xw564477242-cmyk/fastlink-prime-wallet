import { createFileRoute } from "@tanstack/react-router";

import { cardService } from "@/integrations/thredd/thredd.card.service";
import { requireCustomerId, toErrorResponse } from "@/integrations/thredd/current-customer.server";

export const Route = createFileRoute("/api/cards/virtual")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const customerId = await requireCustomerId(request);
          const body = (await request.json().catch(() => ({}))) as {
            alias?: string;
            currency?: string;
          };
          const card = await cardService.createVirtualCard({
            customerId,
            alias: body.alias,
            currency: body.currency,
          });
          return Response.json({ card });
        } catch (err) {
          return toErrorResponse(err);
        }
      },
    },
  },
});
