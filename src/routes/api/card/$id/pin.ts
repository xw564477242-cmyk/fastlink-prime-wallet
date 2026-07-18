import { createFileRoute } from "@tanstack/react-router";

import { cardService } from "@/integrations/thredd/thredd.card.service";
import { assertOwnsCard, requireCustomerId, toErrorResponse } from "@/integrations/thredd/current-customer.server";

/**
 * Return the raw PIN for a card. Owner-only, one field, no card metadata.
 * Kept isolated from the card detail endpoint so PIN/CVV/PAN never leak
 * from the general read path.
 */
export const Route = createFileRoute("/api/card/$id/pin")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          const customerId = await requireCustomerId(request);
          await assertOwnsCard(params.id, customerId);
          const result = await cardService.getPin(params.id);
          return Response.json(result);
        } catch (err) {
          return toErrorResponse(err);
        }
      },
    },
  },
});
