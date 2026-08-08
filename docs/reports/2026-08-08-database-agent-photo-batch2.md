# 2026-08-08 — database-agent — Photo batch 2 seed

**Task:** apply new staged photos (prisma/seed.ts only; NO schema change, NO dev DB reset) via idempotent upsert.

**What changed (prisma/seed.ts):**
- `ProductSpec` gained `photoFiles?: string[]` — multi-image override; `imageUrls` resolution maps each file to `/images/products/stock/<file>` (hero = first entry); single-photo default `<slug>.jpg` unchanged.
- Existing SVG products gained photos: **angle-grinder** (`image`→`photo`), **measuring-tape** (`image`→`photo`). **cement-50kg** now 2 images: `[cement-50kg.jpg, cement-bag.jpg]`.
- 4 NEW products (all published, featured false, benefit-led copy): **chainsaw** Chainsaw / power-tools / 185,000 RWF / stock 10; **pressure-washer** Pressure Washer / site-equipment / 250,000 RWF / stock 8; **garden-hoe** Garden Hoe / hand-tools / 5,000 RWF / stock 50; **pruning-shears** Pruning Shears / hand-tools / 9,500 RWF / stock 35 (2 gallery photos).
- Untouched: featured set (5), existing names/slugs/stocks, order fixtures, categories.

**Verification (dev DB 5434, `npx prisma db seed` ×2):**
- Run 1: 42 products, 15 orders, 0 new; Run 2: identical, **0 extra orders/movements** (idempotent).
- psql: total=42; featured=5; angle-grinder + measuring-tape `imageUrls[1]` = stock jpg; cement-50kg = 2 entries (hero first); safety-vest stock 0; waterproofing-membrane unpublished; 4 new rows priced/stocked as spec.
- `npx tsc --noEmit` 0; `npm run lint` 0 errors (2 known e2e warnings).
- Smoke on :3000: `/api/health` {ok,db:up}; `/products/angle-grinder` 200 (photo URL ×5), `/products/chainsaw` 200 (×5), `/products/cement-50kg` renders both jpgs (×6 each).

**Next:** backend-agent unaffected (DB values only); homepage featured card for angle-grinder now shows real photo — e2e unaffected (asserts name/RWF only).