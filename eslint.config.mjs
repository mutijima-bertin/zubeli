import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Global ignores (standalone object => applies to every config in this array).
    // NEVER put real source here: these paths are generated artifacts, all gitignored.
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "docs/reference/**",
      // `npm run test:e2e` (Playwright) — the HTML report bundles MINIFIED JS, so linting
      // it produced 3028 problems / 254 errors right after any e2e run. Bug 2026-10-05.
      "playwright-report/**",
      "test-results/**",
      // Playwright blob reporter output (gitignored; not currently enabled in
      // playwright.config.ts — preventive, keeps lint green if it ever is).
      "blob-report/**",
      // `npm run test:coverage` (Vitest v8) — generated HTML/JSON reports.
      "coverage/**",
      // `npx tsc --noEmit` build info (gitignored via *.tsbuildinfo; mirrors the
      // next-env.d.ts precedent above).
      "*.tsbuildinfo",
      // `vercel link` / `vercel dev` local project linkage (see .gitignore).
      ".vercel/**",
    ],
  },
];

export default eslintConfig;
