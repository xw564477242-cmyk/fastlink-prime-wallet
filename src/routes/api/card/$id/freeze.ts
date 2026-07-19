import { createFileRoute } from "@tanstack/react-router";

import { cardService } from "@/integrations/thredd/thredd.card.service";
import {
  assertOwnsCard,
  requireCustomerId,
  toErrorResponse,
} from "@/integrations/thredd/current-customer.server";

export const Route = createFileRoute("/api/card/$id/freeze")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const customerId = await requireCustomerId(request);
          await assertOwnsCard(params.id, customerId);
          const card = await cardService.freezeCard(params.id);
          return Response.json({ card });
        } catch (err) {
          return toErrorResponse(err);
        }
      },
    },
  },
});
