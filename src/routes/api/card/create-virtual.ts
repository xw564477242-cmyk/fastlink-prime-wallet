import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { cardService } from "@/integrations/thredd/thredd.card.service";
import { requireCustomerId, toErrorResponse } from "@/integrations/thredd/current-customer.server";
import {
  forwardPlatformJson,
  platformApiEnabled,
  platformFetch,
} from "@/integrations/thredd/platform-api.server";

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
          if (platformApiEnabled()) {
            const idempotencyKey = request.headers.get("idempotency-key");
            if (!idempotencyKey) {
              return Response.json({ error: "idempotency_key_required" }, { status: 400 });
            }
            const response = await platformFetch(request, "/api/v1/cards/virtual", {
              method: "POST",
              headers: { "idempotency-key": idempotencyKey },
              body: JSON.stringify(input),
            });
            const created = (await forwardPlatformJson(response)) as Record<string, unknown>;
            return Response.json({
              card: {
                cardId: created.id,
                customerId,
                type: "virtual",
                status: String(created.status).toLowerCase(),
                last4: created.last4,
                expiry: `${String(created.expiryMonth).padStart(2, "0")}/${String(created.expiryYear).slice(-2)}`,
                brand: "VISA",
                alias: created.alias,
                balance: 0,
                currency: created.currency,
                dailyLimit: 0,
                createdAt: created.createdAt,
              },
            });
          }
          const card = await cardService.createVirtualCard({ customerId, ...input });
          return Response.json({ card });
        } catch (err) {
          return toErrorResponse(err);
        }
      },
    },
  },
});
