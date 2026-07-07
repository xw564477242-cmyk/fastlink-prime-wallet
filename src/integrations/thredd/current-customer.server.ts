// Server-only helper to resolve the current customer id.
// TODO: replace with real auth (Supabase user → mapped Thredd customer id).

import "server-only";

export function getCurrentCustomerId(): string {
  return process.env.DEMO_CUSTOMER_ID ?? "cus_demo";
}
