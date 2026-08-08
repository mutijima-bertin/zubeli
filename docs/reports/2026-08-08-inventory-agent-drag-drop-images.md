# 2026-08-08 — inventory-agent: drag-and-drop product images

**What:** Replaced the manual URL textarea for product images with a drag-and-drop upload zone in the shared `ProductForm` (create + edit). External photo links are no longer needed.

**Files:** `src/app/admin/products/_components/ProductForm.tsx` only (field internals; action calls and submitted shape untouched).

**Behavior:** Drop zone = labeled keyboard-clickable button (aria-label "Add product images", dragenter/over/leave highlight with depth counter, drop handler). Files (JPG/PNG/WebP, multi) upload one-by-one via `fetch("/api/admin/upload")` with `FormData` field `file` (contract `UploadResult` from `src/types/api.ts`). Per-file spinner + filename in the zone while pending; `data.url` appended to the existing `imageUrls` state (MAX_IMAGES 8 enforced, overflow ignored + Alerted). Failure/overflow → Alert tone=danger with per-code copy (2 MB / type / session-expired / generic). Edit mode renders existing images as numbered thumbnail previews (`next/image`, same pattern as ProductManager; empty-url filtering) with "Remove image N" overlay buttons updating the identical array. Submit path unchanged (`imageUrls` trimmed + filtered), so `createProductAction`/`updateProductAction` untouched. No "paste URL" toggle (simpler = better per brief).

**Verification:**
- `npx tsc --noEmit` → 0; `npm run lint` → 0 errors (2 known e2e warnings only).
- Live smoke on :3000 via throwaway dev-DB owner session (runner-style, cleaned up after — session row + uploaded file deleted): `/admin/products/new` 200 with drop-zone markup; edit page 200 with preview `alt="Product image 1"` + `aria-label="Remove image 1"`; upload w/o session → 401 `{ok:false,error:{code:"UNAUTHORIZED"}}`; w/ session → `{ok:true,data:{url:"/uploads/products/<uuid>.png"}}`; file served 200.

**Backend note:** consumed the pre-locked `POST /api/admin/upload` contract as-is (route found on disk in parallel — matches: field `file`, same codes/envelope).

**Next:** e2e/tests for the upload flow belong to tdd-guide; node_modules untouched, zero new deps.