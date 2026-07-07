import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { cardService } from "@/integrations/thredd/thredd.card.service";
import { getCurrentCustomerId } from "@/integrations/thredd/current-customer.server";

const Body = z.object({
  shippingAddress: z.string().min(4).max(500),
  alias: z.string().min(1).max(30).optional(),
});

export const Route = createFileRoute("/api/card/apply-physical")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const input = Body.parse(await request.json());
        const customerId = getCurrentCustomerId();
        const card = await cardService.createPhysicalCardRequest({ customerId, ...input });
        return Response.json({ card });
      },
    },
  },
});
