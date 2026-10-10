# DevOps — Next.js security bump to 15.5.27

## What was done
- Bumped `next` from 15.5.22 → 15.5.27 (patch).
- Bumped `eslint-config-next` to 15.5.27 to keep version-matched with Next.js.
- Installed `react@19.1.0` and `react-dom@19.1.0` at exact pinned versions (no major jump).
- Ran full verification (tsc, lint, vitest, build). No config changes to `next.config.ts` were required.

## npm audit (before/after)
- Before (`npm audit --omit=dev`): **8 vulnerabilities (1 critical, 7 high)**
  - Critical: Next.js 15.5.22 (Image Optimization API AVIF RCE GHSA-2xp9-vwfh-vxw4, plus cache poisoning advisories). Also transitive deps affected (postcss, sharp).
  - High: deepmerge-ts (<8.0.0), nanoid (<3.3.18), postcss (<=8.5.22), sharp (<=0.35.5-rc.1), source-map-js (1.0.0-1.2.1), plus others in the tree.
- After (`npm audit --omit=dev`): **8 vulnerabilities (1 moderate, 7 high)**. The **critical Next.js advisory is remediated**.
- Remaining (with `--omit=dev`): high/moderate are largely transitive (deepmerge-ts via @prisma/config/prisma, nanoid, postcss/sharp/source-map-js via Next/sharp). `npm audit fix --force` would introduce semver-major changes (e.g. suggested prisma@6.12.0) which is not appropriate here. No override added; left as documented.
- Full audit: before 23 vulns (5 moderate, 17 high, 1 critical); after **23 vulns (6 moderate, 17 high)** — critical eliminated.

## Resolved versions
- next: 15.5.27
- react: 19.1.0 (deduped)
- react-dom: 19.1.0
- eslint-config-next: 15.5.27

## Verification results
- `npx tsc --noEmit`: **0 errors**
- `npm run lint`: **0 errors** (exit code 0)
- `npm test` (first run): **22 passed (22), 369 passed (369)**; **second run**: **22 passed (22), 369 passed (369)**. Duration ~10s both times.
- `npm run build` (webpack): **PASS**. Compiled successfully in ~29s. Route count: **27 routes total** (26 dynamic ƒ, 1 static ○ /_not-found). **13 dynamic `/admin/*`** routes (matching baseline). No route count difference from baseline.

## Notes
- `next.config.ts` unchanged — no config change required by this patch.
- No application source, tests, e2e, or Prisma schema touched (only package.json/package-lock.json).
- The critical RCE via Image Optimization API (AVIF) on Next 15.5.22 is **remediated** by upgrading to 15.5.27.

