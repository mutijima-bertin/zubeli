# 2026-10-05 — checkout-agent — payment-picker a11y

Fixed the two MEDIUM findings from `docs/reports/2026-10-05-quality-agent-accessibility-review.md` (§11, §12). Scope: `src/app/(store)/checkout/**` only.

**What was done.** `PaymentMethodPicker.tsx` now derives ids from `useId()`: `instructionId(method) = "<base>-instruction-<METHOD>"` and `paymentMethodErrorId = "<base>-error"`.
- (a) Instruction association: each radio gets `aria-describedby={checked ? instructionId(option.method) : undefined}`; the MoMo `<p>`/bank `<div>` render with that id only when checked, so the association applies **only to the SELECTED method**.
- (b) Group error: `<fieldset aria-describedby={errors.paymentMethod ? paymentMethodErrorId : undefined}>`; the error `<p id={paymentMethodErrorId} role="alert">` keeps its live announcement.

**Exact id/aria-describedby pairs.** COD_CASH → no instruction block, no describedby. COD_MOBILE_MONEY (checked) → radio `aria-describedby="<base>-instruction-COD_MOBILE_MONEY"`, `<p id="<base>-instruction-COD_MOBILE_MONEY">`. BANK_TRANSFER (checked) → radio `aria-describedby="<base>-instruction-BANK_TRANSFER"`, `<div id="<base>-instruction-BANK_TRANSFER">`. Error present → fieldset `aria-describedby="<base>-error"`, `<p id="<base>-error" role="alert">`. When a method is not checked/absent from the allowlist, or the error is absent, **neither the id nor the describedby is emitted — no dangling reference**; the `[instruction].filter(Boolean).join(" ")` build leaves room to append existing descriptions rather than overwrite.

**Not changed:** `allowedMethods`/`COD_CASH` default/filtering and `CheckoutFlow.tsx` stale-selection clearing (per brief). No shared `components/ui`, `lib`, or other-screen edits.

**Verification (verbatim):** `npx tsc --noEmit` → exit 0, no output · `npm run lint` → exit 0, no output. `git status --porcelain` → only the pre-existing uncommitted wave plus this report; no stray files from me. Playwright/build/docker/tests intentionally not run per brief.

**File touched:** `src/app/(store)/checkout/_components/PaymentMethodPicker.tsx` (+ this report).
