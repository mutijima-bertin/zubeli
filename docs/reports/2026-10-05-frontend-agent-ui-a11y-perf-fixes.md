# frontend-agent — UI a11y/perf fixes (2026-10-05)

**Done**
1. **Placeholder contrast (MED a11y):** `placeholder:text-stone-400` → `placeholder:text-stone-500` in `src/components/ui/Input.tsx:10` and `src/components/ui/Textarea.tsx:17` (≈4.8:1 on white, AA). Grep confirms **zero** remaining in `src/components/ui/`.
2. **`formatRWF` perf (MED):** hoisted a single module-level `Intl.NumberFormat("en-RW")` in `src/lib/format.ts`; output byte-identical. `currency` only changes the appended suffix, so no keying needed. No sibling formatter needed changing.
3. **Dialog focus trap (MED a11y):** `src/components/ui/Dialog.tsx` effect only. (a) added a `focusout`→next-tick refocus so a disabled/loading control that drops focus to `<body>` is pulled back into the panel; Tab from outside also wraps in. (b) `Shift+Tab` from the first control **or the panel itself** now wraps to the last. Disabled fields excluded from the focusable query. `aria-modal`, Esc, restore-focus-on-close, and public props unchanged.

**Files touched:** `src/components/ui/Input.tsx`, `src/components/ui/Textarea.tsx`, `src/components/ui/Dialog.tsx`, `src/lib/format.ts`.

**Verification:** `npx tsc --noEmit` → 0 errors. `npm run lint` → 0 errors. `npx vitest run tests/unit/format.test.ts` → 13/13 pass (exact-string assertions incl. 12500→"12,500 RWF", 0→"0 RWF", -2500→"-2,500 RWF", 500 USD). Node before/after for 0/1234/1829600/-2500/1234567890/999/1000/12.9/NaN/Infinity → identical. `git status` on my 4 files → only those 4 modified, no strays. No snapshots/visual tests reference these components.

**Gap for orchestrator:** `src/components/storefront/SearchBox.tsx:34` still uses `placeholder:text-stone-400` — outside my allowed files, needs its owner.
