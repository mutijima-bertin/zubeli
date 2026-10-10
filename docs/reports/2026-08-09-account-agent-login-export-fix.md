# 2026-08-09 — account-agent — login-export-fix

## Change
Removed the invalid Next.js Page export in `src/app/(store)/login/page.tsx:30`:
`export function sanitizeNextPath(...)` → local `function sanitizeNextPath(...)`.

## Why
- Next's **webpack** build hard-fails on any unknown Page export ("does not match the
  required types of a Next.js Page"). Turbopack skips the check, so every prior
  checkpoint/CI (`npm run build` = turbopack) stayed green while the latent defect
  sat in the file since 338e388 (2026-08-07 F2 fix). Any webpack build switch goes red.
- Evidence for the chosen fix: grep shows `sanitizeNextPath` is used ONLY at
  `page.tsx:54` (same file). All other hits are comments/docs/reports — no importer
  exists, so no `src/lib/` move needed. Anti open-redirect + auth-route guards
  (F2 gate logic) unchanged.
- Zero other files touched.

## Verification
- `npx tsc --noEmit` → 0 errors
- `npx eslint src/app/(store)/login/page.tsx` → 0 errors
- (Full non-turbopack `next build` intentionally skipped per brief: slow/flaky
  turbopack ENOENT bug class, and a build writes `.next` under the running dev
  server; next runner checkpoint can prove formally if desired)

## Files
- `src/app/(store)/login/page.tsx` (one keyword removed — no behavior change)

## Reviewer focus
- Confirm no other file imports `sanitizeNextPath` (verified: none).
- Behavior identical: `/login` still renders form for guests, redirects
  signed-in users (OWNER → `/admin` unless explicit `?next`), open-redirect guards
  and auth-route rejection intact.