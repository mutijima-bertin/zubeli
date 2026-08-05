---
name: seo
description: "Use when implementing or reviewing technical SEO for the Next.js storefront: metadata API, sitemap.ts and robots.ts, canonical URLs, JSON-LD structured data, Open Graph/Twitter cards, product copy keywords, and heading hierarchy."
---

# SEO

## When to use
Use when building pages that must rank and share well: product pages,
categories, the home page, and any public-facing storefront route.

## Core rules
- Every public page sets metadata via the Next.js Metadata API:
  `title` (unique, <= 60 chars), `description` (<= 160 chars), `alternates.canonical`,
  `openGraph` (title, description, images >= 1200x630), `twitter` card.
- Generate `app/sitemap.ts` (all public product/category URLs with
  `lastModified`); generate `app/robots.ts` (allow storefront, disallow
  `/dashboard`, `/checkout`, `/account`).
- Canonical URLs: always point to the canonical variant; no duplicate pages
  for query params (pagination uses `rel="prev/next"` or canonical first page).
- JSON-LD via `JSON-LD` script tag (or `app/product/[slug]/opengraph-image`):
  - `Product`: name, image, description, brand, `offers` (price, priceCurrency,
    availability, itemCondition) — matches displayed price exactly.
  - `Organization` on the home page (name, logo, contact info).
  - `BreadcrumbList` on category/product pages matching visible breadcrumbs.
- Open Graph/Twitter: verify cards render (og debugger); use the product
  image with correct alt.
- Keyword-aware copy: 1 primary keyword per product page in title, H1, and
  first paragraph naturally; category pages cover related terms; never stuff.
- Heading hierarchy: one H1 per page (product name or category), H2s for
  sections (specs, usage), H3s for subsections.
- Core Web Vitals are ranking signals: keep LCP/INP/CLS within targets
  (see performance-patterns); product images `priority` on LCP.
- URL design: `/products/<slug>`, `/categories/<slug>` — short, keyworded,
  stable slugs from product names.

## Do NOT
- Do not index `/dashboard`, `/checkout`, `/cart`, `/account` (noindex or robots).
- Do not render metadata client-side (`useEffect`); set it in server
  components/`generateMetadata`.
- Do not duplicate titles or descriptions across similar products.
- Do not block JS-dependent rendering for crawlers; rely on SSR/SSG output.

## Related
`performance-patterns` (Vitals), `content-writing` (keyword-aware copy),
`marketing-campaign` (landing pages with tracking).
