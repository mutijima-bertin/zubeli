# 2026-08-08 — database-agent — real photos + taxonomy + featured trim + new catalog products

## What was done
- `prisma/seed.ts` only (schema untouched): added `photo?: boolean` to ProductSpec → `imageUrls = ["/images/products/stock/<slug>.jpg"]` when set, else SVG/no-image as before; `imageUrls` now also converges in the upsert `update` branch (reseeds idempotent to the photo state).
- **Photo map (8 existing):** power-drill, cement-50kg, screwdriver-set, adjustable-wrench, safety-vest, safety-gloves, safety-goggles, safety-helmet → stock photos.
- **8 new real-photo products** (featured false, published, stock 20–60): rhinoceros-bow-saw (inherited RWF 7,500 / stock 20 from dev-BD rinco product slug `zubeli` per psql), shovel 8,500, safety-boots 18,000, hand-saw 9,000, wash-basin 38,000, bench-plane 24,000, hedge-shears 13,500, paint-sprayer 75,000. Old `rinocirento` row replaced by its seed entry — proper name now "Rhinoceros Bow Saw".
- **Featured trim 8→5**: kept power-drill, angle-grinder (e2e contract), cement-50kg, claw-hammer, extension-ladder; removed safety-helmet, wheelbarrow, measuring-tape.
- **Taxonomy:** wheelbarrow `construction-materials` → `site-equipment`. No renames/re-slugs of existing products; order fixtures untouched.

## Verification (dev 5434, `prisma migrate reset --force` + seed; test 5435 untouched)
- tsc 0; lint 0 errors (2 known e2e warnings); seed idempotent — 2nd run created 0 orders.
- psql: users 2 OWNER (owner@zubeli.rw + mutijima@gmail.com) + 2 customers; products 38; `imageUrls` stock-photo rows = 16; safety-vest stock 0; waterproofing-membrane isPublished false; angle-grinder featured; featured count = 5; wheelbarrow in Site Equipment; zero leftover `zubeli` slugs.
- Homepage smoke (:3000): 200, renders exactly the 5 featured (no measuring-tape/wheelbarrow/safety-helmet), stock photos served for power-drill + cement-50kg, SVG fallbacks intact.

Backend needs to know: nothing — seed shape and image URL pattern unchanged (`imageUrls[0]` still hero). 8 new slugs/names/prices listed in the final message.