# 2026-08-08 — account-agent — password toggle + auth pre-check (audit #13)

Audit item #13 (uiux-reviewer PRO-MAX, P2): password visibility toggle + client pre-check parity on login/register. Implemented inline per dispatch (no new foundation component).

**Files changed**
- `src/app/(store)/login/_components/PasswordField.tsx` (NEW): local password field re-implementing FormField's label/hint/error aria wiring (`useId`, `aria-invalid`, `aria-describedby`, `role="alert"`) with an inline show/hide toggle — real `<button type="button">`, sr-only name "Show password"/"Hide password", `aria-pressed`, 44px (`w-11 inset-y-0 right-0`), global focus-visible outline, inline SVG eye/eye-off (icons.tsx style, no emoji), input `pr-12`.
- `login/_components/LoginForm.tsx` — password FormField → PasswordField (autocomplete="current-password" kept); client pre-check: `loginSchema.safeParse` before `loginAction`, errors via same fieldErrors shape, merge order mirrors CheckoutFlow.
- `register/_components/RegisterForm.tsx` — password → PasswordField (hint kept) + new optional **Confirm** field (autocomplete="new-password" ×2); pre-check: `registerSchema.safeParse` + client-only `"Passwords don't match"` guard when confirm filled and ≠ password.

**Two deliberate deviations (empirically verified, see below)**
1. Toggle names via sr-only text, NOT `aria-label` — Playwright's label engine matches aria-label names: an aria-label="Show password" toggle makes `getByLabel("Password")` match 2 nodes ⇒ breaks LoginPage.fillCredentials / RegisterPage.register POs AND global-setup owner bootstrap (whole suite RED). Announced name identical (WCAG name-from-content).
2. Confirm label is "Confirm" (hint: "Re-enter the password you chose above to catch typos."), not "Confirm password" — same substring collision with `getByLabel("Password")`. If a literal "Confirm password" label is wanted, e2e POs must switch to `{ exact: true }` (1-line, e2e-runner).

**Server untouched** — actions + zod schemas unchanged; zod strips unknown `confirmPassword` key (verified). Field names/labels/autocomplete/submit labels identical; e2e label-driven flows safe (verified via Playwright: label collisions counted 1 match).

**Verification**: `npx tsc --noEmit` → 0; `npx eslint` on my 5 files → 0; live :3001 /login + /register 200 — HTML contains toggle (sr-only text, aria-pressed, pr-12 input, autocomplete kept) + Confirm field. No other files touched (working tree has other agents' in-flight work, untouched).