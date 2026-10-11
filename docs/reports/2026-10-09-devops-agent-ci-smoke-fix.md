# 2026-10-09 — devops-agent — CI "Production-config smoke" fix (local only)

## Root cause (reproduced, not guessed)
- **Not port fallback.** Reproduced CI's exact order locally: `npm run build` → e2e dev server (`npm run dev`, Turbopack) → `next start`.
- `next dev` **rewrites `.next/routes-manifest.json`** with its DEV shape (mtime updated; keys version/caseSensitive/basePath/rewrites/redirects/headers — **`dataRoutes` gone**; pristine build had it).
- `next start` then crashes **`[TypeError: routesManifest.dataRoutes is not iterable]`** and exits, so **:3100 never opens** → the first unguarded probe dies **`curl` exit 7** (run 38009658693). The old log was only `cat`-ed in the never-reached `/admin` branch → no diagnostics. Proof: with no dev run, `next start -p 3100` works even with :3000 occupied; immediately after the dev run it exits with the TypeError and `ss` shows no :3100.

## Fix — `.github/workflows/ci.yml` (only code file touched)
- **Reordered**: smoke now runs **right after `Production build`, before Playwright** — tests the pristine artifact, no second build. All 16 steps kept, still linear.
- **Hardened**: `env.PORT: "3100"` + `npx next start -p 3100` (never falls back to :3000); readiness loop that fails loudly if :3100 never opens or the server dies; a `trap` that on ANY non-zero exit prints `::error::… server log` + `cat "$LOG"` then kills it. Probes kept: health ok/db up, `/` 200, `/products` 200, guest `/admin` 307.

## Verification (evidence)
- Exact `run:` block **extracted from the YAML and executed** against a schema-only scratch DB with **:3000 occupied** → **exit 0**: `health: {"ok":true,"db":"up"}` · `GET / -> 200` · `GET /products -> 200` · `GET /admin -> 307`.
- Failure path (hid `.next`): exits 1 and dumps the real error into annotations. YAML parses (pyyaml + js-yaml); `migrate-production.yml` untouched.
- Actions (TASK 3): `checkout`/`setup-node`/`cache` **v4→v5**, `upload-artifact` **v4→v6** — verified via GitHub API + each `action.yml` (`using: node24`; **v5 upload-artifact is still node20**, hence v6); only the Node24 runtime differs for our standard usage. Files: `ci.yml` + this report (+ `/tmp/opencode` scripts). **No commit/push, no remote/secret.** Dev DB 5434 unchanged (all rows ≤2026-09-23): **43 products / 17 orders / 10 categories** — the brief's 42/15/10 is stale; scratch DB dropped, no orphan processes.

## Next steps
- Orchestrator: commit/push when approved. Keep any future `next start` smoke before Playwright (or re-run `next build`) — `npm run dev` mutates `.next`. `docs-writer`: index this report in `docs/reports/README.md`.
