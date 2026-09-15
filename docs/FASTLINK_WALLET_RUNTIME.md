# FastLink Wallet Runtime Contract

The Lovable UI is the formal FastLink wallet frontend.

## Required build variables

| Variable                    |  Required | Rule                                               |
| --------------------------- | --------: | -------------------------------------------------- |
| `VITE_FASTLINK_API_URL`     |       Yes | Railway Backend base URL ending in `/api`          |
| `VITE_FASTLINK_ENVIRONMENT` |       Yes | `LOCAL`, `SANDBOX`, `TEST`, `UAT`, or `PRODUCTION` |
| `VITE_FASTLINK_BUILD_SHA`   | Yes in CI | Source commit used for the build                   |

Production requires an HTTPS API URL.

## Session boundary

- The frontend does not initialize or call the Supabase SDK.
- A bearer session is accepted only after Railway Backend validates it through
  `GET /api/v1/session`.
- The wallet build environment must match the environment returned by the Backend session.
- The bearer value is stored in browser session storage, not local storage.

## Data boundary

- Cards, card balances, and card transactions come from Railway Backend `/api/v1/cards`.
- Freeze and unfreeze are persisted through Railway Backend.
- Every request includes `X-Trace-Id`; mutation requests also include `Idempotency-Key`.
- Failed requests clear the affected data and display `Unavailable`; no static or stale data is shown.
- Features without an authenticated end-user Backend contract are disabled.

## Removed production paths

- Supabase client session and database integration
- Embedded Thredd HTTP client
- Thredd mock provider and seed data
- Same-origin legacy `/api/card/*` routes
- Demo MCP balance/card tools

## 2026-09-15 补充说明（DEV-UI-000）

以上历史内容原样保留。当前源码使用 Cookie `credentials: include`，未使用 Bearer/sessionStorage；本次公共底座范围限定 TEST/SANDBOX 与同源 `/api`。历史描述与当前源码之间的差异、未验证部署项及公共异常归属，见 [FRONTEND-BASELINE](environment/FRONTEND-BASELINE.md)。本说明不代表 Railway 历史契约已复核，也不修改余额口径。
