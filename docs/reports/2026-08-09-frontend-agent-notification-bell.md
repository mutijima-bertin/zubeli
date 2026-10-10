# 2026-08-09 frontend-agent — Notification bell

## What was done
- **`src/components/ui/NotificationBell.tsx` (NEW, design system)** — client component for the notification bell (unread badge + dropdown panel). Props: `{ userId: string }` (mount gate only — actions read the session server-side). Contract: `src/actions/notifications.ts` ×4 (321/321 tests already green, untouched).
- **`src/components/ui/icons.tsx`** — `IconBell` added (lucide-style stroke, matches icon set; decorative `aria-hidden`).
- **`src/components/ui/index.ts`** — barrel export added (alphabetical).
- **`src/components/storefront/Header.tsx`** — `{user && <NotificationBell userId={user.id} />}` between SearchBox and AccountMenu (all breakpoints; no MobileMenu change).

## Behavior
- Badge: hidden at 0, `bg-cta-600 text-ink-dark` pill (shape = CartBadge, h-5 min-w-5 rounded-full text-xs font-bold), cap `9+`. NOTE: brief suggested white-on-cta-600, but tailwind.config.ts pins ink-dark-on-cta600 = 5.4:1 AA vs white 3.1:1 (pro-max audit #1) — kept the cta-600 pill with ink-dark text.
- Freshness: count on mount → poll 25s → window focus + visibilitychange; panel list refetches on open, on poll tick while open, and after local mutations (mark read / mark all — optimistic + reconcile on failure via refetch).
- Rows: Link (`link ?? '/account'`), unread = font-semibold + cta-600 dot (weight + dot, never color-only), body text-xs; row click marks read fire-and-forget (`.catch` fail-soft, no unhandled rejections — avoids the L1 backlog pattern) then navigates natively.
- Footer "Mark all read" (only when items exist); empty state "No notifications yet"; not-yet-loaded shows 2 Skeleton rows.
- a11y: `aria-label="Notifications (N unread)"` (blank when 0), `aria-haspopup="true"`, `aria-expanded`, Esc + pointerdown-outside close (exact AccountMenu useEffect pattern), global `:focus-visible` ring, ul/li semantics, button 44px touch target. FAIL-SOFT everywhere — `{ok:false}` keeps previous state, never crashes header.

## Verification evidence
- `npx tsc --noEmit` → 0 errors
- `npm run lint` → 0 errors, 2 known e2e warnings (untouched)
- Read-only smoke on :3000 (tmux): `/` 200, `/login` 200; guest SSR contains **0** bell markers (renders only when user present); `aria-haspopup` match on guest page = CategoryDropdown. Bell is client-side — full interaction e2e is runner's.

## Note for dashboard-agent
Reuse in admin topbar: `import { NotificationBell } from "@/components/ui"` then `<NotificationBell userId={sessionUser.id} />` — zero prop changes; heights/touch targets match the storefront header. It auto-polls and handles both roles (actions are role-agnostic, IDOR-scoped).

## Next steps
- runner/quality gate: e2e for bell (badge, mark-read navigation, mark-all) + admin topbar wiring per dashboard-agent.