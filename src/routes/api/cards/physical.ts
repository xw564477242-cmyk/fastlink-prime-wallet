import { createFileRoute } from "@tanstack/react-router";

import { cardService } from "@/integrations/thredd/thredd.card.service";
import { getCurrentCustomerId } from "@/integrations/thredd/current-customer.server";

export const Route = createFileRoute("/api/cards/physical")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          shippingAddress?: string;
          alias?: string;
        };
        if (!body.shippingAddress) {
          return Response.json({ error: "shippingAddress is required" }, { status: 400 });
        }
        const customerId = getCurrentCustomerId();
        const card = await cardService.createPhysicalCardRequest({
          customerId,
          shippingAddress: body.shippingAddress,
          alias: body.alias,
        });
        return Response.json({ card });
      },
    },
  },
});
