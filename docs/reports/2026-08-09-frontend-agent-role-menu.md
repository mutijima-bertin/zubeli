# Role-aware storefront header — OWNER sees "Admin panel" (2026-08-09)

**Agent:** frontend-agent · **Task:** role-aware menu per user requirement "every user must see the dashboard according to his role"

## Root cause (verified)
`src/app/(store)/layout.tsx` stripped `role` when building the Header user object (`{ id, name, email }`), so AccountMenu/MobileMenu could only ever render the customer links. `getSession()` already returns the full `User` entity incl. `role` (`Role` enum = `CUSTOMER | OWNER` in prisma/schema.prisma) — auth untouched.

## Changes (all 4 allowed files)
- **src/app/(store)/layout.tsx** — `user` now passes `role: session.role` (inline object literal, no type imports).
- **src/components/storefront/Header.tsx** — user prop widened to `{ id, name, email; role: "OWNER" | "CUSTOMER" } | null` (inline, per convention); `accountUser` forwards `role`.
- **src/components/storefront/AccountMenu.tsx** — `AccountMenuUser` gains `role?: "OWNER" | "CUSTOMER"`; `isOwner = user.role === "OWNER"` → dropdown shows **Admin panel** (`href="/admin"`, title + description "Manage products, orders & stock") FIRST; "My account" + "Order history" hidden for OWNER; "Sign out" kept. CUSTOMER/undefined-role/guest views byte-identical.
- **src/components/storefront/MobileMenu.tsx** — same rule (prop type already `AccountMenuUser`, gained `role` automatically): OWNER → "Admin panel" link, no customer links; CUSTOMER/guest unchanged.

## Rendered difference
- **OWNER** (e.g. owner@zubeli.rw): name dropdown → `Admin panel` (desc: Manage products, orders & stock) + `Sign out`. Mobile drawer: same two entries. No customer links.
- **CUSTOMER** (umutoni@demo.rw): unchanged → `My account` + `Order history` + `Sign out`. Mobile unchanged.
- **guest**: unchanged → `Sign in` (desktop) / `Sign in` + `Create account` (mobile).

## Verification
- `npx tsc --noEmit` → exit 0 (0 errors).
- `npx eslint` on the 4 touched files → 0 problems.
- `npm run lint` → 0 errors, 2 warnings = known e2e warnings only (CatalogPage Locator, account.spec DELIVERY_FEE_RWF).
- No route smoke per dispatch (runner owns checkpoints; port conflict with tmux dev server).

## Notes / next steps
- a11y pattern intact (aria-haspopup/expanded, click-outside, Esc, sr-only skip-link untouched).
- `/admin` guard already correct server-side (middleware + requireAdminOrThrow) — this is purely the entry-point link.
- e2e impact: none — no PO asserts on "My account"/"Order history" for owner sessions (owner suite logs in via storage state and drives /admin directly); customer suite logs in as umutoni (CUSTOMER) — menu unchanged for them.