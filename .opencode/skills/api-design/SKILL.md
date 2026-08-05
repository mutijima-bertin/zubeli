---
name: api-design
description: "Use when exposing or consuming HTTP APIs in zubeli. Covers REST resource naming, methods, status codes, pagination, filtering, error shapes, and versioning."
---

# API Design

Conventions for zubeli's HTTP endpoints (`src/app/api/**`) and how the frontend consumes them. Types are shared via `types/*` — one source of truth for both server and client.

## When to use
- Creating a route handler, webhook, or 3rd-party integration; or fetching from the frontend.
- Reviewing existing endpoints for consistency.

## Core rules
- **Resource-oriented REST**: plural nouns, nested only for genuine ownership.
  - `GET /api/products`, `GET /api/products/:id`, `POST /api/cart/items`, `DELETE /api/cart/items/:id`.
  - Verbs belong in the action (`PATCH /api/orders/:id/status`), not the URL.
- Methods + status codes:
  - `GET` 200; `POST` 201 with `Location`; `PATCH/PUT` 200; `DELETE` 204.
  - 400 invalid input, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict (e.g., stock race), 429 rate limited, 5xx only for unexpected failures.
- **Pagination**: cursor-based for lists. Request `?cursor=...&limit=20` (max 100); response envelope:
  ```json
  { "items": [...], "nextCursor": "abc123", "hasMore": true }
  ```
- **Filtering/sorting**: `?category=power-tools&minPrice=10&sort=price.asc`. Whitelist allowed fields server-side — never pass user keys into Prisma `orderBy`.
- **Error shape** (consistent everywhere):
  ```json
  { "error": { "code": "OUT_OF_STOCK", "message": "Sold out", "details": { "productId": "..." } } }
  ```
  Map from typed errors in the global handler; never leak stack traces.
- Versioning: `/api/v1/...` from day one for anything external. Internal-only endpoints may skip the prefix but must be documented as internal.
- **Backwards-compatible changes**: additive fields OK; renaming/removing/retyping a field or changing pagination envelope is breaking → new version. Update `types/*` and keep server/client in lockstep via a single build step.
- Shared types: define request/response types in `src/types/api.ts`; route handlers and client fetchers import from there. No duplicated inline types.
- Idempotency: `POST /api/checkout` accepts an `Idempotency-Key` header — retries must not double-charge or double-create orders.
- Document every endpoint in `docs/API.md` as it lands.

## Do NOT
- Do NOT invent ad-hoc JSON shapes per endpoint — reuse the error envelope and pagination format.
- Do NOT return raw Prisma models to clients without mapping (exposes internal fields like `createdAt` raw / sensitive columns).
- Do NOT break existing endpoints without a version bump and migration note.

## Related
- backend-patterns (handler implementation), frontend-patterns (SWR/React Query consumption), security-review (rate limits, auth on API), agents: backend-agent, checkout-agent, cart-agent, catalog-agent.
