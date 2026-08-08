# Quality Gate — Foundation Phase (backend + data layer + storefront foundation + tests)

*Date: 2026-08-07 · Agent: quality-agent · Scope: full working tree (uncommitted included)*

## Verdict: **FAIL** — one HIGH finding open (fix task dispatched below). Everything else green.

The gate is one trivial fix away from PASS: the design-system primary CTA uses
white text on `brand-600` (#d97706) at 3.19:1 contrast, failing WCAG 2.2 AA
(4.5:1). All mechanical checks are green; no CRITICAL or security findings.

---

## 1. Baseline checks (evidence)

| Check | Result | Evidence |
|---|---|---|
| `npx tsc --noEmit` | PASS | exit 0, no errors |
| `npm run lint` | PASS | exit 0, no warnings |
| `npx vitest run` | PASS | **227 passed / 0 failed** (12 files), 2.78s |
| App boot / docker / dev server | NOT RUN | belongs to `runner` (gate is static + tests only) |

## 2. Reviewer passes

Reviewer suite executed as in-role sequential passes (runtime has no child-spawn
tool; same brief discipline per reviewer: scope, contract, evidence). Files
covered: `src/lib/*`, `src/actions/*` (all 22), `src/middleware.ts`,
`src/components/ui/*`, `src/components/storefront/*`, `src/lib/hooks/*`,
`src/app/(store)/*`, `prisma/schema.prisma` + migration + seed, `src/types/api.ts`,
`tests/*` (spot-checked for meaningfulness).

## 3. Aggregated findings

### HIGH (1) — must close before certification
- **[a11y] White text on brand-600 = 3.19:1, fails WCAG 2.2 AA 1.4.3 (4.5:1)**
  - `src/components/ui/Button.tsx:10` — `primary: "bg-brand-600 text-white"` (system-wide primary CTA)
  - `src/components/storefront/CartBadge.tsx:25` — item-count badge `bg-brand-600 text-white` (11px bold)
  - `src/components/storefront/Header.tsx:27` — skip link `focus:bg-brand-600 focus:text-white`
  - **Fix task → frontend-agent**: switch the three usages to `brand-700` (#b45309 = 5.02:1, hover/active brand-800/900) or darken the `brand-600` token. Verify visually + `npm run lint && npx tsc --noEmit`. Re-run the gate after.

### MEDIUM (5) — backlog / accept-with-note
- **[a11y] Focus indicator contrast** — `:focus-visible` ring is amber-500 on white ≈ 2.15:1, under WCAG 2.2 2.4.13 (3:1). Ring exists (usable); darken to brand-700 or double-indicator. Owner: frontend-agent. *(bundled with the HIGH fix)*
- **[code] Duplicated file header** — `src/lib/hooks/useProducts.ts:1–12` has the whole docstring + `"use client"` twice (lines 1–6 and 7–12). Owner: frontend-agent. Trivial.
- **[security] XFF spoofing** — `src/lib/request.ts:14` trusts first `x-forwarded-for` entry; spoofable if the app is ever reachable without a proxy stripping XFF → rate-limit bypass on login/register/checkout. Fine behind a proxy. Owner: devops-agent (document the proxy requirement at deploy time). **Accept-with-note.**
- **[backend] Checkout idempotency race** — `src/lib/db/orders.ts:50–56`: idempotency pre-check is outside the transaction; concurrent double-submit both pass it, but the unique `idempotencyKey` constraint aborts the second transaction (no duplicates, no partial writes — safe), surfacing a generic CONFLICT to the user. Screens should disable submit while pending. **Accept-with-note.**
- **[db] Unbounded customer list query** — `src/lib/customers-admin.ts:49–58` loads all users + all their orders with in-memory pagination. Fine at MVP volumes; revisit pre-launch (extends the documented db-layer gap family → database-agent follow-up). **Accept-with-note.**

### LOW (7) — backlog
- **Dead code**: `ProductOutOfStockError` (`src/lib/errors.ts:52–65`) never thrown. Owner: backend-agent.
- **Dead env**: `SESSION_SECRET` documented in `.env.example`/RUNBOOK but unused (DB sessions). Owner: devops-agent/docs-writer.
- **`withRateLimit`** (`src/lib/rate-limit.ts:71`) unused in app code (tested only) — keep as documented utility or use it. Owner: backend-agent.
- **`revalidatePath` on a read action** — `src/actions/account.ts:48` (`getMyOrderAction`). Harmless; remove for cleanliness. Owner: backend-agent.
- **Provider interface vs MVP impls** — `PaymentProvider.verifyWebhook/refund` declare gateway-era args, MVP impls ignore them (`src/lib/payments/types.ts:49–50` vs `providers.ts:37,41`). Intentional; revisit when the gateway lands. **Accept-with-note.**
- **No caching in (store) layout** — 3 DB queries per request (`src/app/(store)/layout.tsx:24–28`). Fine for MVP; screen agents should `unstable_cache` categories. **Accept-with-note.**
- **Guest cart orphaned on registration/login** — `ensureCart()` keys registered carts by userId (`src/lib/cart.ts:54–59`); guest items never merge. Product decision for account-agent/checkout-agent screens. **Accept-with-note.**

### Known findings — NOT re-raised (per gate brief, no new evidence)
- `getRelated` no-dedupe within featured pool (documented in tests; DB rows unique — harmless).
- `ProductCardDTO` lacks `lowStockThreshold` → `stockQty ≤ 5` heuristic in `ProductCard.tsx` (DB gap → database-agent).
- db-layer gaps: no restock primitive, `products-admin` re-queries, `customers-admin` in-memory pagination (→ database-agent).

## 4. What passed (spotlights)
- **Security pass clean**: sha256(token) DB sessions, rotation-on-login + 7d inactivity, httpOnly/Lax/Secure-prod cookies, `requireAdminOrThrow` first line of every admin action (verified by grep — none missing), IDOR check on order detail, uniform-timing login (dummy bcrypt hash), rate limits before bcrypt, conditional `bankTransferReference` superRefine, negative-stock guard, typed error envelope never leaking internals, middleware defense-in-depth only.
- **Data layer**: single-transaction checkout (stock validate → snapshots → PENDING payment → decrement + ledger → cart clear), idempotency + order-number collision retry, keyset pagination everywhere, raw SQL only where column arithmetic demands it, soft delete with intact history, ledger consistency (IN/OUT + reasons).
- **A11y strong points**: skip link, dialog focus trap/restore, FormField id/aria wiring, aria-live toast viewport + quantity stepper, disclosure patterns (aria-expanded/haspopup), labeled search, semantic nav landmarks, reduced-motion support.
- **Perf**: next/image fill + sizes on ProductCard, self-hosted fonts, no new heavy deps (cx is hand-rolled), tree-shakeable barrel.
- **Tests**: 227 behavior-focused tests incl. transitions matrix, rate-limit timing, DTO boundaries, useCart hook (jsdom).

## 5. Dispatched fix tasks (for orchestrator)
1. **frontend-agent (HIGH + MEDIUM #2 + #3)**: fix brand-600/white contrast in `Button.tsx:10`, `CartBadge.tsx:25`, `Header.tsx:27` (brand-700 base); darken focus ring or add double indicator; delete duplicated header in `useProducts.ts:1–12`. Verify: tsc + lint + vitest green; then re-run this gate.
2. **Next-gate backlog**: backend-agent (dead code, revalidatePath-on-read, withRateLimit), devops-agent (XFF proxy note, SESSION_SECRET cleanup), docs-writer (env doc update), database-agent (customers query + db-repo formalization), account/checkout agents (guest-cart merge notice).

## 6. Verification evidence
- tsc 0 errors; eslint 0 issues; vitest 227/227 (12 files) — all re-verified AFTER review passes (no code changed during gate).
- No application files were modified by this gate (read-only except this report).

---

# RE-GATE 2026-08-07 (post-fix verification)

*Agent: quality-agent · Input: `docs/reports/2026-08-07-frontend-agent-contrast-fix.md` · Focused re-gate (no full reviewer suite re-run — only the 5 changed files + mechanical checks).*

## Verdict: **PASS**

The single HIGH and both bundled MEDIUM items are closed with verified evidence. No CRITICAL/HIGH findings remain open. The accepted-with-note list is unchanged and carries to the next gate. This supersedes the FAIL verdict above.

## 1. Baseline checks (evidence, re-run this gate)

| Check | Result | Evidence |
|---|---|---|
| `npx tsc --noEmit` | PASS | exit 0, no errors |
| `npm run lint` | PASS | exit 0, no issues |
| `npx vitest run` | PASS | **227 passed / 0 failed** (12 files), 2.61s |

## 2. Fixed-item confirmation (one line each)

- **[HIGH] Button.tsx:10** — `primary` now `bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900`; hover/active steps still distinct; no other variant touched. ✅
- **[HIGH] CartBadge.tsx:25** — item-count badge now `bg-brand-700 … text-white`; size/position/aria unchanged. ✅
- **[HIGH] Header.tsx:27** — skip link focus now `focus:bg-brand-700 focus:text-white`; sr-only pattern intact. ✅
- **[MEDIUM] globals.css:30–32** — `:focus-visible` outline `#f59e0b` → `#b45309`, 2px/offset-2px/radius-2px unchanged; comment documents the ratio. The `prefers-reduced-motion` block visible in `git diff` is pre-existing foundation work (2026-08-06), not part of this fix. ✅
- **[MEDIUM] useProducts.ts** — duplicated header removed: `"use client"` once (line 1), single docstring (lines 2–6); `quickAdd`/`pending`/toast logic byte-identical in behavior. ✅

## 3. Contrast spot-check (WCAG 2.x formula, computed this gate)

| Pair | Claimed | Computed | Verdict |
|---|---|---|---|
| white / brand-700 #b45309 | 5.02:1 | 5.02:1 | ✅ AA 1.4.3 (≥4.5) |
| brand-700 ring on white | 5.02:1 | 5.02:1 | ✅ AA 2.4.13 (≥3) |
| white / brand-800 #92400e (hover) | 7.09:1 | 7.09:1 | ✅ |
| white / brand-900 #78350f (active) | 9.07:1 | 9.07:1 | ✅ |
| brand-700 on stone-50 / stone-100 | 4.81 / 4.60 | 4.81 / 4.60 | ✅ (≥3) |
| (control) old white / brand-600 | 3.19:1 | 3.19:1 | finding was real — now fixed |

No test file asserts the old colors (grep `d97706|f59e0b` in `tests/` = 0 hits). Remaining `brand-600` usages are input focus borders/rings (`Input.tsx:24`, `Select.tsx:22`, `Textarea.tsx:20`, `SearchBox.tsx:34`) — decorative accent paired with brand-100 ring, never text-on-color; out of the finding's scope, no action.

## 4. Accepted-with-note list — UNCHANGED (carries to next gate)

Verified still present in tree, status unchanged: XFF spoofing (`src/lib/request.ts:13–14`), checkout idempotency pre-check outside tx (`src/lib/db/orders.ts:50–56`), unbounded customers query (`src/lib/customers-admin.ts:49–58`), provider interface vs MVP impls, no caching in (store) layout, guest-cart orphan on registration. LOW backlog (dead code, `SESSION_SECRET` unused, `withRateLimit`, `revalidatePath`-on-read) also unchanged — `SESSION_SECRET` still only in `.env.example`.

## 5. Verification evidence
- tsc 0 errors; eslint 0 issues; vitest 227/227 (12 files), 2.61s — re-verified this gate.
- No application files modified by this gate (read-only except this report).
- Next: Milestone 2 — homepage-agent (per frontend-agent foundation report).
