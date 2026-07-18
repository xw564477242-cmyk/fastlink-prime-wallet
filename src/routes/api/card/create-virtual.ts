import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { cardService } from "@/integrations/thredd/thredd.card.service";
import { requireCustomerId, toErrorResponse } from "@/integrations/thredd/current-customer.server";

const Body = z.object({
  alias: z.string().min(1).max(30).optional(),
  currency: z.string().min(3).max(3).optional(),
});

export const Route = createFileRoute("/api/card/create-virtual")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const customerId = await requireCustomerId(request);
          const input = Body.parse(await request.json().catch(() => ({})));
          const card = await cardService.createVirtualCard({ customerId, ...input });
          return Response.json({ card });
        } catch (err) {
          return toErrorResponse(err);
        }
      },
    },
  },
});
