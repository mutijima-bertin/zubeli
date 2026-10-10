# 2026-10-05 — dashboard-agent — admin shell a11y fixes

**Task:** Fix the two admin-shell findings from `2026-10-05-quality-agent-accessibility-review.md` (HIGH skip link; LOW mobile-nav landmark).

**Done:**
- `src/app/admin/layout.tsx:43-48` — added a "Skip to content" anchor as the FIRST focusable element in the shell (before `AdminSidebar`), SR-only until focused, exactly matching the storefront pattern (`storefront/Header.tsx:26-31`). `href="#main"` targets the existing `<main id="main">` at line 52 — pairing verified.
- `src/components/admin/MobileAdminNav.tsx:26` — mobile drawer's list now wrapped in `<nav aria-label="Admin">` (was a bare `<div>`), consistent with desktop `AdminSidebar.tsx:23`.

**No nested duplicate landmarks:** the desktop `<nav aria-label="Admin">` lives in `AdminSidebar`'s `hidden lg:flex` aside; when the mobile drawer Dialog is open the desktop nav is `display:none` (not in the a11y tree) and the Dialog only mounts while open — exactly one exposed `nav[aria-label="Admin"]` per breakpoint.

**Verification:** `npx tsc --noEmit` → 0 errors. `npm run lint` → 0 errors. Re-read both files: skip link is first focusable, `href="#main"` ↔ `<main id="main">`. `git status --porcelain`: no stray files added by this task (only the two allowed edits + this report; rest of the wave was already uncommitted).

**Not done / out of scope:** no automated axe run (no harness wired, and Playwright/build/docker/tests forbidden here). No icon dependency added.

**Next:** inventory-agent owns the other HIGH (per-row button names in CategoriesManager.tsx); dialog focus-trap items belong to frontend-agent.
