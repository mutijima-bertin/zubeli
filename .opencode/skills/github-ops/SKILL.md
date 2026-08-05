---
name: github-ops
description: "Use when doing GitHub operations via gh CLI: creating/reviewing/merging PRs, triaging issues, managing branch protection, writing or debugging GitHub Actions workflows (triggers, jobs, steps, caches, artifacts, secrets), and creating releases."
---

# GitHub Ops

## When to use
Use whenever work touches the zubeli GitHub repository: PRs, issues, CI/CD
workflows, branch protection, or releases. Prefer the `gh` CLI over the web UI
for scriptable, reproducible operations.

## Core rules
- Run `gh repo set-default` once, then use `gh pr create --fill`, `gh pr view`,
  `gh pr merge`, `gh issue list/create/close`, `gh release create`.
- Never merge before CI is green and at least one review approved (unless
  explicitly overridden).
- PR flow: `git checkout -b feat/...` -> push -> `gh pr create --draft` ->
  iterate -> mark ready -> request review -> merge with `--squash --delete-branch`.
- Triage issues with `gh issue label` and templates; route bugs vs features;
  close duplicates with a comment link.
- Branch protection: main requires PR, 1 approval, status checks
  (`lint`, `typecheck`, `test`), no direct pushes, linear history.
- Actions: triggers are `on: [push, pull_request]`; jobs run in parallel by
  default — use `needs` for dependencies and `concurrency` to cancel stale runs.
- Cache `node_modules`/Next.js build cache; upload logs/tests via
  `actions/upload-artifact` on failure.
- Secrets: reference as `${{ secrets.XXX }}`; never inline values.

## Minimal Next.js CI (lint + typecheck + test)
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
```

## Do NOT
- Do not merge without CI passing or bypass branch protection (`gh pr merge --admin`).
- Do not create PRs from `main` into feature branches.
- Do not commit secrets in workflows or push `.env` to the repo.
- Do not write one giant workflow when split jobs are clearer.

## Related
`git-workflow` (commits/branches feeding PRs), `performance-patterns`
(CI perf: caching, build-time budgets).
