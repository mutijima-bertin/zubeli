---
name: repo-organization
description: "Use when tidying or organizing the zubeli repository: auditing structure, moving misplaced files, cleaning build artifacts, standardizing docs layout, .gitignore and README hygiene, and reporting a before/after. NEVER move or edit app source (src/*), prisma/*, or .opencode/* — those belong to their owners and must be delegated or reported instead."
---

# Repo Organization

Keep the zubeli directory clean, professional, and easy to navigate. A tidy repo is a trustworthy repo.

## When to use
- A cleanliness/organization audit has been requested, after a feature ships, or when the repo accumulates clutter (build output, stray notes, misplaced files).

## Audit checklist (do this FIRST, before touching anything)
1. `ls -la` the root; note anything unexpected (stray folders, generated blobs, duplicates).
2. Build artifacts present? `coverage/`, `playwright-report/`, `test-results/`, `.next/`, `*.tsbuildinfo` — these are gitignored and safe to delete.
3. Docs layout: `docs/` should hold `adr/`, `plans/`, `reports/`, and guides (RUNBOOK.md, SCREENS.md). Anything else → move or give it a home.
4. Stray user notes (e.g. a `moi/` folder) → preserve, relocate to `docs/notes/` (never delete the owner's notes).
5. Root hygiene: README is real (not boilerplate), `.env.example` documented, `.gitignore` covers `.env*`, lockfiles committed, no temp files (`*.tmp`, `~`, `.DS_Store`).
6. Conventions: `AGENTS.md` + `docs/SCREENS.md` at root, contracts intact, agent/skill files well-named.

## What you MAY touch
- `docs/*` (moving/relocating non-owned doc files), `README.md`, `.gitignore`, `.env.example` (formatting only), `public/*` (removing unused scaffold assets), stray/temp files at root, `e2e/`, `tests/` (relocating misplaced test support).

## What you MUST NOT touch (delegate instead)
- `src/**` — owned by backend-agent, frontend-agent, screen agents.
- `prisma/**` — owned by database-agent.
- `.opencode/**` + `opencode.json` — owned by the orchestrator.
- `docs/SCREENS.md`, `docs/adr/*`, `AGENTS.md` — owned by docs-writer (propose changes, docs-writer applies).

## Working rules
1. Read `AGENTS.md`, `docs/SCREENS.md`, and the `customize` boundaries above.
2. Audit → present a short tidy-plan (what moves, what is deleted, what is proposed) → then apply.
3. Destructive or uncertain moves: ASK first (never silently delete anything not gitignored).
4. After moving/deleting, verify nothing broke: `npx tsc --noEmit` and `npm run lint` must stay green.
5. Leave a report: `docs/reports/<date>-organizer-<slug>.md` with a before/after table.
6. If you find owned files that are messy, FILE a finding (orphan the owner) — do not fix them yourself.

## Do NOT
- Do not reorganize app source or Prisma schema — always delegate.
- Do not delete user notes, real data, or anything tracked by git without an explicit OK.
- Do not push, commit the repo, or create remotes while organizing.
- Do not rename agent/skill files or move `.opencode/*` without the orchestrator.

## Related
- git-workflow (history hygiene), docs-writer (applies doc changes), project-runner (verifies the app still runs after tidy-up).