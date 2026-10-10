# Backend review — serverless/Vercel + category CRUD wave (2026-10-05)

> **RECONSTRUCTED 2026-10-05 by quality-agent.** The original reviewer returned these findings but the file never landed on disk. Recreated verbatim from the reviewer's returned findings; no code re-inspection beyond the quality-gate verification (see `2026-10-05-quality-agent-final-verdict.md`).

Reviewer: quality-agent (backend-reviewer role) · READ-ONLY · surface: uncommitted working tree on `main`.
Scope: `src/lib/orders.ts`, `src/lib/payments/*`, `src/actions/checkout.ts`, `src/lib/rate-limit.ts`, `src/actions/admin/categories.ts`, `src/lib/db/categories.ts`, `src/app/api/admin/upload/route.ts`, zod schemas.

## Findings
- **HIGH-1** `src/lib/orders.ts:68-82` — the payment allowlist was enforced AFTER `createOrder` persisted the order/payment, moved stock and cleared the cart; a tampered disabled-method POST still created an order. Same defect as the security-review HIGH. **RESOLVED** — `placeOrder` resolves `getPaymentProvider` at `orders.ts:74` before `createOrder` (`:76`); `serverCheckoutSchema.superRefine` (`actions/checkout.ts:32-40`) rejects pre-DB. Owner: backend-agent.
- **HIGH-2** `src/app/api/admin/upload/route.ts` — reviewer could not statically confirm the upload route's auth guard. **CONFIRMED FALSE POSITIVE** — `requireAdminOrThrow()` at `route.ts:69` (dispatch brief cited :45); security-review A rated the upload surface CLEAN. No action.
- **MEDIUM** rate limiting is applied inconsistently across admin actions (only `src/actions/admin/categories.ts` calls `assertRateLimit`; sibling admin actions do not). Owner: backend-agent. → backlog.
- **MEDIUM** `listAll()` caller audit requested (layout + page both call it). Resolved by the `React.cache` dedupe (`src/lib/db/categories.ts:79-110`). Owner: backend-agent.
- **MEDIUM** category zod schemas lacked `.strict()` (unknown keys silently stripped). **RESOLVED** — `.strict()` at `src/lib/validation/category.ts:47,73`. Owner: backend-agent.
- **MEDIUM** category update relies on the generic P2002→CONFLICT fallback rather than a field-level slug error (`src/lib/db/categories.ts:167`). Owner: backend-agent. → backlog (owner-gated, non-blocking).
- **MEDIUM** `AdminCategory` type placement (declared alongside db queries rather than `types/*`). Owner: backend-agent. → backlog.
- **LOW/INFO** no `assertRateLimit` on category mutations beyond the existing call; raw-SQL `ctid` prune is Postgres-specific (Neon-only by design). Owner: backend-agent. → backlog.

**Verdict:** no unaddressed CRITICAL/HIGH after the wave. HIGH-1 fixed, HIGH-2 false positive. Remaining MEDIUMs are owner-gated/scale-time → backlog.
