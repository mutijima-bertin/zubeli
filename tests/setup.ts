import "@testing-library/jest-dom/vitest";

// With `globals: true` in vitest.config.ts, @testing-library/react auto-cleans
// the DOM after each test (it registers its own afterEach when it detects a
// global afterEach hook). No explicit cleanup() call needed here.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Deterministic env for every test file (unit + integration).
 *
 * Why here and not vitest.config.ts:
 * - The Prisma client (src/lib/db.ts singleton) reads process.env.DATABASE_URL
 *   at instantiation; src/lib/site.ts, src/lib/auth/password.ts and
 *   src/lib/db/orders.ts read env at module scope. This file runs BEFORE any
 *   test-file import, so the values below are what those modules see.
 * - Vitest may or may not load .env/.env.local into process.env depending on
 *   version/config — force-set everything so tests never depend on that.
 *
 * Safety rule: tests must NEVER touch the dev DB (5434). DATABASE_URL is
 * pinned to the TEST_DATABASE_URL (5435) for every test, so even the app's
 * own prisma singleton resolves to the test DB.
 */

const root = process.cwd();

function parseEnvFile(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const value = match[2]!.trim();
    if (value.startsWith('"') && value.endsWith('"')) out[match[1]!] = value.slice(1, -1);
    else out[match[1]!] = value;
  }
  return out;
}

const dotEnv = { ...parseEnvFile(join(root, ".env")), ...parseEnvFile(join(root, ".env.local")) };

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? dotEnv.TEST_DATABASE_URL ?? "postgresql://zubeli:zubeli@localhost:5435/zubeli_test";

// Force-set AFTER any env file the runner may have loaded, so tests are
// deterministic regardless of .env/.env.local contents on this machine.
process.env.TEST_DATABASE_URL = TEST_DATABASE_URL;
process.env.DATABASE_URL = TEST_DATABASE_URL; // never the dev DB (5434)
process.env.BCRYPT_ROUNDS = "4"; // keep bcrypt fast in tests
process.env.DELIVERY_FEE_CENTS = "2000";
process.env.NEXT_PUBLIC_CURRENCY = "RWF";
process.env.SHOP_MOMO_NUMBER = "+250700000000";
process.env.BANK_TRANSFER_DETAILS = "Bank of Kigali—Zubeli Company Ltd—1001001001";
process.env.DEMO_MODE = "false";
// NODE_ENV is declared readonly by @types/node — cast to assign (Next sets
// the real value in app runtime; tests force "test" for deterministic env).
(process.env as { NODE_ENV?: string }).NODE_ENV = process.env.NODE_ENV ?? "test";
