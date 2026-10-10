# Dashboard Agent Report — StatCard whole-card CTA (`href`)

*Date: 2026-08-09 · Agent: `dashboard-agent` · Scope: `src/components/admin/StatCard.tsx` + `src/components/admin/icons.tsx` only*

## What was done
`StatCard` can now render as a whole-card CTA link. Overview/sales KPI cards become real anchors — `sales-agent` wires the pages next (`/admin/page.tsx` keeps its temporary `KpiLink` wrapper until then; unaffected by this change).

## New prop contract (exact TS signature)
```ts
export type StatCardProps = {
  title: string;
  value: string | number;          // unchanged
  format?: (value: string | number) => string;  // unchanged
  delta?: string;
  deltaTone?: "up" | "down" | "neutral";
  icon?: ReactNode;
  tone?: StatusTone;
  className?: string;
  href?: string;   // NEW — omit for a plain card
};
```
Data contract untouched; `format`/`value` semantics identical.

## Rendering approach
- `href` set → renders `<Link href>` (native anchor, `next/link`; no onClick). Card shell classes mirrored from the `Card` primitive exactly: `rounded-xl border border-stone-200 bg-white shadow-card p-5` + `group block`.
- Hover affordance: `hover:border-stone-300 hover:shadow-pop` (repo lift token, same as ProductCard) + `IconChevronRight` (new in `icons.tsx`, barrel-exported) that slides in from the left and goes `opacity-0 → 100` via `group-hover:*`; also revealed on `group-focus-visible:*` (keyboard parity). Chevron sits top-right in a flex row with the icon chip; `aria-hidden="true"`.
- Focus: mirrors repo convention — no custom ring classes (Button/shell rely on the global `:focus-visible` outline #b45309 in globals.css); added `focus-visible:border-brand-500` border shift (same pattern as storefront `CategoriesShowcase`).
- Reduced-motion users: global 0.01ms transition kill covers the chevron slide.

## A11y choice
Link `aria-label={`${title} — open ${href}`}` (e.g. "Low stock — open /admin/stock") — deterministic, self-maintaining, no verb-generation; visible value stays in the DOM. Chevron decorative.

## Backward compatibility
No `href` → rendering is byte-identical to today: same `Card` (`p-5` + className), same title/value/delta markup, same icon chip classes/order (`export *` barrel untouched beyond the new icon).

## Verification evidence
- `npx tsc --noEmit` — clean (exit 0)
- `npm run lint` — 0 errors; 2 pre-existing known e2e warnings (`CatalogPage.ts`, `account.spec.ts`)
- No route smoke: per fast-dispatch tier, deferred to `runner` (overview reachable only with an OWNER session); e2e surface unaffected (admin specs never assert the KpiLink wrapper and no-href markup is unchanged).

## Next steps
`sales-agent`: swap the `KpiLink` wrapper on `/admin` overview (Low stock → `/admin/stock`, Pending payments → `/admin/orders`) for `<StatCard href={...}>` + drop the `hover:border-brand-600` className hack; optionally add `href` to the /admin/sales KPI band later.