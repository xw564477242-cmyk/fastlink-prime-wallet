import { createFileRoute } from "@tanstack/react-router";

import { cardService } from "@/integrations/thredd/thredd.card.service";
import { assertOwnsCard, requireCustomerId, toErrorResponse } from "@/integrations/thredd/current-customer.server";
import type { ThreddCard, ThreddCardDetail } from "@/integrations/thredd/thredd.types";

function stripSecrets(c: ThreddCardDetail): ThreddCard {
  const { pan: _p, cvv: _c, pin: _pi, ...rest } = c;
  return rest;
}

export const Route = createFileRoute("/api/card/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          const customerId = await requireCustomerId(request);
          await assertOwnsCard(params.id, customerId);
          const detail = await cardService.getCardDetail(params.id);
          return Response.json({ card: stripSecrets(detail) });
        } catch (err) {
          return toErrorResponse(err);
        }
      },
    },
  },
});
