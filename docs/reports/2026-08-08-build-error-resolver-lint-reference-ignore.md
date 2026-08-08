# Build Error Resolver — Lint: scope ESLint away from vendored reference material

*Date: 2026-08-08 · Agent: build-error-resolver*

## What was done
Fixed a mechanical lint failure: `npm run lint` failed with 15 `@typescript-eslint/no-require-imports` errors, all in untracked vendored reference scripts under `docs/reference/ui-ux-pro-max-skill/{brand,design-system}/scripts/*.cjs`. These are owner-installed skill materials, not app code.

## Files touched
- `eslint.config.mjs` (the ONLY file changed)

## Exact config diff
```diff
       "out/**",
       "build/**",
       "next-env.d.ts",
+      "docs/reference/**",
     ],
```

## Verification
- `npm run lint` → **exit 0**, exactly **2 problems (0 errors, 2 warnings)** — only the two known e2e warnings:
  - `e2e/pages/CatalogPage.ts:1:23` — unused `Locator` import
  - `e2e/specs/account.spec.ts:4:3` — unused `DELIVERY_FEE_RWF`
- The vendored `docs/reference/**` scripts no longer appear in lint output at all.
- `git status --short` confirms only `eslint.config.mjs` touched by this task (all other modified/untracked files pre-existed). Left uncommitted (no git add/commit/push — repo local-only).
- Did not touch `docs/reference/**`, `src/**`, `e2e/**`, dev servers, docker, or DBs.

## Next steps
Index this report in `docs/reports/README.md` is skipped — docs-writer own the index / orchestrator will handle it.