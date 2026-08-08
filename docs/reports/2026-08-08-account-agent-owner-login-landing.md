# 2026-08-08 — account-agent — Owner post-login landing fix

**Root cause:** `/login` sanitized `?next` to a blanket `DEFAULT_NEXT = "/account"` for everyone. An OWNER signing in without `?next` was pushed to `/account` (customer profile) instead of the dashboard.

**Change (login page + LoginForm only):** owner-aware destination rule — `role === "OWNER" && nextPath === "/account"` → `/admin`, else the sanitized `nextPath`. Explicit `?next` (e.g. middleware `/admin` → `/login?next=%2Fadmin`) still wins. Applied in both places:

- `src/app/(store)/login/_components/LoginForm.tsx` — client success handler uses `res.data.role` from `loginAction`'s `UserDTO` (role already in the DTO).
- `src/app/(store)/login/page.tsx` — already-signed-in visitor redirect: `getSession()` returns the Prisma `User` (has `role`), so the same rule applies when an OWNER revisits `/login`.

`sanitizeNextPath` untouched (F2 gate: auth routes rejected, bare pathnames only, anti open-redirect intact).

**Files touched:** `src/app/(store)/login/_components/LoginForm.tsx`, `src/app/(store)/login/page.tsx`.

**Evidence:** `npx tsc --noEmit` → 0 errors; `npm run lint` → 0 errors (2 known e2e warnings in `e2e/` files). Dev server live: `curl /login` → 200 (no UI sign-in per scope — full behavior at runner checkpoint).

**Reviewer focus:** owner with no `?next` → `/admin`; owner with `?next=/admin` (middleware) still honored; customer unchanged; signed-in OWNER revisiting `/login` server-redirects to `/admin`.
