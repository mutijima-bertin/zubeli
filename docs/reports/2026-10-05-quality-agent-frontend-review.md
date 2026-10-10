# Frontend/React Review — category CRUD + Vercel wave (2026-10-05)

Reviewer: quality-agent (frontend-review child). Scope: new /admin/categories screens, product-screen category-source change, sidebar nav, checkout payment picker, storefront category filtering. READ-ONLY.
Verification: `npx tsc --noEmit` 0 · `npm run lint` 0 · `npx vitest run tests/integration/admin-categories.test.ts` 17/17 · zod v4 `.flatten().fieldErrors` confirmed.

Verdicts — boundaries: CLEAN (category pages server-only; only forms/managers `"use client"`; db types via `import type` — CategoryForm.tsx:8, CategoriesManager.tsx:20). Hydration: CLEAN (deterministic initial state, pure slug derive, timezone-pinned dates). Caching: CLEAN — highest-value item; no `unstable_cache`/`force-cache`/`generateStaticParams`; (store) layout reads cookies → dynamic (layout.tsx:24-25); `listAll` filters `isActive:true` in WHERE (categories.ts:64); all storefront consumers go through it (layout.tsx:28, storefront.ts:50, storefront.ts:108); `revalidatePath` present (actions.categories.ts:33-38). Form pattern: mirrors ProductForm (CategoryForm.tsx:69-105). Reuse: DataTable/FilterBar/Dialog reused. Payload: `details.fieldErrors` matches `toActionResult` (errors.ts:99-107). isActive type: required boolean, all 3 pages map it; tsc 0. Performance: one `listCategoriesForAdmin()` per render, rowKey=id.

Findings:
- MEDIUM — `CategoryForm.tsx:81-85,41-42` — on edit, clearing Slug = "leave unchanged", but local `slug` state never re-syncs from the refreshed `initial` after a successful save → field stays blank while DB keeps the old slug (misleading URL preview). Owning: inventory-agent. Fix: `setSlug(res.data.slug)` (and re-sync name/description/isActive) on success.
- LOW — `page.tsx:2` / `new/page.tsx:2` / `[id]/edit/page.tsx:3` — admin screens import `@/lib/db/categories` directly, bypassing the server-action layer the sibling product screens use (contract rule 3). Deliberate/documented, but inconsistent. Owning: inventory-agent + backend-agent (add a list/get action).
- LOW — `CategoryForm.tsx:60` — local slug pre-check omits server's min-length 2 (`validation/category.ts:32`); a 1-char slug round-trips before failing. Owning: inventory-agent.
- LOW — `CategoriesManager.tsx:271` — deactivate confirm button `loading={isPending}` but `runToggle` isn't in a transition → no spinner; use `busyId === deactivateTarget.id`. Owning: inventory-agent.
- LOW — `CategoryOption` defined twice (ProductForm.tsx:33, ProductManager.tsx:28) and `getFieldErrors` three times (ProductForm.tsx:26, CategoryForm.tsx:14, checkout/fields.ts:36); extract shared helpers. Owning: frontend-agent/backend-agent.
- LOW — product pages repeat `categoryRows.map(...)` 3× (page.tsx:30, new/page.tsx:35, [id]/edit/page.tsx:31); extract `toCategoryOptions()`. Owning: inventory-agent.
- INFO — `CategoriesManager.tsx:160` date column uses `formatDate` in a client component: deterministic (timeZone `Africa/Kigali`, format.ts:47); en-GB renders "Sept" in both runtimes (e2e/admin-sales.spec.ts:57-61) → no hydration mismatch.

VERDICT: READY. No CRITICAL/HIGH. Blocking: none. Backlog: M1 + L1–L5 for inventory-agent.
