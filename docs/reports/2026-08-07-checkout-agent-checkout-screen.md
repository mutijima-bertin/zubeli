# 2026-08-07 — checkout-agent — checkout-screen

**What was done:** Phase C-4 checkout flow — `/checkout` (shipping form + pluggable payment step + order summary + place-order) and `/checkout/success` (guarded confirmation). 10 files, all under `src/app/(store)/checkout/`.

**Files created:**
- `checkout/page.tsx` — server shell; passes `siteConfig` MoMo number + bank details as server props (never client-imported, plan risk #6); h1 + subtitle.
- `checkout/_components/`: `CheckoutFlow.tsx` (client container: form state, client mirror of checkoutSchema §R8, createOrderAction submit via useTransition, mount-time cart refresh for stale-cart guard, page-level Alert for non-field errors like OUT_OF_STOCK/"cart is empty"), `ShippingForm.tsx` (name/phone/email?/address/city? via FormField, autoComplete wired), `PaymentMethodPicker.tsx` (fieldset+sr-only legend, 3 radio cards; BANK_TRANSFER reveals bank details + required reference input; switching clears reference + its error), `PlaceOrderButton.tsx` (submit + pay-on-delivery reassurance), `OrderSummaryPanel.tsx` (useCart: line list + totals), `PaymentInstructionsPanel.tsx`, `SuccessScreen.tsx`, `fields.ts` (shared types + getFieldErrors).
- `checkout/success/page.tsx` — missing/empty/NOT_FOUND/VALIDATION `?order=` → `redirect('/')`; public `getCheckoutOrderAction` re-fetch (hard-refresh safe); success toast fired by CheckoutFlow pre-nav; CTAs continue browsing + view orders (if `getSession()`).

**Payment slot exposed:** `PAYMENT_OPTIONS` config in `PaymentMethodPicker.tsx` — add `MOMO_GATEWAY`/`CARD` entries there when the gateway contract lands; nothing else in the flow changes (form always submits `{paymentMethod, bankTransferReference}`; success renders provider `paymentInstructions`).

**Consumed foundations (no edits):** Button, Card/CardHeader/CardBody, FormField, Input, Badge, Alert, EmptyState, Skeleton, Price, Table, Toast (useToast), icons, cx, `@/lib/format` maps, `@/lib/hooks/useCart`. No new deps, no new actions, no test files.

**Verification:** `npx tsc --noEmit` clean; `npm run lint` clean (0 problems). Dev-server smoke deferred to runner Checkpoint 3.

**Missing-foundation requests:** none — everything needed existed.

**Notes for reviewers:** (1) bank-reference regex is a deliberate client mirror (duplicated, commented) per plan §R8 — server authoritative; (2) empty-cart and stale-cart-after-order edge handled via context refresh + EmptyState (no dead form); (3) success page redirects home for unknown ids rather than 404 — confirm this is the desired demo behavior; (4) `getCheckoutOrderAction` is intentionally public (Decision A) — any order id someone guesses renders their confirmation (PENDING only, no PII beyond order snapshot).
