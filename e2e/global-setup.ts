import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Global setup (owned by e2e-runner): point every child process at the TEST database and
 * bring it to a known, freshly seeded state before the suite runs.
 *
 * Prisma availability: the prisma CLI is installed by database-agent AFTER this harness
 * lands. Until it exists, the reset/seed steps are skipped with a warning so that
 * `playwright test --list` and config parsing work today (specs land in Phase 5).
 *
 * Why process.env wins: Prisma CLI and Next.js never override env vars already present in
 * process.env, so pinning DATABASE_URL here makes the test DB (5435) authoritative for the
 * whole run — the dev DB (5434) is never touched.
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

export default function globalSetup(): void {
  const envFile = loadLocalEnvFile();
  const testDatabaseUrl = envFile.TEST_DATABASE_URL ?? process.env.TEST_DATABASE_URL;
  if (!testDatabaseUrl) {
    throw new Error(
      "TEST_DATABASE_URL not found in .env.local (see .env.example) — required for e2e global setup."
    );
  }

  // Pin every process spawned from here to the TEST database (5435).
  process.env.DATABASE_URL = testDatabaseUrl;

  // Detect prisma WITHOUT `npx prisma` (npx would try a network install and hang when the
  // package is missing). Local bin presence is the deterministic check.
  const prismaBin = resolve(process.cwd(), "node_modules/.bin/prisma");
  if (!existsSync(prismaBin)) {
    console.warn(
      "[e2e global-setup] prisma CLI not installed yet (database-agent installs it) — " +
        "skipping test-DB reset + seed. Runs will start from whatever state the test DB is in " +
        "until prisma lands."
    );
    return;
  }

  console.log(`[e2e global-setup] Resetting + seeding test database: ${testDatabaseUrl}`);
  // Drop schema, reapply migrations, skip auto-seed (we seed explicitly to control ordering).
  execSync(`${prismaBin} migrate reset --force --skip-seed`, {
    stdio: "inherit",
    env: process.env,
  });
  // Seed via the configured prisma seed command (prisma/seed.ts, owned by database-agent).
  execSync(`${prismaBin} db seed`, { stdio: "inherit", env: process.env });
  console.log("[e2e global-setup] Test database reset + seeded.");
}
