---
name: git-workflow
description: "Use when committing, branching, rebasing, or writing git history in this repo: conventional commit messages, feature-branch strategy, merge vs rebase, PR etiquette, .gitignore and .env handling."
---

# Git Workflow

## When to use
Use for any git operation in the zubeli repo: making commits, starting
branches, cleaning history, or preparing a PR. Goal: a linear, readable
history where each commit is a small, logical unit.

## Core rules
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`,
  `test:`, `perf:`, `style:`. Use a scope: `feat(cart): add quantity stepper`.
- Imperative subject, lowercase, <= 72 chars; body explains the why, not the what.
- Branching: `main` is always deployable. Work on
  `feat/<slug>`, `fix/<slug>`, `chore/<slug>` branched from an up-to-date main.
- Small logical commits: one concern per commit; commit early and often,
  but never commit broken intermediate states.
- Sync your branch: `git fetch origin && git rebase origin/main` (rebase, not
  merge, to keep history linear). Resolve conflicts carefully, re-run tests.
- Before PR: self-review the diff, ensure CI passes, no stray debug code.
- Never push to main directly; PRs only, squash-merge.
- Secrets: never commit `.env*` — keep `.env.example` in the repo and add
  `.env`, `.env.local`, `.env.production` to `.gitignore`.

## Example .gitignore essentials
```
node_modules/
.next/
.env
.env.local
*.log
```

## Do NOT
- Do not use `git add -A` without reviewing what it stages.
- Do not commit secrets, generated files, or `.env` files (even "temporarily").
- Do not rewrite or force-push history on shared branches.
- Do not leave unrelated changes inside a commit (fix it with `git add -p`).

## Related
`github-ops` (PR/release lifecycle), `payment-integration`
(never commit payment keys/tokens).
