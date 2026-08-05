# ADR 0001 — Data Model

- **Status:** Accepted
- **Date:** 2026-08-05
- **Deciders:** architect (recorded per AGENTS.md decisions of 2026-08-03 / 2026-08-05)
- **Related:** ADR 0002 (Session table), ADR 0003 (Payment), ADR 0004 (DTOs)

## Context

Zubeli needs a PostgreSQL data model (via Prisma) supporting: a customer storefront (catalog, cart, checkout, accounts) and an owner dashboard (inventory, stock, orders, customers, sales). Country is Rwanda, currency RWF, money is integer minor units. Orders must survive customer deletion (guest checkout allowed) and products must be removable without breaking order history. Payment is Pay-on-Delivery in the MVP but must be gateway-ready later.

## Decision

### Money rule (global, non-negotiable)
- All money is `Int` **minor units** on the DB and in DTOs. RWF has no circulating subunit, so **1 minor unit = 1 RWF**.
- Columns: `priceCents`, `subtotalCents`, `deliveryFeeCents`, `totalCents`, `unitPriceCents`, `amountCents`. Never `Float`/`Decimal` in the MVP — `Int` only.
- A `currency String @default("RWF")` column exists on `Product`, `Order`, `Payment` for future multi-currency; only "RWF" is valid in the MVP (validated at boot + zod).
- Prices are **VAT-inclusive**; there is **no tax line** anywhere in the MVP.
- **Flat delivery fee:** `DELIVERY_FEE_CENTS=2000` (env, validated at boot). The value is **snapshotted onto `Order.deliveryFeeCents` at checkout** so later env changes never rewrite history.

### Enums (single source of truth — Prisma enums)

| Enum | Values |
|---|---|
| `Role` | `CUSTOMER`, `OWNER` |
| `OrderStatus` | `PENDING`, `PAID`, `FULFILLED`, `CANCELLED`, `REFUNDED` |
| `PaymentMethod` | `COD_CASH`, `COD_MOBILE_MONEY`, `BANK_TRANSFER`, `MOMO_GATEWAY` *(reserved)*, `CARD` *(reserved)* |
| `PaymentStatus` | `PENDING`, `PAID`, `REFUNDED`, `FAILED` |
| `InventoryMovementType` | `IN`, `OUT` |
| `InventoryReason` | `RESTOCK`, `ORDER`, `ADJUSTMENT`, `RETURN`, `CANCEL` |

`MOMO_GATEWAY` and `CARD` exist **now** as enum values but no provider implements them in the MVP (ADR 0003). Removing enum values later is a migration; adding them is cheap — so we reserve them today.

### Order status lifecycle (enforced in `src/lib/order.ts`, not by clients)

```
PENDING ──owner confirm / verified webhook──▶ PAID ──fulfill──▶ FULFILLED
   │                                          │
   └──cancel──▶ CANCELLED                     └──refund──▶ REFUNDED
```

- `PENDING → PAID` happens **only** via the owner-only `confirmOrderPayment` action or a future signature-verified webhook. Never client-side (matches payment-integration skill).
- `PAID → CANCELLED` is forbidden — a paid order that is not fulfilled must go `REFUNDED`.
- Stock: `OUT/ORDER` movements at checkout; `IN/CANCEL` restores stock on `CANCELLED`; `REFUNDED` does **not** auto-restock (goods may remain with the customer — returns are manual `ADJUSTMENT`).
- Every transition goes through `transitionOrder()` which throws `InvalidTransitionError` (ADR 0004) on illegal moves.

### Entities (fields; IDs are `String @id @default(cuid())`, timestamps `createdAt`/`updatedAt @default(now())`)

**User**
`email @unique` (stored lowercased), `passwordHash`, `name`, `phone?`, `role Role @default(CUSTOMER)`. No `deletedAt` in MVP — user rows are retained for order history (account deletion is out of scope).

**Session** (see ADR 0002)
`tokenHash @unique`, `user → User`, `expiresAt`, `lastUsedAt?`, timestamps.

**Category**
`name`, `slug @unique`, `description?`, timestamps.

**Product**
`name`, `slug @unique`, `description?`, `imageUrls String[]` (hero image = `imageUrls[0]`), `priceCents Int`, `currency @default("RWF")`, `stockQty Int @default(0)`, `lowStockThreshold Int @default(5)`, `isPublished Boolean @default(false)`, `featured Boolean @default(false)`, `category → Category`, `deletedAt?` (soft delete), timestamps.

**InventoryMovement** (append-only stock ledger)
`product → Product`, `type InventoryMovementType`, `reason InventoryReason`, `quantity Int` (always positive; direction comes from `type`), `note?`, `order → Order?` (set when `reason ∈ {ORDER, CANCEL, RETURN}`), `createdAt`.

**Cart**
`user → User?` **and** `cartToken String?` — exactly one of the two is set (enforced in the repository layer; Postgres allows multiple NULLs, so `@unique` on each works for guests). Guest cart keyed by a server-side `cartToken` cookie (opaque, high-entropy, set on first add-to-cart; held server-side only as a hash if we later store it — MVP stores the raw value, cookie is HttpOnly). On login, the guest cart is merged into the user's cart (one cart per user: `user @unique`).

**CartItem**
`cart → Cart`, `product → Product`, `quantity Int` (> 0), `@@unique([cartId, productId])` — enables `upsert` line increments (prisma-patterns).

**Order** (customer snapshot lives here — the order stands alone)
`number @unique` (display + bank-transfer reference, format `ZBL-XXXXXXXX`), `status OrderStatus @default(PENDING)`, `customer → User?` (nullable — guest orders), snapshot fields `customerName`, `customerPhone`, `customerEmail?`, `customerAddress`, `customerCity?`, money `subtotalCents`, `deliveryFeeCents`, `totalCents`, `currency @default("RWF")`, `bankTransferReference?` (customer-entered transfer ref; required for `BANK_TRANSFER`), `idempotencyKey? @unique` (set to the cart id at checkout — one order per cart), `paidAt?`, `fulfilledAt?`, `cancelledAt?`, timestamps.

**OrderItem** (price/product snapshots — order history never changes)
`order → Order`, `product → Product?` (nullable), `productName` (snapshot), `unitPriceCents` (snapshot), `quantity Int`. Line total is derived (`unitPriceCents × quantity`) in the DTO — no stored column.

**Payment** (one per order)
`order → Order @unique`, `method PaymentMethod`, `status PaymentStatus @default(PENDING)`, `amountCents Int`, `currency @default("RWF")`, `providerPaymentId?` (future gateway reference; null in MVP), `confirmedBy → User?` (owner who confirmed), `confirmedAt?`, timestamps.

### Relations & cascades (explicit, deliberate)

| Relation | onDelete | Why |
|---|---|---|
| `Session.user` | `Cascade` | Sessions are meaningless without the user |
| `CartItem.cart` | `Cascade` | Cart items live and die with the cart |
| `OrderItem.order` | `Cascade` | Order items are part of the order (orders are never hard-deleted anyway) |
| `Payment.order` | `Cascade` | 1:1; payment lifecycle is the order's |
| `Product.category` | `Restrict` | A category with products cannot be deleted — dashboard must recategorize first (no orphaned products) |
| `InventoryMovement.product` | `Restrict` | Append-only audit ledger must never lose rows |
| `Cart.user`, `Order.customer`, `OrderItem.product`, `Payment.confirmedBy` | `SetNull` | Order history / audit survive user or product deletion; snapshots cover display |

### Indexes

| Index | Why |
|---|---|
| `orders(status)` | Dashboard order list filtered by status |
| `orders(customerId, createdAt(sort: Desc))` | Account order history + dashboard customer drill-down |
| `order_items(orderId)` | Order detail line items |
| `products(categoryId)` | Catalog category browse |
| `inventory_movements(productId)` | Stock ledger per product |
| (bonus) `inventory_movements(orderId)` | Order → stock movements trace |

### `imageUrls String[]`, not a `ProductImage` table

Decision: **`String[]` column for MVP.** Justification: (1) there is **no upload infrastructure** — images are static URLs from seed/placeholder services, so there is no metadata (alt text, order, variants, sizes) to store yet; (2) every MVP query loads the whole product row anyway — a join buys nothing; (3) admin CRUD for images stays a simple text field list, no child-table form. Postgres supports text arrays natively and Prisma maps `String[]` cleanly. Migrate to a `ProductImage` table **when** uploads or per-image metadata become real — the churn is contained to product screens (SCREENS.md: inventory-agent) and the DTO keeps `imageUrls: string[]` either way.

## Consequences

- **Good:** order history is immutable (snapshots + SetNull); stock is one source of truth (`Product.stockQty` + append-only movements); guest orders and user deletion are safe; gateway-ready payment columns cost nothing now.
- **Trade-offs:** no multi-variant products, no per-product shipping, no tax line — all deliberately deferred; low-stock alerting is a dashboard query (`stockQty <= lowStockThreshold`), not a separate entity; cart merge-on-login is a small repository chore the backend-agent must implement.
- Customer screen (`/admin/customers/*`) is an **aggregation of `User` + `Order` snapshots** — there is no `Customer` table; `CustomerDTO` (ADR 0004) is derived.

## Schema impact (for database-agent)

1. Implement exactly the 10 models above with the enums, cascades, unique constraints (`email`, `slug`, `tokenHash`, `number`, `idempotencyKey`, `Payment.orderId`, `Cart.user`, `Cart.cartToken`, `CartItem(cartId, productId)`), and indexes listed.
2. `Order.idempotencyKey` and `Cart.cartToken` are **nullable unique** — Postgres allows multiple NULLs; no partial index needed.
3. `imageUrls` is `String[]` (Prisma `String[] @default([])`).
4. Seed: realistic construction-tool catalog, categories, demo customer + demo `OWNER` (bcrypt hash), a demo guest flow is not needed in seed.
5. Money is `Int` everywhere; `currency` is a `String` default `"RWF"` on `Product`, `Order`, `Payment`.
