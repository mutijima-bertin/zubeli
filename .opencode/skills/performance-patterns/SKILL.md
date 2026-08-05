---
name: performance-patterns
description: "Use when optimizing or reviewing web performance for the Next.js storefront and dashboard: Core Web Vitals targets, bundle budgets, code splitting, next/image, caching layers, client JS minimization, list virtualization, and Lighthouse auditing."
---

# Performance Patterns

## When to use
Use when implementing pages, lists, images, or API routes that could affect
load time or interactivity, and when auditing the app with Lighthouse.

## Core rules
- Core Web Vitals targets (mobile): LCP < 2.5s, INP < 200ms, CLS < 0.1.
  Test on a throttled network with Lighthouse CI; set budgets in CI.
- Bundle budget: total JS <= 170KB gzipped per page; track with
  `@next/bundle-analyzer` or Lighthouse `unused-javascript`.
- Code splitting: keep route chunks small — lazy-load charts, date pickers,
  and dashboard widgets (`next/dynamic`); never bundle a chart lib on storefront pages.
- Images: always `next/image` with `sizes`, `priority` on LCP image,
  correct `quality`, width/height set to prevent CLS; serve WebP/AVIF.
- Client JS minimization: prefer Server Components; keep interactivity in
  isolated client islands; avoid heavy libs (moment, lodash) — use native APIs.
- Caching layers (order): CDN edge (static assets, public pages) ->
  Next.js data cache (`revalidate`, `fetch` caching) -> browser cache
  (`Cache-Control` on assets). Use `router cache` semantics consistently.
- Long lists/tables (dashboard orders, inventory): virtualize
  (`react-window`, TanStack Virtual); paginate instead of rendering thousands of rows.
- DB efficiency: index query columns, avoid N+1 with `prisma` `include`
  in one query; batch inserts for order items; limit/skip on list endpoints.
- Audit flow: `npm run build` -> Lighthouse on prod-like build -> fix the
  worst metric -> re-audit. Track perf in CI to prevent regressions.

## Do NOT
- Do not ship hydration-heavy components server-rendered in the storefront.
- Do not use `<img>` for product photos or unoptimized hero images.
- Do not fetch full tables client-side when pagination/virtualization fits.
- Do not ignore CLS from late-loading banners or fonts (preload fonts, reserve space).

## Related
`seo` (perf affects ranking), `ui-design-principles` (skeleton loading states),
`github-ops` (CI Lighthouse budgets).
