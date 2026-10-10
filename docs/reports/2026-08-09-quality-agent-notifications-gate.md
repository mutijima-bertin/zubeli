# Quality gate — Notifications + admin-CTA wave (2026-08-09)

**Gate owner:** quality-agent · **Date:** 2026-08-09 · **Verdict: PASS-WITH-BACKLOG**

Scope: Notification model/enum/migration, `src/lib/notifications.ts` fail-soft helpers, `src/actions/notifications.ts` (4 actions), event wiring (checkout NEW_ORDER/PAYMENT_REVIEW, admin order ORDER_STATUS, admin stock/products LOW_STOCK), `paymentMethodLabel()`, `NotificationDTO`, `NotificationBell` + Header/AdminTopBar wiring, `StatCard` href CTA + overview KPI cards.

## How this gate ran
Reviewer suite commissioned (backend, security, frontend, database, uiux, accessibility, code). Note: this runtime session exposes no child-spawn task tool, so the suite was executed **inline as discrete specialist passes** with each discipline's checklist, not as spawned sub-agents; findings below are aggregated by severity as if from the suite. No reviewer rubber-stamping — every focus area was independently verified (code + tests + static evidence).

## Baseline (independent, run by gate)
- `npx tsc --noEmit` → **0 errors** · `npm run lint` → **0 errors** (2 known pre-existing e2e warnings)
- `npx vitest run` → **321/321 pass (19 files)** — includes +30 new: notifications.test.ts (10), notifications-wiring.test.ts (18 listed, file total)
- `npx prisma migrate status` → **up to date (3 migrations), zero drift**
- Live smoke: `curl :3000` → no server up (runner holds the port for its parallel e2e checkpoint; no server was started by the gate to avoid the 2026-08-08 dev-DB contamination incident — runtime verification deferred to runner)

## Focus-area results (all PASS)
| Focus | Evidence |
|---|---|
| IDOR (mark-read/mark-all/list/count) | Every action `requireUser` first; scoped where `{userId}`; mark-read `updateMany {id, userId}` count-0 → NOT_FOUND; asserted in tests (wiring lines 396–410) |
| Fail-soft guarantees | `notifyUser/notifyOwners/notifyOrderCustomer` swallow + log; wiring awaits AFTER business logic + revalidate; tests assert `ok:true` survives create/lookup failure |
| Guest-skip | `notifyOrderCustomer` early-returns on `customerId:null`; test asserts zero `notification.create` calls (wiring:310–315) |
| Badge/poll safety | userId-scoped server-side reads (prop only gates mount); 25s interval + focus/visibility refetch with full cleanup on unmount (clearInterval + removeEventListener); fail-soft on every fetch; optimistic mark-read reconciles on failure |
| Bell a11y | Button `aria-haspopup/aria-expanded`, toggle label `Notifications (N unread)`, Esc + pointerdown-outside close, global `:focus-visible` ring (globals.css brand-700 5.02:1), badge cta-600 + text-ink-dark (5.4:1 per audit #1), reduced-motion covered globally; panel max-w mobile-safe |
| StatCard CTA | Whole card = one native `next/link` (no nested interactive; icon chip `aria-hidden`), accessible name overrides visible text, chevron group-hover/focus-visible + global focus ring |
| **E2E impact (selector sweep)** | Static query of all specs/POs: `getByLabel` inventory = Full name/Phone/Email/Password/Name/Slug/Category/Price (RWF)/Initial stock/Search products/Action/Reason/Quantity/From/To — **nothing substrings "Notifications"/"unread"/"Mark all"**; admin KPI text queries are `exact:true` and/or scoped `main#main`; sidebar links use `getByRole('link', {name, exact:true})` so `Orders — open /admin/orders` does not collide; admin-login KPI loop already scoped to `main#main` — **no PO change needed** |

## Findings
- **CRITICAL: 0**
- **HIGH: 0**
- **MEDIUM: 0**
- **LOW — backlog (6):**
  - L1 — `NotificationBell.tsx:140–150` badge count changes are never live-announced (no `aria-live`); `aria-haspopup="true"` is the ARIA-1.1 token (1.2 prefers menu/dialog) — enhancement, consistent with AccountMenu
  - L2 — `src/actions/admin/stock.ts:36–44` LOW_STOCK fires on EVERY adjustment whose resulting qty ≤ threshold (no dedupe/cooldown while restocking)
  - L3 — LOW_STOCK title/body copy duplicated `stock.ts:38–43` vs `products.ts:60–66` (extract to `lib/notifications.ts`)
  - L4 — `src/lib/notifications.ts:58–60` `notifyOrderOwners` ignores its `order` arg (dead param; doc block overpromises)
  - L5 — Notification table append-only, no retention/pruning (`prisma/schema.prisma:258–271`) — add prune job at hosting milestone
  - L6 — notification actions unrate-limited (informational — follows the codebase's selective pattern (login/register/checkout); own-row reads only, no amplification)

## Fixes dispatched
**None.** 0 CRITICAL/HIGH → no owners tasked. Verified by re-running tsc/lint/vitest after review (no code changed by gate).

## Verdict
**PASS-WITH-BACKLOG** — baseline green (tsc 0 / lint 0 / 321·321), migration clean, zero CRITICAL/HIGH findings, 6 LOW backlog items tracked above (same discipline as the Milestone 3/5 gates). E2E-suite impact: statically verified collision-free; the runner's parallel Phase-F checkpoint is the runtime confirmation.