import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Zubeli — Playwright e2e configuration (owned by e2e-runner).
 *
 * Database strategy (single shared seeded DB):
 * - Specs run against the DEDICATED test Postgres (docker: zubeli-postgres-test, port 5435,
 *   db zubeli_test) — never the dev DB (5434) nor production.
 * - e2e/global-setup.ts resets + reseeds the test DB once per run (`prisma migrate reset` +
 *   `prisma db seed`); until the prisma CLI lands it logs a warning and skips.
 * - fullyParallel: false — the seeded DB is a shared mutable fixture; specs are written
 *   serial-per-file (journey order matters) and must not run in parallel across files.
 * - workers: 1 — a single worker guarantees no two specs touch shared records (orders, stock,
 *   customers) at the same time. Parallelism can be revisited later once specs are fully
 *   isolated with unique per-test fixtures.
 *
 * Base URL: config var E2E_BASE_URL (default http://localhost:3000) — never hardcode
 * localhost-only paths inside specs; specs use relative URLs.
 */

/** Minimal .env.local loader (gitignored, not committed). Kept local to this file — no dotenv dep. */
function loadLocalEnvFile(): Record<string, string> {
  const env: Record<string, string> = {};
  const file = resolve(process.cwd(), ".env.local");
  if (!existsSync(file)) return env;
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const envFile = loadLocalEnvFile();

// The dev server for e2e runs against the TEST DB (5435), not the dev DB (5434).
// Next.js never overrides env vars already present in process.env, so this wins over .env.local.
const testDatabaseUrl = envFile.TEST_DATABASE_URL ?? process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL not found — set it in .env.local (see .env.example) or export it in the shell."
  );
}

const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: "./e2e/global-setup.ts",

  // Shared seeded DB — see header comment for why serial + single worker.
  fullyParallel: false,
  workers: 1,

  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  use: {
    baseURL: baseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "en",
  },

  webServer: {
    command: "npm run dev",
    url: baseUrl,
    reuseExistingServer: true,
    timeout: 120_000, // generous: cold Next dev boot + prisma client gen
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
