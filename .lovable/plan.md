# Fix: Card state loss on Cloudflare Workers cold starts

## Problem (confirmed)

The mock Thredd backend (`src/integrations/thredd/thredd.mock.ts`) keeps `customers`, `cards`, and `txns` in module-level `Map`s. The app runs on Cloudflare Workers (`vite.config.ts` → nitro cloudflare, `src/server.ts` is a Workers fetch entry). Each isolate has its own module scope and is discarded on cold start, so:

- Newly issued cards (`create-virtual`, `apply-physical`) live only in the isolate that created them.
- A later `freeze` / `unfreeze` / `fund` / detail call on a different isolate throws `card_not_found` → 500.
- `seed()` generates card IDs with `Math.random()` on first call per isolate, so even the "demo" cards have different IDs across isolates.
- `src/routes/cards.tsx` handlers (`toggleFreeze`, `fund`, `togglePin`, `toggleCvv`) have no error UI — failed requests look like silent no-ops.

## Fix plan

Two changes, in one go:

### 1. Persist mock state in Lovable Cloud (Supabase)

Enable Lovable Cloud and move the mock's state into two tables so it survives cold starts and is shared across isolates:

```text
mock_cards      (card_id pk, customer_id, type, status, last4, expiry,
                 brand, alias, balance, currency, daily_limit, pan,
                 cvv, pin, created_at)
mock_card_txns  (id pk, card_id fk, amount, currency, merchant,
                 category, status, timestamp)
```

- RLS enabled; grants to `service_role` only (mock is server-only).
- Seed the three demo cards (`Daily Spend`, `Wallet Card`, `Trip Card`) with **deterministic** IDs (`card_demo_daily`, `card_demo_wallet`, `card_demo_trip`) and fixed PAN/CVV/PIN in the migration itself — no `Math.random()` at runtime for demo rows.
- Rewrite `thredd.mock.ts` to read/write via `supabaseAdmin` (loaded inside each async method, per server-runtime rules) instead of in-memory `Map`s. Keep the same exported `threddMock` API so `thredd.card.service.ts` and all `/api/card/*` routes don't change.
- `create-virtual` / `apply-physical` insert a new row (uuid) — the card is then visible to every isolate.

### 2. Surface errors on the client

In `src/routes/cards.tsx`, wrap `toggleFreeze`, `fund`, `togglePin`, `toggleCvv`, and the "Issue new card" flow in try/catch and show a toast on failure (using the existing toaster in `__root.tsx`). Refetch the card list after a failed mutation so the UI reconciles with server truth instead of silently diverging.

## Out of scope

- Real Thredd API integration (still gated by `THREDD_API_KEY`; when set, `isMockMode()` returns false and none of this runs).
- KYC/customer persistence — same pattern can follow later if needed; this fix targets the card path called out in the finding.

## Why Lovable Cloud vs Cloudflare KV

Lovable Cloud is already the platform's default persistence layer and needs no extra config from the user. KV would work too but adds a binding the template doesn't ship with.
