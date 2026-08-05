# Architecture Decision Records

Status: **Accepted** unless marked otherwise. New ADRs take the next number (`0005-<slug>.md`); never edit an accepted ADR in place — supersede it with a new one.

| # | Title | Status |
|---|---|---|
| [0001](0001-data-model.md) | Data model — entities, enums, money (integer RWF minor units), lifecycle, indexes | Accepted |
| [0002](0002-auth-model.md) | Auth model — bcryptjs, DB-backed sessions, role guards, CSRF, rate limiting | Accepted |
| [0003](0003-payment-abstraction.md) | Payment abstraction — Pay-on-Delivery providers, manual verification, gateway-ready interface | Accepted |
| [0004](0004-api-and-error-contract.md) | API & error contract — server actions, `ActionResult<T>`, typed errors, cursor pagination, DTOs | Accepted |

## How to use

- `database-agent` implements the schema per the "Schema impact" note in ADR 0001 (+ 0002/0003 for auth/payment fields).
- `backend-agent` implements the surface per ADRs 0002–0004.
- Screen agents (`frontend-agent` et al.) consume only DTOs from `src/types/api.ts` and `ActionResult<T>` from actions — never Prisma models.

## Ground rules baked into these ADRs (from AGENTS.md, 2026-08-05)

- Country: Rwanda; currency RWF; **money = integer minor units, 1 minor unit = 1 RWF**, never floats; VAT-inclusive prices, no tax line.
- Order lifecycle: `PENDING → PAID → FULFILLED`, plus `CANCELLED` / `REFUNDED`; `PENDING → PAID` only via owner manual confirmation or a future verified webhook — never client-side.
- `paymentMethod` enum is future-proof: `COD_CASH`, `COD_MOBILE_MONEY`, `BANK_TRANSFER` now; `MOMO_GATEWAY`, `CARD` reserved. Provider abstraction must make a later MTN MoMo / Airtel gateway a drop-in.
- Guest checkout allowed; `userId` nullable on orders; guest cart keyed by server-side `cartToken` cookie.
- Demo MVP: the client hasn't paid the builder — keep it fast to build, gateway-ready, no payment infrastructure.
