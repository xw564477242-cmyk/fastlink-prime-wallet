import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { cardService } from "@/integrations/thredd/thredd.card.service";
import { assertOwnsCard, requireCustomerId, toErrorResponse } from "@/integrations/thredd/current-customer.server";

const Body = z.object({
  amount: z.number().positive().max(100_000),
  currency: z.string().min(3).max(3).optional(),
});

export const Route = createFileRoute("/api/card/$id/fund")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        try {
          const customerId = await requireCustomerId(request);
          await assertOwnsCard(params.id, customerId);
          const { amount, currency } = Body.parse(await request.json());
          const card = await cardService.fundCard(params.id, amount, currency);
          return Response.json({ card });
        } catch (err) {
          return toErrorResponse(err);
        }
      },
    },
  },
});
