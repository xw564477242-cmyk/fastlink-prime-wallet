// Webhook signature verification + event dispatcher.
// Applied by /api/public/webhooks/thredd.

import { createHmac, timingSafeEqual } from "crypto";

import type { ThreddWebhookEvent } from "./thredd.types";

const SIGNATURE_HEADER = "x-thredd-signature";

export function getWebhookSecret(): string {
  return process.env.THREDD_WEBHOOK_SECRET ?? "";
}

export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = getWebhookSecret();
  // Fail closed: without a configured secret, webhooks are NEVER accepted.
  // The webhook route must reject with 503 in that case so that an
  // unconfigured deploy cannot be spoofed.
  if (!secret) return false;
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface WebhookHandlers {
  cardCreated?: (
    data: Extract<ThreddWebhookEvent, { type: "card.created" }>["data"],
  ) => Promise<void> | void;
  cardStatusChanged?: (
    data: Extract<ThreddWebhookEvent, { type: "card.status_changed" }>["data"],
  ) => Promise<void> | void;
  authorization?: (
    data: Extract<ThreddWebhookEvent, { type: "authorization" }>["data"],
  ) => Promise<void> | void;
  clearing?: (
    data: Extract<ThreddWebhookEvent, { type: "clearing" }>["data"],
  ) => Promise<void> | void;
  settlement?: (
    data: Extract<ThreddWebhookEvent, { type: "settlement" }>["data"],
  ) => Promise<void> | void;
  kycStatusChanged?: (
    data: Extract<ThreddWebhookEvent, { type: "kyc.status_changed" }>["data"],
  ) => Promise<void> | void;
}

export async function dispatchWebhookEvent(
  event: ThreddWebhookEvent,
  handlers: WebhookHandlers,
): Promise<void> {
  switch (event.type) {
    case "card.created":
      await handlers.cardCreated?.(event.data);
      return;
    case "card.status_changed":
      await handlers.cardStatusChanged?.(event.data);
      return;
    case "authorization":
      await handlers.authorization?.(event.data);
      return;
    case "clearing":
      await handlers.clearing?.(event.data);
      return;
    case "settlement":
      await handlers.settlement?.(event.data);
      return;
    case "kyc.status_changed":
      await handlers.kycStatusChanged?.(event.data);
      return;
  }
}

// Default handlers just log — replace with DB writes / user notifications.
export const defaultHandlers: WebhookHandlers = {
  cardCreated: (d) => console.log("[thredd] card.created", d.cardId),
  cardStatusChanged: (d) => console.log("[thredd] card.status_changed", d.cardId, d.status),
  authorization: (d) => console.log("[thredd] authorization", d.id, d.amount),
  clearing: (d) => console.log("[thredd] clearing", d.id),
  settlement: (d) => console.log("[thredd] settlement", d.id),
  kycStatusChanged: (d) => console.log("[thredd] kyc.status_changed", d.customerId, d.status),
};

export { SIGNATURE_HEADER };
