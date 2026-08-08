# 2026-08-08 — dashboard-agent: force-dynamic admin subtree (build noise fix)

## What was done
- Root cause: Turbopack attempted static generation of `/admin`, `/admin/products`, `/admin/stock` even though their server code calls `cookies()` via `getSession()` → repeated `Dynamic server usage ... could not be rendered statically` logged as `[zubeli] unexpected error in action` on every build (build still PASSed by falling back to ƒ).
- Fix: added `export const dynamic = "force-dynamic";` (with explanation comment) to `src/app/admin/layout.tsx` — declares the whole /admin subtree dynamic up front, so Next never attempts static generation. No per-page files needed: after the fix ZERO routes still throw (checked /admin, /admin/products, /admin/stock previously noisy).
- No storefront/actions/other files touched. Changes are uncommitted (scratch-pad status) — commit is not mine to make.

**Files touched:** `src/app/admin/layout.tsx` (only file; +5 lines)

## Verification evidence

| Check | Before | After |
|---|---|---|
| `grep -c DYNAMIC_SERVER_USAGE` in build log | 8 | **0** |
| `grep -c unexpected error in action` | 8 | **0** |
| `npx tsc --noEmit` | — | 0 errors |
| `npm run lint` | — | 0 errors (2 known e2e warnings) |
| `npm run build` (turbopack) | PASS, 23 routes (10 /admin/* ƒ) + 8 noise lines | **PASS, 23 routes (10 /admin/* ƒ), 0 noise lines**, Compiled in 8.8s |

Route table identical before/after — all 10 /admin/* routes remain ƒ (server-rendered on demand); no storefront page shape changed (22 ƒ + 1 ○ /_not-found).

Evidence files: `/tmp/opencode/build-before.log`, `/tmp/opencode/build-after.log`.

## Next steps
- Per-page `dynamic` exports NOT needed (0 remaining errors) — screen agents unaffected.
- Runner/quality-agent may re-run their checkpoint if they want a fresh green log; no app behavior changed (admin routes already ƒ at runtime).