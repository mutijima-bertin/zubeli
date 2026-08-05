---
name: tdd-workflow
description: "Use when writing or modifying any logic, action, helper, or component in zubeli. Covers test-first discipline: RED/GREEN/REFACTOR, what to test, coverage targets, and evidence reports."
---

# TDD Workflow

Test-first discipline for zubeli. Backend logic, server actions, price/cart/stock math, and critical UI components must be written test-first.

## When to use
- Any new function, server action, Prisma query wrapper, or cart/pricing/stock computation.
- Bug fixes: write a failing regression test first, then fix.
- UI work for critical components (cart summary, checkout totals, admin forms).

## Core rules
- RED → GREEN → REFACTOR. Write the failing test, see it fail, then implement the minimum to pass, then clean up.
- Run the focused test file, not the whole suite: `npx vitest run src/lib/cart.test.ts`.
- Use Vitest (unit/integration) + Playwright (e2e, see e2e-testing).
- What to test:
  - Server actions (call them directly, mock Prisma via `vi.mock` or use a test DB).
  - Pure helpers: cart totals, discounts, stock decrement logic, formatting.
  - DB queries through repository functions, not raw Prisma in tests.
- Cover the happy path plus edge cases: empty cart, zero stock, quantity over stock, currency rounding.
- Coverage target: >= 80% on `src/lib`, `src/app/**/actions.ts`, `src/components/cart` (report via `npx vitest run --coverage`).
- Keep tests isolated: no shared mutable state between tests; reset DB or mock per test.
- Use realistic fixtures (construction tool products, real prices in the base currency).

## Test shape
```ts
// RED first — expect this to fail before implementing
it("rejects addToCart when quantity exceeds stock", async () => {
  await expect(addToCart({ productId, qty: 999 })).rejects.toThrow(/stock/);
});
```

## Evidence reports
- After each task, summarize in the PR/commit: tests written, pass/fail counts, coverage delta.
- If coverage drops below target, say so explicitly — don't bury it.

## When TDD is skipped
- Pure visual/styling tweaks (no logic) — still verify manually.
- One-off migrations, config, and seed data.
- If skipped, state why in the commit message.

## Do NOT
- Do NOT write implementation before the failing test for logic-bearing code.
- Do NOT delete or weaken tests to make the suite pass.
- Do NOT test implementation details (e.g., exact SQL, internal function names) — test behavior.
- Do NOT use `test.only`/`test.skip` in committed code.

## Related
- e2e-testing (browser journeys), backend-patterns (action structure), frontend-patterns (component tests), prisma-patterns (DB test setup).
