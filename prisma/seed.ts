/**
 * Zubeli — demo seed (ADR 0001 data model)
 *
 * Idempotent: safe to run repeatedly (`npx prisma db seed` / `npm run db:seed`).
 * - Users/categories/products are upserted by unique keys.
 * - RESTOCK movements are only created when a product row is first seeded.
 * - Orders are keyed by Order.number: if an order already exists it is skipped
 *   (its items/payment/movements were created on the first run).
 * - Product.stockQty is always computed from the static specs below, so the end
 *   state is identical on every run.
 *
 * Money: Int minor units = RWF (no circulating subunit). VAT-inclusive, no tax line.
 */
import { PrismaClient, Role, OrderStatus, PaymentMethod, PaymentStatus, InventoryMovementType, InventoryReason } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SEED_MODE = (process.env.SEED_MODE ?? 'full').trim().toLowerCase();
const isTaxonomyMode = SEED_MODE === 'taxonomy';
const isFullMode = !isTaxonomyMode;

const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'owner@zubeli.rw';
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'DemoPass2026!';
const SEED_ADMIN_2_EMAIL = process.env.SEED_ADMIN_2_EMAIL ?? 'mutijima@gmail.com';
const SEED_ADMIN_2_PASSWORD = process.env.SEED_ADMIN_2_PASSWORD ?? 'Mutijima1.';
const DEMO_PASSWORD = 'DemoPass2026!'; // shared demo password for seeded customers (dev-only)

const daysAgo = (days: number, extraHours = 0) =>
  new Date(Date.now() - days * 86_400_000 - extraHours * 3_600_000);

// ---------------------------------------------------------------------------
// Static catalog data
// ---------------------------------------------------------------------------

type CategorySpec = { name: string; slug: string; description: string };

const categories: CategorySpec[] = [
  { name: 'Power Tools', slug: 'power-tools', description: 'Drills, grinders, saws and everything that runs on mains or battery for serious work.' },
  { name: 'Hand Tools', slug: 'hand-tools', description: 'Hammers, wrenches, screwdrivers — the reliable basics every site needs.' },
  { name: 'Safety Gear', slug: 'safety-gear', description: 'Helmets, gloves, goggles and high-visibility wear that keep you safe on site.' },
  { name: 'Construction Materials', slug: 'construction-materials', description: 'Cement, blocks, rebar and more — delivered in the quantities you need.' },
  { name: 'Fasteners & Fixings', slug: 'fasteners-fixings', description: 'Nails, screws, bolts and plugs that hold your work together.' },
  { name: 'Measuring & Layout', slug: 'measuring-layout', description: 'Tapes, levels and lasers for accurate measurement and layout.' },
  { name: 'Plumbing', slug: 'plumbing', description: 'Pipes, wrenches and fittings for water and drainage work.' },
  { name: 'Electrical', slug: 'electrical', description: 'Cables, cutters and work lighting for electrical jobs.' },
  { name: 'Painting & Finishing', slug: 'painting-finishing', description: 'Rollers, brushes and accessories for a clean professional finish.' },
  { name: 'Site Equipment', slug: 'site-equipment', description: 'Ladders, mixers and heavy gear for the whole site.' },
];

type ProductSpec = {
  slug: string;
  name: string;
  categorySlug: string;
  description: string;
  priceCents: number;
  initialStock: number;
  featured?: boolean;
  isPublished?: boolean;
  image?: boolean; // has a placeholder SVG in public/images/products/
  photo?: boolean; // has a real photo in public/images/products/stock/
  photoFiles?: string[]; // photo file names (relative to stock/) when set differs from [`<slug>.jpg`]
};

const products: ProductSpec[] = [
  // Power Tools
  { slug: 'power-drill', name: 'Power Drill 13mm', categorySlug: 'power-tools', priceCents: 85000, initialStock: 12, featured: true, photo: true,
    description: 'A 13mm chuck power drill with variable speed, ideal for masonry, wood and steel on Rwandan job sites. Comes with a side handle and a carry case so you can work all day comfortably.' },
  { slug: 'angle-grinder', name: 'Angle Grinder 125mm', categorySlug: 'power-tools', priceCents: 65000, initialStock: 8, featured: true, photo: true,
    description: 'A 125mm angle grinder for cutting and grinding metal, tile and concrete. Slim body for a firm grip and a lock-on switch for longer cutting runs.' },
  { slug: 'circular-saw', name: 'Circular Saw 185mm', categorySlug: 'power-tools', priceCents: 125000, initialStock: 6, image: true,
    description: 'A 185mm circular saw with a laser guide for straight, accurate cuts in timber and sheet materials. Great for framing and site carpentry.' },
  { slug: 'jigsaw', name: 'Jigsaw 650W', categorySlug: 'power-tools', priceCents: 72000, initialStock: 4,
    description: 'A 650W jigsaw with orbital action for curved and plunge cuts in wood, plastic and metal. Tool-free blade change keeps you working fast.' },
  // Hand Tools
  { slug: 'claw-hammer', name: 'Claw Hammer 500g', categorySlug: 'hand-tools', priceCents: 12500, initialStock: 30, featured: true, image: true,
    description: 'A 500g forged-steel claw hammer with a shock-absorbing handle. The right balance for driving and pulling nails all day without tiring your wrist.' },
  { slug: 'adjustable-wrench', name: 'Adjustable Wrench 250mm', categorySlug: 'hand-tools', priceCents: 9800, initialStock: 25, photo: true,
    description: 'A 250mm adjustable wrench with a smooth 30mm jaw. One tool handles many nut and bolt sizes — a must for plumbing and equipment repairs.' },
  { slug: 'screwdriver-set', name: 'Screwdriver Set (8-piece)', categorySlug: 'hand-tools', priceCents: 15000, initialStock: 18, photo: true,
    description: 'Eight flat and Phillips screwdrivers with magnetic tips and comfortable grips. Covers the sizes used on almost every assembly job.' },
  // Safety Gear
  { slug: 'safety-helmet', name: 'Safety Helmet', categorySlug: 'safety-gear', priceCents: 4500, initialStock: 60, photo: true,
    description: 'A lightweight industrial safety helmet with an adjustable strap and sweatband. Certified for construction sites and comfortable in the sun.' },
  { slug: 'safety-gloves', name: 'Work Gloves (pair)', categorySlug: 'safety-gear', priceCents: 3500, initialStock: 80, photo: true,
    description: 'Reinforced work gloves with a grippy palm. Protect your hands from cuts, blisters and heat while handling tools and materials.' },
  { slug: 'safety-goggles', name: 'Safety Goggles', categorySlug: 'safety-gear', priceCents: 4000, initialStock: 45, photo: true,
    description: 'Impact-resistant safety goggles with anti-fog coating. Keep dust and debris out of your eyes when cutting, grinding or mixing.' },
  { slug: 'safety-vest', name: 'Hi-Vis Safety Vest', categorySlug: 'safety-gear', priceCents: 6500, initialStock: 0, photo: true,
    description: 'A high-visibility mesh vest with reflective stripes. Be clearly seen by vehicles and machinery on site. Currently out of stock.' },
  // Construction Materials
  { slug: 'cement-50kg', name: 'Cement 50kg', categorySlug: 'construction-materials', priceCents: 9800, initialStock: 200, featured: true, photo: true,
    photoFiles: ['cement-50kg.jpg', 'cement-bag.jpg'],
    description: 'A 50kg bag of general-purpose Portland cement. Consistent quality for slabs, blocks and plaster — the backbone of any build.' },
  { slug: 'wheelbarrow', name: 'Wheelbarrow 100L', categorySlug: 'site-equipment', priceCents: 48000, initialStock: 14, image: true,
    description: 'A 100L heavy-duty wheelbarrow with a pneumatic tyre and sturdy steel tray. Moves concrete, sand and rubble without slowing you down.' },
  { slug: 'hollow-block', name: 'Hollow Block (per 100)', categorySlug: 'construction-materials', priceCents: 45000, initialStock: 90,
    description: 'A pack of 100 standard 6-inch hollow concrete blocks. Uniform size and strength for fast, even wall construction.' },
  { slug: 'steel-rebar', name: 'Steel Rebar 12mm (3m)', categorySlug: 'construction-materials', priceCents: 18500, initialStock: 70,
    description: 'A 3m length of 12mm deformed steel rebar. Gives concrete columns and beams the tensile strength they need.' },
  { slug: 'waterproofing-membrane', name: 'Waterproofing Membrane (roll)', categorySlug: 'construction-materials', priceCents: 32000, initialStock: 10, isPublished: false,
    description: 'A 20m roll of self-adhesive waterproofing membrane for foundations, roofs and wet rooms. Keeps moisture where it belongs — outside.' },
  // Fasteners & Fixings
  { slug: 'galvanized-nails', name: 'Galvanized Nails 1kg', categorySlug: 'fasteners-fixings', priceCents: 6500, initialStock: 100,
    description: 'A 1kg box of galvanized nails in assorted sizes. Rust-resistant for framing and outdoor woodwork that has to last.' },
  { slug: 'concrete-screws', name: 'Concrete Screws (box)', categorySlug: 'fasteners-fixings', priceCents: 8500, initialStock: 55,
    description: 'A box of hardened concrete screws with a drill bit included. Fix brackets, rails and frames straight into masonry without plugs.' },
  { slug: 'hex-bolts', name: 'Hex Bolts M8 (box)', categorySlug: 'fasteners-fixings', priceCents: 9000, initialStock: 48,
    description: 'A box of 50 M8 zinc-plated hex bolts with nuts. Strong, corrosion-resistant fixings for steel and timber connections.' },
  // Measuring & Layout
  { slug: 'measuring-tape', name: 'Measuring Tape 5m', categorySlug: 'measuring-layout', priceCents: 3200, initialStock: 40, photo: true,
    description: 'A 5m locking tape measure with a durable blade and belt clip. Clear markings make every cut and layout quick to check.' },
  { slug: 'spirit-level', name: 'Spirit Level 1m', categorySlug: 'measuring-layout', priceCents: 14500, initialStock: 26,
    description: 'A 1m aluminium spirit level with three vials. Check walls, frames and shelves are perfectly true, horizontal and vertical.' },
  { slug: 'laser-level', name: 'Laser Level Self-Leveling', categorySlug: 'measuring-layout', priceCents: 89000, initialStock: 3, image: true,
    description: 'A self-leveling laser level projecting a bright red cross line. Lay out tiles, cabinets and partitions accurately on your own.' },
  // Plumbing
  { slug: 'pvc-pipe', name: 'PVC Pipe 4m', categorySlug: 'plumbing', priceCents: 11500, initialStock: 60,
    description: 'A 4m length of 50mm PVC drainage pipe. Light, easy to cut and join — ideal for drainage and vent runs.' },
  { slug: 'pipe-wrench', name: 'Pipe Wrench 250mm', categorySlug: 'plumbing', priceCents: 24000, initialStock: 11,
    description: 'A 250mm heavy-duty pipe wrench with hardened teeth. Grips round pipes and fittings firmly without slipping.' },
  // Electrical
  { slug: 'extension-cable', name: 'Extension Cable 25m', categorySlug: 'electrical', priceCents: 22000, initialStock: 17,
    description: 'A 25m 3-core extension cable with multiple sockets. Power your tools anywhere on site — tough sheath resists wear.' },
  { slug: 'wire-cutter', name: 'Wire Cutter 200mm', categorySlug: 'electrical', priceCents: 9800, initialStock: 29,
    description: 'A 200mm wire cutter with hardened blades and insulated handles. Clean cuts through copper and steel wire.' },
  // Painting & Finishing
  { slug: 'paint-roller', name: 'Paint Roller Set', categorySlug: 'painting-finishing', priceCents: 7800, initialStock: 35,
    description: 'A roller set with a 25cm frame, sleeves and a tray. Cover large walls fast with a smooth, even coat.' },
  { slug: 'paint-brush-set', name: 'Paint Brush Set (3 sizes)', categorySlug: 'painting-finishing', priceCents: 5200, initialStock: 40,
    description: 'Three quality brushes — wide, medium and narrow — for cutting in, trim and detail work with any paint type.' },
  // Site Equipment
  { slug: 'extension-ladder', name: 'Extension Ladder 5m', categorySlug: 'site-equipment', priceCents: 210000, initialStock: 5, featured: true, image: true,
    description: 'A 5m aluminium extension ladder with slip-resistant rungs and locking catches. Reaches upper floors safely and stays steady.' },
  { slug: 'concrete-mixer', name: 'Concrete Mixer 160L', categorySlug: 'site-equipment', priceCents: 385000, initialStock: 2, image: true,
    description: 'A 160L electric concrete mixer with a steel drum. Mix consistent concrete on site in minutes instead of by hand.' },
  // ---- Real-photo catalog additions (2026-08-08) — photos live in
  // public/images/products/stock/<slug>.jpg ----
  { slug: 'rhinoceros-bow-saw', name: 'Rhinoceros Bow Saw', categorySlug: 'hand-tools', priceCents: 7500, initialStock: 20, photo: true,
    description: 'A Rhinoceros bow saw that cuts timber, branches and PVC pipe quickly and cleanly. Tough frame with a comfortable grip — a real site favourite.' },
  { slug: 'shovel', name: 'Shovel', categorySlug: 'site-equipment', priceCents: 8500, initialStock: 40, photo: true,
    description: 'A steel-blade shovel for digging, mixing mortar and moving materials. Hardened edge stays sharp through heavy site work.' },
  { slug: 'safety-boots', name: 'Safety Boots', categorySlug: 'safety-gear', priceCents: 18000, initialStock: 30, photo: true,
    description: 'Rugged safety boots with a steel toe cap and slip-resistant sole. Protect your feet from falling loads and sharp ground all day.' },
  { slug: 'hand-saw', name: 'Hand Saw 14in', categorySlug: 'hand-tools', priceCents: 9000, initialStock: 35, photo: true,
    description: 'A 14-inch hand saw with hardened teeth for fast, clean cross-cuts in timber and board. Comfortable grip for long cutting sessions.' },
  { slug: 'wash-basin', name: 'Wash Basin', categorySlug: 'plumbing', priceCents: 38000, initialStock: 25, photo: true,
    description: 'A durable wash basin in a clean white finish. Easy to install and wipe down — a solid fit for homes and site facilities alike.' },
  { slug: 'bench-plane', name: 'Bench Plane', categorySlug: 'hand-tools', priceCents: 24000, initialStock: 25, photo: true,
    description: 'A bench plane that trims doors, edges and joints to a smooth finish. Set the blade once and keep planing all day.' },
  { slug: 'hedge-shears', name: 'Hedge Shears 52cm', categorySlug: 'hand-tools', priceCents: 13500, initialStock: 30, photo: true,
    description: '52cm hedge shears with sharpened blades and soft-grip handles. Trim hedges, bushes and overgrowth quickly and evenly.' },
  { slug: 'paint-sprayer', name: 'Paint Sprayer', categorySlug: 'painting-finishing', priceCents: 75000, initialStock: 20, photo: true,
    description: 'An electric paint sprayer that puts a smooth, even coat on walls and fences in a fraction of the time. Adjustable flow for any paint.' },
  // ---- Photo batch 2 (2026-08-08) — real photos, benefit-led copy ----
  { slug: 'chainsaw', name: 'Chainsaw', categorySlug: 'power-tools', priceCents: 185000, initialStock: 10, photo: true,
    description: 'A powerful chainsaw for felling timber, cutting firewood and clearing branches. Anti-vibration handles and automatic chain oiling keep long cutting sessions comfortable.' },
  { slug: 'pressure-washer', name: 'Pressure Washer', categorySlug: 'site-equipment', priceCents: 250000, initialStock: 8, photo: true,
    description: 'A high-pressure washer that blasts mud, paint and grime off machines, walls and floors. The quick way to keep tools and equipment site-ready.' },
  { slug: 'garden-hoe', name: 'Garden Hoe', categorySlug: 'hand-tools', priceCents: 5000, initialStock: 50, photo: true,
    description: 'A garden hoe with a sharp tempered-steel blade for weeding, digging and breaking up soil. Firmly fixed to a strong handle for comfortable all-day work.' },
  { slug: 'pruning-shears', name: 'Pruning Shears', categorySlug: 'hand-tools', priceCents: 9500, initialStock: 35, photo: true,
    photoFiles: ['pruning-shears.jpg', 'pruning-shears-2.jpg'],
    description: 'Sharp pruning shears that cut branches and stems cleanly so plants stay healthy. Comfortable grip and a safety catch fold them away when not in use.' },
];

// ---------------------------------------------------------------------------
// Static order data (15 orders over the last ~90 days)
// ---------------------------------------------------------------------------

type OrderSpec = {
  number: string;
  daysAgo: number;
  status: 'FULFILLED' | 'PAID' | 'CANCELLED' | 'PENDING';
  customer: { email?: string; name: string; phone: string; address: string; city?: string };
  items: { slug: string; qty: number }[];
  method: PaymentMethod;
  bankTransferReference?: string;
};

const orders: OrderSpec[] = [
  // ---- FULFILLED (10) ----
  { number: 'ZBL-00000001', daysAgo: 88, status: 'FULFILLED',
    customer: { email: 'umutoni@demo.rw', name: 'Umutoni Claudine', phone: '+250788123456', address: 'KG 7 Ave, Kimironko', city: 'Kigali' },
    items: [{ slug: 'power-drill', qty: 1 }, { slug: 'safety-helmet', qty: 2 }], method: PaymentMethod.COD_CASH },
  { number: 'ZBL-00000002', daysAgo: 81, status: 'FULFILLED',
    customer: { name: 'Jean Bosco Niyonzima', phone: '+250788112233', address: 'KG 11 St, Gisozi', city: 'Kigali' },
    items: [{ slug: 'cement-50kg', qty: 10 }, { slug: 'wheelbarrow', qty: 1 }], method: PaymentMethod.COD_MOBILE_MONEY },
  { number: 'ZBL-00000003', daysAgo: 74, status: 'FULFILLED',
    customer: { email: 'eric@demo.rw', name: 'Eric Mugisha', phone: '+250722345678', address: 'KN 4 St, Kacyiru', city: 'Kigali' },
    items: [{ slug: 'angle-grinder', qty: 1 }, { slug: 'safety-gloves', qty: 2 }], method: PaymentMethod.COD_CASH },
  { number: 'ZBL-00000004', daysAgo: 66, status: 'FULFILLED',
    customer: { email: 'umutoni@demo.rw', name: 'Umutoni Claudine', phone: '+250788123456', address: 'KG 7 Ave, Kimironko', city: 'Kigali' },
    items: [{ slug: 'measuring-tape', qty: 1 }, { slug: 'spirit-level', qty: 1 }, { slug: 'claw-hammer', qty: 1 }], method: PaymentMethod.COD_MOBILE_MONEY },
  { number: 'ZBL-00000005', daysAgo: 59, status: 'FULFILLED',
    customer: { name: 'Aline Uwase', phone: '+250733445566', address: 'KN 3 Ave, Nyarugenge', city: 'Kigali' },
    items: [{ slug: 'circular-saw', qty: 1 }, { slug: 'safety-goggles', qty: 1 }], method: PaymentMethod.COD_CASH },
  { number: 'ZBL-00000006', daysAgo: 52, status: 'FULFILLED',
    customer: { email: 'eric@demo.rw', name: 'Eric Mugisha', phone: '+250722345678', address: 'KN 4 St, Kacyiru', city: 'Kigali' },
    items: [{ slug: 'pvc-pipe', qty: 3 }, { slug: 'pipe-wrench', qty: 1 }], method: PaymentMethod.COD_MOBILE_MONEY },
  { number: 'ZBL-00000007', daysAgo: 45, status: 'FULFILLED',
    customer: { email: 'umutoni@demo.rw', name: 'Umutoni Claudine', phone: '+250788123456', address: 'KG 7 Ave, Kimironko', city: 'Kigali' },
    items: [{ slug: 'extension-cable', qty: 2 }, { slug: 'wire-cutter', qty: 1 }], method: PaymentMethod.BANK_TRANSFER, bankTransferReference: 'TRF-7710294' },
  { number: 'ZBL-00000008', daysAgo: 38, status: 'FULFILLED',
    customer: { name: 'Patrick Habimana', phone: '+250788998877', address: 'HH 2 Ave, Huye', city: 'Huye' },
    items: [{ slug: 'steel-rebar', qty: 5 }, { slug: 'galvanized-nails', qty: 2 }], method: PaymentMethod.COD_CASH },
  { number: 'ZBL-00000009', daysAgo: 31, status: 'FULFILLED',
    customer: { email: 'eric@demo.rw', name: 'Eric Mugisha', phone: '+250722345678', address: 'KN 4 St, Kacyiru', city: 'Kigali' },
    items: [{ slug: 'concrete-screws', qty: 3 }, { slug: 'hex-bolts', qty: 2 }, { slug: 'measuring-tape', qty: 2 }], method: PaymentMethod.COD_MOBILE_MONEY },
  { number: 'ZBL-00000010', daysAgo: 24, status: 'FULFILLED',
    customer: { email: 'umutoni@demo.rw', name: 'Umutoni Claudine', phone: '+250788123456', address: 'KG 7 Ave, Kimironko', city: 'Kigali' },
    items: [{ slug: 'paint-roller', qty: 1 }, { slug: 'paint-brush-set', qty: 2 }, { slug: 'adjustable-wrench', qty: 1 }], method: PaymentMethod.COD_CASH },
  // ---- CANCELLED (1) — never paid; stock restored via IN/CANCEL ----
  { number: 'ZBL-00000011', daysAgo: 21, status: 'CANCELLED',
    customer: { name: 'Chantal Ingabire', phone: '+250722334455', address: 'KK 15 Rd, Kicukiro', city: 'Kigali' },
    items: [{ slug: 'jigsaw', qty: 1 }, { slug: 'screwdriver-set', qty: 1 }], method: PaymentMethod.COD_CASH },
  // ---- PAID (2) — paid, awaiting fulfillment ----
  { number: 'ZBL-00000012', daysAgo: 17, status: 'PAID',
    customer: { email: 'eric@demo.rw', name: 'Eric Mugisha', phone: '+250722345678', address: 'KN 4 St, Kacyiru', city: 'Kigali' },
    items: [{ slug: 'extension-ladder', qty: 1 }], method: PaymentMethod.COD_MOBILE_MONEY },
  { number: 'ZBL-00000013', daysAgo: 12, status: 'PAID',
    customer: { email: 'umutoni@demo.rw', name: 'Umutoni Claudine', phone: '+250788123456', address: 'KG 7 Ave, Kimironko', city: 'Kigali' },
    items: [{ slug: 'hollow-block', qty: 6 }, { slug: 'cement-50kg', qty: 4 }], method: PaymentMethod.COD_CASH },
  // ---- PENDING (2) — one BANK_TRANSFER awaiting manual verification, one COD_MOBILE_MONEY ----
  { number: 'ZBL-00000014', daysAgo: 3, status: 'PENDING',
    customer: { name: 'Diane Mukamana', phone: '+250788556677', address: 'MZ 1 Rd, Musanze', city: 'Musanze' },
    items: [{ slug: 'laser-level', qty: 1 }, { slug: 'concrete-mixer', qty: 1 }], method: PaymentMethod.BANK_TRANSFER, bankTransferReference: 'TRF-8820136' },
  { number: 'ZBL-00000015', daysAgo: 1, status: 'PENDING',
    customer: { email: 'umutoni@demo.rw', name: 'Umutoni Claudine', phone: '+250788123456', address: 'KG 7 Ave, Kimironko', city: 'Kigali' },
    items: [{ slug: 'extension-cable', qty: 1 }, { slug: 'cement-50kg', qty: 2 }], method: PaymentMethod.COD_MOBILE_MONEY },
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  // 1. Users — owners + demo customers
  const owner = await prisma.user.upsert({
    where: { email: SEED_ADMIN_EMAIL },
    update: {},
    create: {
      email: SEED_ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(SEED_ADMIN_PASSWORD, 10),
      name: 'Zubeli Owner',
      role: Role.OWNER,
    },
  });

  // Second admin — permanent fixture (survives reseeds; upsert keyed by email)
  await prisma.user.upsert({
    where: { email: SEED_ADMIN_2_EMAIL },
    update: {},
    create: {
      email: SEED_ADMIN_2_EMAIL,
      passwordHash: await bcrypt.hash(SEED_ADMIN_2_PASSWORD, 10),
      name: 'Mutijima Bertin',
      role: Role.OWNER,
    },
  });

  const customers: { id: string; email: string; name: string; phone: string | null }[] = [];
  if (isFullMode) {
    const demoCustomers = [
      { email: 'umutoni@demo.rw', name: 'Umutoni Claudine', phone: '+250788123456' },
      { email: 'eric@demo.rw', name: 'Eric Mugisha', phone: '+250722345678' },
    ];
    for (const c of demoCustomers) {
      const user = await prisma.user.upsert({
        where: { email: c.email },
        update: {},
        create: {
          email: c.email,
          passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
          name: c.name,
          phone: c.phone,
          role: Role.CUSTOMER,
        },
      });
      customers.push(user);
    }
  }
  const customerByEmail = new Map(customers.map((c) => [c.email, c]));

  // 2. Categories
  const categoryBySlug = new Map<string, string>();
  for (const cat of categories) {
    const row = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
    categoryBySlug.set(cat.slug, row.id);
  }

  // 3. Products + initial RESTOCK ledger entries (only on first creation)
  const productIdBySlug = new Map<string, string>();
  if (isFullMode) {
    for (const p of products) {
      const categoryId = categoryBySlug.get(p.categorySlug);
      if (!categoryId) throw new Error(`Seed: missing category ${p.categorySlug}`);
      // Real photos (public/images/products/stock/) take precedence over
      // placeholder SVGs; imageUrls stay stable across runs so reseeds converge.
      // First entry is the hero image (gallery order).
      const imageUrls = p.photo
        ? (p.photoFiles ?? [`${p.slug}.jpg`]).map((f) => `/images/products/stock/${f}`)
        : p.image
          ? [`/images/products/${p.slug}.svg`]
          : [];
      // slug is NOT unique at the type level anymore (partial unique index owns
      // it in SQL, see schema.prisma) — use findFirst instead of where:{slug}.
      const existing = await prisma.product.findFirst({ where: { slug: p.slug } });
      const row = existing
        ? await prisma.product.update({
            where: { id: existing.id },
            data: {
              name: p.name,
              description: p.description,
              priceCents: p.priceCents,
              stockQty: p.initialStock,
              lowStockThreshold: 5,
              isPublished: p.isPublished ?? true,
              featured: p.featured ?? false,
              imageUrls,
              categoryId,
            },
          })
        : await prisma.product.create({
            data: {
              slug: p.slug,
              name: p.name,
              description: p.description,
              imageUrls,
              priceCents: p.priceCents,
              stockQty: p.initialStock,
              lowStockThreshold: 5,
              isPublished: p.isPublished ?? true,
              featured: p.featured ?? false,
              categoryId,
            },
          });
      productIdBySlug.set(p.slug, row.id);

      const movementCount = await prisma.inventoryMovement.count({ where: { productId: row.id } });
      if (movementCount === 0) {
        await prisma.inventoryMovement.create({
          data: {
            productId: row.id,
            type: InventoryMovementType.IN,
            reason: InventoryReason.RESTOCK,
            quantity: p.initialStock,
            note: 'Initial stock (seed)',
          },
        });
      }
    }
  }

  // 4. Orders (skipped if already seeded — keyed by Order.number)
  let createdOrders = 0;
  let createdItems = 0;
  let createdMovements = 0;
  if (isFullMode) {
    for (const spec of orders) {
      const existing = await prisma.order.findUnique({ where: { number: spec.number } });
      if (existing) continue; // already seeded on a previous run

      const createdAt = daysAgo(spec.daysAgo);
      const isFulfilled = spec.status === 'FULFILLED';
      const isPaid = spec.status === 'FULFILLED' || spec.status === 'PAID';
      const isCancelled = spec.status === 'CANCELLED';
      const paidAt = isPaid ? new Date(createdAt.getTime() + 86_400_000) : null; // paid next day
      const fulfilledAt = isFulfilled ? new Date(paidAt!.getTime() + 2 * 86_400_000) : null;
      const cancelledAt = isCancelled ? new Date(createdAt.getTime() + 86_400_000) : null;

      const customer = spec.customer.email ? customerByEmail.get(spec.customer.email) : undefined;

      await prisma.$transaction(async (tx) => {
        // Resolve products and snapshot prices (current catalog price at seed time)
        const lines: { productId: string; productName: string; unitPriceCents: number; qty: number }[] = [];
        let subtotalCents = 0;
        for (const item of spec.items) {
          const productId = productIdBySlug.get(item.slug);
          if (!productId) throw new Error(`Seed: unknown product slug ${item.slug}`);
          const product = await tx.product.findUniqueOrThrow({
            where: { id: productId },
            select: { name: true, priceCents: true },
          });
          lines.push({ productId, productName: product.name, unitPriceCents: product.priceCents, qty: item.qty });
          subtotalCents += product.priceCents * item.qty;
        }

        const totalCents = subtotalCents;

        const order = await tx.order.create({
          data: {
            number: spec.number,
            status: spec.status as OrderStatus,
            customerId: customer?.id ?? null,
            customerName: spec.customer.name,
            customerPhone: spec.customer.phone,
            customerEmail: spec.customer.email,
            customerAddress: spec.customer.address,
            customerCity: spec.customer.city,
            subtotalCents,
            totalCents,
            bankTransferReference: spec.bankTransferReference,
            paidAt,
            fulfilledAt,
            cancelledAt,
            createdAt,
          },
        });

        for (const line of lines) {
          await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: line.productId,
              productName: line.productName,
              unitPriceCents: line.unitPriceCents,
              quantity: line.qty,
            },
          });
          createdItems += 1;

          // Stock ledger: OUT/ORDER at checkout ...
          await tx.inventoryMovement.create({
            data: {
              productId: line.productId,
              type: InventoryMovementType.OUT,
              reason: InventoryReason.ORDER,
              quantity: line.qty,
              orderId: order.id,
              note: `Order ${spec.number}`,
            },
          });
          createdMovements += 1;

          // ... and IN/CANCEL restores stock when the order is cancelled (ADR 0001)
          if (isCancelled) {
            await tx.inventoryMovement.create({
              data: {
                productId: line.productId,
                type: InventoryMovementType.IN,
                reason: InventoryReason.CANCEL,
                quantity: line.qty,
                orderId: order.id,
                note: `Order ${spec.number} cancelled`,
              },
            });
            createdMovements += 1;
          }
        }

        await tx.payment.create({
          data: {
            orderId: order.id,
            method: spec.method,
            // PAID/FULFILLED → confirmed by owner (manual verification demo);
            // PENDING → waiting; CANCELLED → never completed (FAILED, so it does not
            // inflate the dashboard's pending-payment count).
            status: isPaid ? PaymentStatus.PAID : isCancelled ? PaymentStatus.FAILED : PaymentStatus.PENDING,
            amountCents: totalCents,
            confirmedById: isPaid ? owner.id : null,
            confirmedAt: paidAt,
          },
        });
      });
      createdOrders += 1;
    }
  }

  // 5. Recompute final stock: initial − sold (all orders) + restored (cancelled orders).
  let updatedStock = 0;
  if (isFullMode) {
    const soldBySlug = new Map<string, number>();
    for (const spec of orders) {
      for (const item of spec.items) {
        const sold = soldBySlug.get(item.slug) ?? 0;
        const restore = spec.status === 'CANCELLED' ? item.qty : 0;
        soldBySlug.set(item.slug, sold + item.qty - restore);
      }
    }
    for (const p of products) {
      const sold = soldBySlug.get(p.slug) ?? 0;
      const finalStock = p.initialStock - sold;
      const productId = productIdBySlug.get(p.slug);
      if (!productId) throw new Error(`Seed invariant: product "${p.slug}" missing from upsert pass`);
      await prisma.product.update({
        where: { id: productId },
        data: { stockQty: finalStock },
      });
      updatedStock += 1;
    }
  }

  // 6. Summary
  const [categoryCount, productCount, orderCount, orderItemCount, paymentCount, movementCount, userCount] =
    await Promise.all([
      prisma.category.count(),
      prisma.product.count(),
      prisma.order.count(),
      prisma.orderItem.count(),
      prisma.payment.count(),
      prisma.inventoryMovement.count(),
      prisma.user.count(),
    ]);

  console.log('Zubeli seed complete.');
  console.log(`  mode: ${SEED_MODE}`);
  console.log(`  users: ${userCount} (owners: ${SEED_ADMIN_EMAIL}, ${SEED_ADMIN_2_EMAIL})`);
  console.log(`  categories: ${categoryCount}`);
  console.log(`  products: ${productCount}`);
  console.log(`  orders: ${orderCount} (created this run: ${createdOrders})`);
  console.log(`  order items: ${orderItemCount} (created this run: ${createdItems})`);
  console.log(`  payments: ${paymentCount}`);
  console.log(`  inventory movements: ${movementCount} (created this run: ${createdMovements})`);
  console.log(`  stock rows updated: ${updatedStock}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
