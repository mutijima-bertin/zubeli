# Dashboard Agent Report — Notification bell in admin topbar

*Date: 2026-08-09 · Agent: `dashboard-agent` · Scope: `src/components/admin/AdminTopBar.tsx` only (no storefront or bell edits)*

## What was done
Wired the design-system `NotificationBell` (frontend-agent, verified) into the admin top bar, next to the Sign out button. Reuses the shipped component untouched: `import { NotificationBell } from "@/components/ui"`, single prop `userId`.

## Wiring point
- **File:** `src/components/admin/AdminTopBar.tsx` — import at line 4, render at line 39 (between the email chip and `<LogoutButton />`).
- **Data flow:** the admin layout (`src/app/admin/layout.tsx:35-45`) already guards the session (`getSession()` → non-OWNER `redirect("/")`) and passes the full `User` model into `<AdminTopBar user={user} />` — no layout change needed; **every render is an OWNER**, so the bell mounts unconditionally (its actions are role-agnostic/IDOR-scoped anyway).

## Visual placement
Right cluster order (all within the `flex h-14 items-center gap-2` header): `[hamburger] … [Storefront link] | [divider] | [email chip] [🔔 bell] [Sign out]`. The bell's own `size-11` (44px) button + badge keeps the 56px header rhythm; `gap-2` handles spacing with no class changes. The bell is **not** `hidden sm:*` — it stays visible on mobile (owner gets notifications on the phone; dropdown panel is `max-w-[calc(100vw-2rem)]` and right-anchored, so it fits).

## Verification evidence
- `npx tsc --noEmit` — clean (exit 0)
- `npm run lint` — 0 errors; 2 pre-existing known e2e warnings (`CatalogPage.ts`, `account.spec.ts`)
- Transient note: a `tsc` run during the check hit `KpiLink` errors — sales-agent's `/admin` overview rewrite was mid-write; its final state (all 5 KPI cards via `<StatCard href>` — the StatCard CTA work driving it) is on disk and the tree is green.
- No smoke: OWNER-session-only UI, deferred to `runner` (bell interaction e2e is runner's, per frontend-agent report).

## Next steps
`runner` checkpoint: admin bell e2e (badge count via seed notifications, mark-read navigation, mark-all); quality gate on the dashboard surface.