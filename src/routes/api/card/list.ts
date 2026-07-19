import { createFileRoute } from "@tanstack/react-router";

import { cardService } from "@/integrations/thredd/thredd.card.service";
import { requireCustomerId, toErrorResponse } from "@/integrations/thredd/current-customer.server";
import {
  forwardPlatformJson,
  platformApiEnabled,
  platformFetch,
} from "@/integrations/thredd/platform-api.server";

export const Route = createFileRoute("/api/card/list")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const customerId = await requireCustomerId(request);
          if (platformApiEnabled()) {
            const response = await platformFetch(request, "/api/v1/cards");
            const rows = (await forwardPlatformJson(response)) as Array<Record<string, unknown>>;
            return Response.json({
              source: "platform",
              capabilities: ["CREATE_VIRTUAL", "GET_CARD", "BALANCE", "TRANSACTIONS"],
              cards: rows.map((card) => ({
                cardId: card.id,
                customerId,
                type: String(card.type).toLowerCase(),
                status: String(card.status).toLowerCase(),
                last4: card.last4,
                expiry: `${String(card.expiryMonth).padStart(2, "0")}/${String(card.expiryYear).slice(-2)}`,
                brand: "VISA",
                alias: card.alias,
                balance: Number(card.availableBalanceMinor ?? 0) / 100,
                currency: card.currency,
                dailyLimit: 0,
                createdAt: card.createdAt,
              })),
            });
          }
          const cards = await cardService.getCardList(customerId);
          return Response.json({ source: "legacy", capabilities: ["ALL"], cards });
        } catch (err) {
          return toErrorResponse(err);
        }
      },
    },
  },
});
