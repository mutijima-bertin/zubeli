/**
 * Vitest stub for the `server-only` marker package (React).
 *
 * The real package resolves its THROWING entry under Vite 8's
 * vite-node resolution (the "react-server" export condition is not
 * honored under configLoader native), which makes every src/lib module
 * that imports 'server-only' fail to load in tests. The alias in
 * vitest.config.ts points the package name at this empty module so test
 * imports load normally.
 *
 * Nothing is exported on purpose — production modules only use
 * `import 'server-only'` as a side-effect guard.
 */
export {};
