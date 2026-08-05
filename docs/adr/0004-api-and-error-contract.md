# ADR 0004 — API & Error Contract

- **Status:** Accepted
- **Date:** 2026-08-05
- **Deciders:** architect
- **Related:** ADR 0001 (model), ADR 0002 (guards), ADR 0003 (payment actions); skills api-design, backend-patterns

## Context

The storefront and dashboard need a single, typed, consistent surface for data + mutations. Next.js App Router gives us two mechanisms — server actions and route handlers. We must pick one mutation surface, define the error shape, and fix pagination/DTO conventions so `frontend-agent` screen agents and `backend-agent` never invent ad-hoc shapes (api-design skill: "no ad-hoc JSON shapes"; SCREENS.md: `types/*` owned by backend-agent).

## Decision

### Surface: server actions for all data + mutations; one route handler only

- **Mutations and reads** are server actions in `src/actions/*` (`auth.ts`, `cart.ts`, `checkout.ts`, `catalog.ts`, `admin-products.ts`, `admin-stock.ts`, `admin-orders.ts`, `admin-sales.ts`, `account.ts`). Server components call them or repositories directly for reads; client forms call them for mutations (backend-patterns: validation → auth → repository, thin actions).
- **Route handlers:** exactly one in the MVP — `GET /api/health` → `200 { status: "ok" }` (internal endpoint; no `/api/v1` prefix needed — api-design skill versioning applies to external APIs; documented as internal).
- No REST catalog/order endpoints in the MVP — the storefront is server-rendered + server actions. When webhooks arrive (ADR 0003), they land as `POST /api/v1/webhooks/:provider` route handlers with signature verification.

### `ActionResult<T>` union (returned by every action)

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: Record<string, unknown> } };
```

- `data` is always a DTO (below), fully serializable (dates as ISO strings, money as integer minor units).
- `error.details` carries machine-readable context only (e.g., `{ productId }`, `{ fieldErrors }`) — never stack traces or internal messages (backend-patterns).

### Typed error classes (`src/lib/errors.ts`) + mapping

Every action throws typed errors; a shared `toActionResult(e)` maps them. No bare `throw new Error` in actions.

| Class | `code` | HTTP (future route handlers) | Meaning |
|---|---|---|---|
| `NotAuthorizedError` | `UNAUTHORIZED` | 401 (not logged in) / 403 (wrong role or IDOR) | invalid/expired session, non-owner on admin action, cross-user resource access |
| `NotFoundError` | `NOT_FOUND` | 404 | resource missing (also `P2025` mapped here) |
| `ValidationError` | `VALIDATION` | 400 | zod failure (`details.fieldErrors`), bad method, empty cart, missing `bankTransferReference` |
| `ProductOutOfStockError` | `OUT_OF_STOCK` | 409 | `details: { productId, requested, available }` — checked inside the checkout transaction |
| `InvalidTransitionError` | `INVALID_TRANSITION` | 409 | illegal `OrderStatus` move (ADR 0001 lifecycle) |
| `RateLimitError` | `RATE_LIMITED` | 429 | token bucket exceeded (ADR 0002) |

Prisma error mapping: `P2002` unique violation → `ValidationError` (or `CONFLICT` 409 where semantic), `P2025` → `NotFoundError` (prisma-patterns). Actions return `ActionResult<T>`; route handlers (future) return the same error object with the HTTP status above.

### Validation

- **Every action input is zod-parsed at the boundary** (`createOrderSchema.parse(input)`); `FormData` is coerced; server-side validation is the only trust (security-review). Schema files colocated in `src/actions/*/schemas.ts` or inline in the action module.
- Auth check (`requireUser` / `requireAdmin`, ADR 0002) is the **first line of every action** that touches user/owner data; IDOR ownership checks on every owned fetch.

### Pagination: cursor-based, one envelope

- Request: `cursor?` (opaque string) + `limit` (default 20, **max 100**). Response envelope everywhere:
  ```json
  { "items": [...], "nextCursor": "base64(createdAt,id)", "hasMore": true }
  ```
- `nextCursor` is opaque base64 of the `(createdAt, id)` tuple of the last item; ordering fixed per list (e.g., orders `createdAt DESC` matching `@@index([customerId, createdAt(sort: Desc)])`, ADR 0001). Sort/filter fields are **whitelisted server-side** — never pass client keys into Prisma `orderBy` (api-design skill).
- Used by: catalog (`/products`), account order history, and all admin list screens (products, orders, customers, stock movements, sales breakdowns).

### DTOs in `src/types/api.ts` (single source of truth — SCREENS.md: `types/*` owned by backend-agent)

Mapping functions in `src/lib/dto.ts`; **raw Prisma models never cross the boundary** (api-design skill). Money stays integer minor units; `currency` included; dates are ISO strings.

- `ProductDTO` — `{ id, slug, name, description, imageUrls, priceCents, currency, stockQty, lowStockThreshold, isPublished, featured, category: CategoryDTO }`
- `CategoryDTO` — `{ id, slug, name }`
- `CartDTO` — `{ id, items: { product: ProductDTO, quantity, lineTotalCents }[], subtotalCents, deliveryFeeCents, totalCents, currency }`
- `OrderDTO` — `{ id, number, status, method, items: OrderItemDTO[], subtotalCents, deliveryFeeCents, totalCents, currency, customerName, customerPhone, customerEmail, customerAddress, customerCity, bankTransferReference?, paidAt?, fulfilledAt?, cancelledAt?, createdAt }` + `paymentInstructions?` (from ADR 0003) + `payableNow`-style flags for the dashboard action buttons (derived from status, not stored)
- `OrderItemDTO` — `{ productId?, productName, unitPriceCents, quantity, lineTotalCents }`
- `PaymentDTO` — `{ id, orderId, method, status, amountCents, currency, confirmedBy?, confirmedAt? }`
- `CustomerDTO` — derived from `User` + `Order` aggregates (ADR 0001): `{ id?, name, phone, email?, ordersCount, totalSpentCents, lastOrderAt? }` (guests appear as order-snapshot customers with `id: null`)
- `SalesOverviewDTO` — `{ periodStart, periodEnd, totalRevenueCents, ordersCount, paidOrdersCount, averageOrderValueCents, currency }` for `/admin` + `/admin/sales` (revenue from `PAID`/`FULFILLED` orders only — `PENDING` is not revenue)

### Cache invalidation

After any mutation that changes storefront-visible data (products, stock, orders), actions call `revalidatePath`/`revalidateTag` (backend-patterns). Tags: `products`, `product:<slug>`, `cart:<id>`, `orders:<id>`.

## Consequences

- **Good:** one error contract the whole UI consumes; screens can't invent shapes; DTO layer hides Prisma internals and PII (no `passwordHash`, no internal fields); pagination is consistent across every list; actions are thin → unit-testable (tdd-workflow).
- **Trade-offs:** no REST API for third parties in the MVP (not needed — no mobile app, no integrations); DTO mapping is a small overhead layer; in-memory rate limiting (ADR 0002) bounds action abuse per instance only.

## Schema impact (for database-agent)

None — ADR 0001 already covers the schema. `database-agent` only needs to keep the DTO field names in sync with Prisma model field names (they are 1:1 by design, except derived fields: `lineTotalCents`, `totalCents`, `CustomerDTO`, `SalesOverviewDTO`).
