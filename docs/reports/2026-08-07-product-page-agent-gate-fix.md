# 2026-08-07 — product-page-agent — gate fix F3 (JSON-LD stored-XSS foot-gun)

**What was done:** Closed quality-gate finding F3 in `src/app/(store)/products/[slug]/page.tsx`. The Product schema.org JSON-LD was injected via `dangerouslySetInnerHTML` as raw `JSON.stringify(jsonLd)`; an admin-entered product field containing `</script>` would terminate the script block and enable stored-XSS. The serialized JSON is now HTML-escaped before injection:

```ts
const jsonLdHtml = JSON.stringify(jsonLd)
  .replace(/</g, "\\u003c")
  .replace(/>/g, "\\u003e")
  .replace(/&/g, "\\u0026");
```

`\u003c`/`\u003e`/`\u0026` are valid JSON-string escapes — the browser decodes them before the JSON parses, so the structured data stays valid while the block can no longer be broken out of. The script tag now uses `__html: jsonLdHtml`.

**Files touched:** `src/app/(store)/products/[slug]/page.tsx` (only file; jsonLd object unchanged, one new const + one JSX prop change).

**Verification evidence:**
- `npx tsc --noEmit` → exit 0, no errors
- `npm run lint` → 0 problems
- `npx vitest run` → 264/264 passed (15 files, 20.57s)
- Grep for `application/ld+json` / `dangerouslySetInnerHTML` / `jsonLd` in tests: no match — no test asserted the old raw output

**Next steps:** re-gate (quality-agent) to close F3; dispatch F1 (FilterSidebar chip contrast) + F2 (sanitizeNextPath auth-route redirect loop) if not already handled.