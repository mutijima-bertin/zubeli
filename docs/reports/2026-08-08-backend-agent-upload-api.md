# 2026-08-08 — backend-agent: guarded admin image-upload API

**Route:** `POST /api/admin/upload` — multipart field `file`, OWNER-only.

**Files:**
- NEW `src/app/api/admin/upload/route.ts` — handler: requireAdminOrThrow first (middleware never covers `/api/*`), content-length pre-check, native `request.formData()` (no busboy), size/type/sniff checks, lazy `mkdir` + `writeFile` under `public/uploads/products/`, `randomUUID().<mime-derived-ext>` filenames, no DB writes.
- NEW `src/lib/uploads.ts` — pure validation (2 MB cap, jpeg/png/webp allowlist, ext↔mime match, magic-byte sniff as defense-in-depth; note: MVP gate is content-type+extension per contract).
- EDIT `src/types/api.ts` — `ErrorCode` += `UPLOAD_FAILED | UPLOAD_TOO_LARGE | UPLOAD_TYPE_REJECTED | UNAUTHORIZED` (additive); exported `UploadResult = ActionResult<{ url: string }>` for the inventory screen.
- EDIT `.gitignore` — `/public/uploads/` (runtime user data; confirmed ignored via `git check-ignore`).

**Verify (evidence):** `npx tsc --noEmit` 0; `npm run lint` 0 err (2 known e2e warnings). Live curl smoke against dev server with a throwaway DB session (injected sha256 tokenHash, cleaned after):
- anonymous POST → 401 `{ok:false,error:{code:"UNAUTHORIZED"}}`; customer (non-OWNER) → 403 UNAUTHORIZED "Admin access required"
- valid 1×1 PNG → 200 `{ok:true,data:{url:"/uploads/products/<uuid>.png"}}`; file on disk; GET of that URL → 200 `image/png`
- 3 MB file → 413 UPLOAD_TOO_LARGE; SVG bytes named `.png` (image/png) → 415 (sniff); PNG bytes named `.jpg` (image/jpeg) → 415 (sniff); real `.svg` → 415; missing `file` field → 400 UPLOAD_FAILED

**Notes for security-reviewer:** auth contract maps `NOT_AUTHORIZED` → `UNAUTHORIZED` (fixed response code) with real 401/403 statuses; rename or delete of pre-existing `public/uploads/products/*` files (e.g. purging demo images) is out of scope; no rate limit — OWNER-only surface; file serving relies on Next public/ static content-types (correct by extension, safe against SVG-as-PNG).