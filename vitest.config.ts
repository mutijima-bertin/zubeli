import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig.json uses `"jsx": "preserve"` (required by Next.js), which leaves
  // JSX untransformed and breaks Vite's import analysis. Override it here so
  // .tsx components imported from src/ transform correctly under Vitest.
  // Vitest 4 (Vite 8) uses the oxc transformer — not esbuild — so set oxc.
  oxc: {
    jsx: { runtime: "automatic" },
  },
  resolve: {
    alias: {
      // Mirror tsconfig.json paths: "@/*" -> "./src/*"
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // globals: true so @testing-library/react auto-cleans after each test
    globals: true,
    // Node by default; components tests opt in per-file with:
    // `// @vitest-environment jsdom` at the top of the spec file
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // Thresholds intentionally NOT enforced yet — set once real tests exist.
    },
  },
});