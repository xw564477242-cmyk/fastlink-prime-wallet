import { createFileRoute } from "@tanstack/react-router";

import { cardService } from "@/integrations/thredd/thredd.card.service";
import {
  assertOwnsCard,
  requireCustomerId,
  toErrorResponse,
} from "@/integrations/thredd/current-customer.server";

export const Route = createFileRoute("/api/card/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const customerId = await requireCustomerId(request);
          await assertOwnsCard(params.id, customerId);
          const detail = await cardService.getCardDetail(params.id);
          // Strip sensitive fields — PAN/CVV/PIN require dedicated endpoints.
          const { pan: _pan, cvv: _cvv, pin: _pin, ...safe } = detail as unknown as Record<string, unknown>;
          return Response.json({ card: safe });
        } catch (err) {
          return toErrorResponse(err);
        }
      },
    },
  },
});
