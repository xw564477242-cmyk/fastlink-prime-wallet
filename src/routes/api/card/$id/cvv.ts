import { createFileRoute } from "@tanstack/react-router";

import { cardService } from "@/integrations/thredd/thredd.card.service";
import { assertOwnsCard, requireCustomerId, toErrorResponse } from "@/integrations/thredd/current-customer.server";

export const Route = createFileRoute("/api/card/$id/cvv")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          const customerId = await requireCustomerId(request);
          await assertOwnsCard(params.id, customerId);
          const result = await cardService.getCvv(params.id);
          return Response.json(result);
        } catch (err) {
          return toErrorResponse(err);
        }
      },
    },
  },
});
