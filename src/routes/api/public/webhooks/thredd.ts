import { createFileRoute } from "@tanstack/react-router";

import {
  SIGNATURE_HEADER,
  defaultHandlers,
  dispatchWebhookEvent,
  verifyWebhookSignature,
} from "@/integrations/thredd/thredd.webhook.controller";
import type { ThreddWebhookEvent } from "@/integrations/thredd/thredd.types";

export const Route = createFileRoute("/api/public/webhooks/thredd")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const signature = request.headers.get(SIGNATURE_HEADER);
        if (!verifyWebhookSignature(raw, signature)) {
          return new Response("Invalid signature", { status: 401 });
        }
        let event: ThreddWebhookEvent;
        try {
          event = JSON.parse(raw) as ThreddWebhookEvent;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        try {
          await dispatchWebhookEvent(event, defaultHandlers);
        } catch (err) {
          console.error("[thredd webhook] dispatch error", err);
          return new Response("Handler error", { status: 500 });
        }
        return Response.json({ received: true });
      },
    },
  },
});
