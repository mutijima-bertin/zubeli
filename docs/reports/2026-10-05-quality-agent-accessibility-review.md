# 2026-10-05 — accessibility-auditor — category CRUD + checkout payment wave

**Scope (WCAG 2.2 AA):** `/admin/categories` list + new/edit forms, category confirm dialogs, Categories nav entry, checkout `PaymentMethodPicker`/`CheckoutFlow`. Read-only.
**Method:** source + Tailwind token analysis; no dev server on :3100 and no axe CLI/test harness wired (axe-core is only a transitive dep) → **automated axe pass NOT run**, all findings source-derived.
**Verdict:** NEEDS FIXES — no CRITICAL. HIGH: row-action buttons unnamed per row; admin shell has no skip-to-content link.

## Findings
- **HIGH** `src/components/admin/CategoriesManager.tsx:169-179` — per-row "Edit"/"Activate"/"Deactivate" buttons have no row-identifying name (only Delete :183 does) — SC 2.4.6 — inventory-agent.
- **HIGH** `src/app/admin/layout.tsx:46` — dashboard has `<main id="main">` but no skip link (storefront has one, Header.tsx:26) — SC 2.4.1 — dashboard-agent.
- **MED** `src/components/ui/Input.tsx:10`, `Textarea.tsx:17` — `placeholder:text-stone-400` #a8a29e ≈2.5:1 on white — SC 1.4.3 (labels present, so MED) — frontend-agent.
- **MED** `PaymentMethodPicker.tsx:162-213` — selected method instruction text not linked to its radio (no aria-describedby) — SC 1.3.1/3.3.2 — checkout-agent.
- **MED** `PaymentMethodPicker.tsx:219-223` — group `paymentMethod` error not associated to the `<fieldset>` — SC 3.3.1 — checkout-agent.
- **MED** `src/components/ui/Dialog.tsx:43-82` — focus lost when a dialog action becomes disabled (Button loading) and Shift+Tab from the initially-focused panel can escape the trap — SC 2.4.3 — frontend-agent.
- **LOW** `new/page.tsx:25`+`Card.tsx:32` h1→h3 skip; **LOW** `MobileAdminNav.tsx:25-29` drawer list lacks `<nav>`; **LOW** background not `inert` (relies on `aria-modal`); **INFO** server-rendered load `role=alert`s (:25,:31) may not announce on first paint.

**Passes:** native `<label>`s + required name + native checkbox toggle; real `<table>` with `th scope`; text+colour badges; associated field errors (`aria-describedby`+`role=alert`) and Toast live region; search `aria-label`; Categories nav `aria-current` + text label; 40px targets; `:focus-visible` ring.
**Files touched:** this report only.
**Next:** inventory-agent (row labels), dashboard-agent (skip link, Dialog focus), checkout-agent (picker associations), frontend-agent (placeholder contrast).
