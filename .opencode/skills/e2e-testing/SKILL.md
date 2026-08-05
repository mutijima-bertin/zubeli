---
name: e2e-testing
description: "Use when running or writing browser tests in zubeli. Covers Playwright setup, page-object model, critical journeys, DB reseeding for isolation, CI integration, and flaky test handling."
---

# E2E Testing

Playwright browser tests for the zubeli storefront and admin dashboard.

## When to use
- Writing or extending end-to-end tests; verifying critical user journeys; debugging flaky browser tests; wiring Playwright into CI.

## Core rules
- **Setup**: `@playwright/test` in `e2e/` with `playwright.config.ts`. Use the `webServer` option to boot the Next app against a dedicated test DB before tests run.
- **Page-object model**: every page/screen gets a class encapsulating selectors + actions.
  ```ts
  // e2e/pages/CartPage.ts
  export class CartPage {
    constructor(private page: Page) {}
    async goToCheckout() { await this.page.getByRole("button", { name: "Checkout" }).click(); }
  }
  ```
  Test files use PO methods only — no raw selectors scattered in specs.
- **Critical journeys** (each is a spec file):
  - Storefront: browse catalog → product page → add to cart → cart → checkout → order confirmation.
  - Customer account: register → login → view order history.
  - Admin: login as owner → product CRUD → inventory stock update → order status change → sales overview reflects it.
  - Auth guards: unauthenticated user is redirected away from `/admin/**` and `/account/**`.
- **Test isolation**: each spec runs against a freshly reseeded DB (`globalSetup` runs `prisma migrate reset --force` or `prisma db seed` against the test DB). Tests never share order state — use unique email/phone per test (timestamp suffix).
- Use realistic data: seeded construction tools, stable prices, known admin credentials (from env, not committed).
- Selectors: prefer roles, labels, and `data-testid` for complex widgets. No CSS-only selectors tied to Tailwind classes.
- **CI**: run on every PR: `npx playwright install --with-deps` then `npx playwright test` on a job with Postgres service container (see deployment-patterns). Shard by spec across workers; record traces on failure (`trace: "retain-on-failure"`).
- **Flaky handling**: run flaky specs with `--repeat-each=3` to reproduce; treat repeated flakes as real bugs (race conditions, missing `waitFor`, animation timing). Use `expect.poll`/`toPass` for async UI states instead of blind `waitForTimeout`. Never mark a flaky test as skipped without an issue tracking it.

## Do NOT
- Do NOT test implementation details (class names, DOM structure) — test user-visible behavior.
- Do NOT run e2e against the production database.
- Do NOT commit tests that depend on local-only state (cart contents from a previous run).
- Do NOT add `test.only` or generous timeouts to fix flakes.

## Related
- tdd-workflow (unit/integration below e2e), frontend-patterns (data-testid conventions), docker-patterns (Postgres test service), deployment-patterns (CI). Agents: orchestrator, uiux-reviewer, checkout-agent, dashboard-agent.
