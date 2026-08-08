import { chromium, expect } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { OWNER_EMAIL, OWNER_PASSWORD } from "./data";
import { LoginPage } from "./pages/LoginPage";

/**
 * Shared owner session (rate-limit friendly).
 *
 * The login action rate-limits to 10 attempts / 15 min per IP+email. A full
 * admin suite that signs in as the owner for every test blows through the
 * bucket (the dev server keeps the in-memory limiter for its whole life), so
 * the admin specs share ONE real owner login per RUN: e2e/global-setup.ts
 * calls `bootstrapOwnerSession()` BEFORE any spec runs, captures the session
 * cookie into test-results/.owner-session.json, and the admin specs replay it
 * via `test.use({ storageState: OWNER_SESSION_PATH })`. The file is therefore
 * guaranteed to exist by the time the first spec's context is created.
 * `admin-login.spec.ts` intentionally does NOT use it — it covers the real
 * login/guard journeys.
 */
export const OWNER_SESSION_PATH = resolve(
  process.cwd(),
  "test-results",
  ".owner-session.json",
);

// Mirrors playwright.config.ts (no import — keeps this module side-effect free).
const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/**
 * Perform the run's single real owner login and persist the session for the
 * admin specs. Runs from global-setup (runner main process — no fixtures, so
 * the browser is launched directly; the dev server is already up because
 * Playwright starts webServer before globalSetup).
 */
export async function bootstrapOwnerSession(): Promise<string> {
  // Sessions are DB-backed: a cookie from an earlier dev-server incarnation is
  // invalid after a restart. Always fresh-login and overwrite.
  if (existsSync(OWNER_SESSION_PATH)) rmSync(OWNER_SESSION_PATH, { force: true });
  mkdirSync(dirname(OWNER_SESSION_PATH), { recursive: true });

  const browser = await chromium.launch();
  try {
    // Explicit empty storage state: the login context must be cookie-clean.
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/login`);
    const login = new LoginPage(page);
    await login.signIn(OWNER_EMAIL, OWNER_PASSWORD);
    await expect(page).toHaveURL((url) => !url.pathname.startsWith("/login"));
    await context.storageState({ path: OWNER_SESSION_PATH });
    await context.close();
  } finally {
    await browser.close();
  }

  // Fail fast: the file must be a valid Playwright storage state holding the
  // session cookie — otherwise every admin spec would die with a confusing
  // ENOENT/empty-state error instead of this one.
  const state = JSON.parse(readFileSync(OWNER_SESSION_PATH, "utf8")) as {
    cookies: { name: string }[];
  };
  if (!state.cookies.some((c) => c.name === "zubeli_session")) {
    throw new Error(
      "[e2e] Owner bootstrap login succeeded but .owner-session.json lacks the zubeli_session cookie — aborting.",
    );
  }
  return OWNER_SESSION_PATH;
}
