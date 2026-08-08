# 2026-08-07 — account-agent gate fix (F2: auth-route redirect loop)

## Finding
Milestone 3 quality gate MEDIUM F2: `sanitizeNextPath` allowed `?next=/login` /
`?next=/register`, so a signed-in visitor on `/login?next=/login` bounced
between the page and itself → ERR_TOO_MANY_REDIRECTS.

## What was done
- `src/app/(store)/login/page.tsx` (only file touched):
  - Added `AUTH_ROUTES = new Set(["/login", "/register"])`.
  - `sanitizeNextPath` now strips query/hash and trailing slashes to get the
    bare pathname (`/login`, `/login/`, `/login?next=…`, `/login//` all
    resolve) and falls back to `DEFAULT_NEXT` (`/account`) for any auth route.
  - All existing guards (protocol-relative `//`, `/\` backslash tricks,
    absolute URLs) unchanged; `/` and other same-origin relative paths still
    pass through.
- `register/page.tsx` checked: it has NO `?next` handling (signed-in visitors
  redirect straight to `/account`) — same pattern does not exist there, so no
  change needed.

## Verification
- `npx tsc --noEmit` → 0 errors
- `npm run lint` → 0 problems
- `npx vitest run` → 264/264 passed (15 files, 18.8s)

## Notes
- No tests/ edited (owned by tdd-guide). If desired, a follow-up unit test for
  `sanitizeNextPath` could assert `/login`, `/register`, `/login/`,
  `/login?x=1` → `/account` and `/account`, `/` → unchanged (currently no
  test covers this export).

## Next steps
F1 (FilterSidebar stone-400 chips) is queued with catalog-agent; then re-gate
→ Phase D e2e.
