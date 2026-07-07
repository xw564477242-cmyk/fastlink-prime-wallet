import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { cardService } from "@/integrations/thredd/thredd.card.service";

const Body = z.object({
  amount: z.number().positive().max(100_000),
  currency: z.string().min(3).max(3).optional(),
});

export const Route = createFileRoute("/api/card/$id/fund")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const { amount, currency } = Body.parse(await request.json());
        const card = await cardService.fundCard(params.id, amount, currency);
        return Response.json({ card });
      },
    },
  },
});
