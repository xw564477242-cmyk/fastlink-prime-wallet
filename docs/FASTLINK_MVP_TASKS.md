# FastLink MVP — Development Tasks

## Goal

Ship a compliant, dark‑premium fintech wallet that lets a user move USDT into everyday spending in four steps:

**USDT Deposit → Convert → Fund Card → Spend**

The MVP proves the core loop end‑to‑end on mobile, with a clean path to KYC‑gated physical cards, treasury yield, and OTC settlement in later sprints.

---

## Core Flow

1. **USDT Deposit** — User deposits USDT via TRC20 / ERC20 / BEP20 to a FastLink address.
2. **Convert** — User converts USDT to fiat (USD / SGD / MYR / EUR) at a live quote.
3. **Fund Card** — User tops up a Virtual / Physical / Travel card balance from wallet.
4. **Spend** — User pays via Apple Pay, Google Pay, Alipay, WeChat Pay, merchant QR, or card.

---

## Sprint 1 — Money Movement (MVP)

- [x] `/deposit` — Asset + network selector, address + QR, confirmation count, arrival ETA, risk notice.
- [x] `/withdraw` — Asset + network selector, address input, amount, fee, ETA, AML/Travel Rule notice.
- [x] `/transfer` — Peer transfer by FastLink ID / phone / email; currency + amount + note; review panel.
- [x] `/merchant-pay` — Scan merchant QR, order details, funding source (USDT / Fiat / Card), confirm.

Definition of done: user can deposit USDT, convert to fiat, fund a card, and complete a merchant payment on the prototype.

---

## Sprint 2 — Identity & Physical Card

- KYC flow: document capture, liveness, address proof, risk scoring.
- Physical Card application: shipping address, alias, funding source, delivery tracking.
- Card lifecycle: activate, freeze/unfreeze, replace, PIN reset.
- Card tracking: order status, courier tracking number, ETA.

---

## Sprint 3 — OTC, Treasury, Settlement

- OTC desk: large USDT ↔ fiat quotes with settlement window.
- Treasury: idle USDT auto‑yield with opt‑in disclosure.
- Settlement: T+0 / T+1 payout rails to bank accounts (SWIFT / SEPA / FAST / DuitNow).
- Merchant settlement reports and CSV export.

---

## Compliance & Risk (cross‑sprint)

- AML / Travel Rule notices on deposit and withdrawal.
- Card program disclosure: issued by licensed partner financial institution.
- Region‑gated features and per‑user limits.
