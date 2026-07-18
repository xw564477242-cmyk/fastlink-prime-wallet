import { createFileRoute } from "@tanstack/react-router";

import { cardService } from "@/integrations/thredd/thredd.card.service";
import { assertOwnsCard, requireCustomerId, toErrorResponse } from "@/integrations/thredd/current-customer.server";

export const Route = createFileRoute("/api/cards/$id/fund")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const customerId = await requireCustomerId(request);
          await assertOwnsCard(params.id, customerId);
          const body = (await request.json().catch(() => ({}))) as {
            amount?: number;
            currency?: string;
          };
          if (typeof body.amount !== "number" || body.amount <= 0) {
            return Response.json({ error: "amount must be a positive number" }, { status: 400 });
          }
          const card = await cardService.fundCard(params.id, body.amount, body.currency ?? "USD");
          return Response.json({ card });
        } catch (err) {
          return toErrorResponse(err);
        }
      },
    },
  },
});
