# 2026-08-07 — account-agent — Account + auth screens (Phase C-5)

**What was done:** Built all 5 owned routes under `src/app/(store)/` + 10 files: `login/page.tsx` (sanitizes `?next` — starts-with-`/` + rejects `//`, `/\`, `\` — redirects signed-in users), `login/_components/LoginForm.tsx`, `register/page.tsx`, `register/_components/RegisterForm.tsx`, `account/page.tsx` (prefill from `getSession()`), `account/_components/ProfileForm.tsx` (email read-only; name+phone via `updateProfileAction`), `account/orders/page.tsx` (server shell → `getMyOrdersAction`, server-side empty + error states), `account/orders/_components/OrderHistoryTable.tsx` (mobile cards `sm:hidden` + desktop `Table`, cursor load-more via `PaginationLoadMore`, retryable error, sr-only count), `account/orders/[id]/page.tsx` (items table, totals, payment + `paymentInstructions`, address snapshot, IDOR-safe `notFound()`), `account/orders/[id]/_components/OrderTimeline.tsx` (PENDING→PAID→FULFILLED + CANCELLED/REFUNDED termini, text-not-color state).

**Files touched:** 10 created (listed above). No edits outside scope; no foundations edited; no new actions/deps/pages.

**Shared components consumed:** Button (loading), FormField/Input, Badge (+format.ts meta maps), Card family, Alert, EmptyState, Price, Table, PaginationLoadMore, IconCheck/IconArrowRight.

**Verification:** `npx tsc --noEmit` clean; `npm run lint` clean. No dev-server smoke (deferred to runner Checkpoint 3).

**Reviewer focus:** (1) `sanitizeNextPath` open-redirect logic (login/page.tsx, also exported); (2) redirect-when-authenticated on /login + /register (no session → middleware handles); (3) `getMyOrdersAction`/`getMyOrderAction` error mapping (NOT_AUTHORIZED → redirect, NOT_FOUND → notFound); (4) a11y: h1→h2→h3 hierarchy via CardHeader children, FormField labels + aria-invalid, timeline color-independent, focus rings kept on mobile card links; (5) mobile-first: order history = stacked cards <sm, table ≥sm; detail table scrolls horizontally.

**Notes:** `FormField` does not forward an `invalid` visual prop to Input (only `aria-invalid`) — red-border styling for errored fields is a foundation-level gap, not addressed here (error text + role=alert still meet AA). Refunded timeline has no DTO timestamp — renders without date.
