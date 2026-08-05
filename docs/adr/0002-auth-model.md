# ADR 0002 — Auth Model

- **Status:** Accepted
- **Date:** 2026-08-05
- **Deciders:** architect
- **Related:** ADR 0001 (User/Session schema), ADR 0004 (NotAuthorizedError)

## Context

Zubeli has two personas: **customers** (storefront, cart, orders) and the **owner** (dashboard — inventory, orders, sales, customers). The MVP is a demo the builder shows the client, so auth must be secure enough to defend the admin surface but simple to build and run on Node 22 with no native-build fragility. Payment is manual/Pay-on-Delivery, so there is no third-party auth surface to integrate with yet.

## Decision

### Password hashing: `bcryptjs` (not argon2, not native bcrypt)

- `bcryptjs` is pure JavaScript: **no `node-gyp`, no native compilation**, no prebuilt-binary download risk on Node 22 / the builder's machine, and no Docker build friction. `argon2` (even `argon2-wasm`) and native `bcrypt` both require native modules — a real install risk for a demo that must build on first try.
- Cost factor: `BCRYPT_ROUNDS` env, **default 10** (tunable to 12 when the box is fast enough). Wrapped in `src/lib/password.ts` (`hashPassword` / `verifyPassword`) so a later switch to `argon2id` is a one-file change; existing bcrypt hashes get rehashed on next successful login if we ever swap.
- Password rule (zod): min 8 chars, max 72 bytes (bcrypt input limit). Plaintext is never logged, returned, or stored.

### Sessions: DB-backed `Session` table (ADR 0001)

- Login → `crypto.randomBytes(32).toString('base64url')` token returned **once**; DB stores only `sha256(token)` hex in `Session.tokenHash` (unique). A DB leak does not leak live tokens.
- Cookie: name `zubeli_session`, value = raw token; attributes **HttpOnly, SameSite=Lax, Path=/**, `Secure` in production, `Max-Age` 30 days (session row `expiresAt = now + 30d`). No JS access, ever.
- **Rotation on login:** each successful login deletes the user's previous sessions and issues one fresh session (kills session-fixation and stale devices). Logout deletes the session row + clears the cookie. Fixed 30-day expiry, no sliding renewal in the MVP.
- Lookup helper: `getSessionUser()` hashes the cookie token, fetches `Session` with `user` where `expiresAt > now`, updates `lastUsedAt` opportunistically (throttled — not per request).

### Guards: helpers + middleware map (defense in depth)

- `requireUser()` — throws `NotAuthorizedError` if no valid session. Returns the `User`.
- `requireAdmin()` — `requireUser()` + `role === OWNER`, else `NotAuthorizedError`. Central helper used by **every** admin action/route — client-side hiding is not a control (security-review).
- `middleware.ts` guard map (first layer, UX redirects only):
  - `/admin/*` → require valid session **and** `OWNER` role, else redirect `/login`
  - `/account/*` → require valid session, else redirect `/login`
  - `/checkout` → **allowed unauthenticated** (guest checkout; cart identity comes from the `cartToken` cookie)
  - everything else public
- Real enforcement is always the `requireUser/requireAdmin` call at the top of each action — middleware is never the control (security-review: defense in depth; e.g., an action must still re-check ownership/role even if middleware is bypassed).
- **IDOR rule:** every fetch of an owned resource checks `order.customerId === session.userId` (or admin) in the repository/action — never "just logged in".

### Roles

- `CUSTOMER` via `/register` (email unique + lowercased, password hashed). No self-serve admin registration.
- First `OWNER` is **bootstrapped by the seed** (demo credentials from env/seed config). Additional owners, if ever needed, are created by the existing owner — out of MVP scope.

### CSRF stance

- All state changes are **server actions** (Next.js native CSRF protection) + `SameSite=Lax` cookies. The only route handler in the MVP is `GET /api/health` (no state change). **No custom CSRF token infrastructure** is needed; if a cookie-authenticated route handler ever appears, add origin/referer checks per security-review.

### Rate limiting: token bucket in `src/lib/rate-limit.ts`

- In-memory token bucket (Map keyed by `ip`, `ip:email`, or `ip:cart`) — **fine for the single-instance demo**; documented swap to Redis/Upstash when horizontally scaled (deployment-patterns).
- Limits (MVP defaults, env-tunable): login **10 / 15 min per IP+email**; register **5 / hour per IP**; checkout **10 / hour per IP+cart**. Exceeded → `RateLimitError` (ADR 0004 → 429).
- Per-account lockout (failed-attempt counter) is **deferred** — rate limiting is the MVP brute-force control. Revisit before real launch.

## Consequences

- **Good:** zero native build risk; sessions revocable (delete row = logout); DB leak doesn't expose usable tokens; guests never touch auth; the admin surface has two independent check layers.
- **Trade-offs:** bcryptjs is slower than native bcrypt/argon2 — irrelevant at demo scale (cost 10, ~100 ms); in-memory rate limit resets on redeploy and is single-instance only — acceptable for MVP, flagged for launch; no "remember me" / device list / password reset in MVP (reset = owner re-seeds or manual change later).

## Schema impact (for database-agent)

Covered by ADR 0001: `User` (`email @unique` lowercased, `passwordHash`, `role`) + `Session` (`tokenHash @unique`, `expiresAt`, `lastUsedAt?`, `user` onDelete Cascade). No auth-specific columns beyond that. `crypto` + `bcryptjs` are the only new runtime deps.
