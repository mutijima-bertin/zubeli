/**
 * Storefront data helpers (src/lib/storefront.ts) — thin glue over the
 * database-agent repos + DTO mappers. The DB repos are mocked at module
 * level so these tests are fast and deterministic (no live DB); the DTO
 * mappers (src/lib/dto.ts) run for real, so fixtures must match the
 * ProductCard / Product shapes exactly.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CategoryWithCount } from "@/lib/db/categories";
import type { ProductCard } from "@/lib/db/products";

// --- mocks (must be declared before the module-under-test import) ----------

vi.mock("@/lib/db/products", () => ({
  listPublished: vi.fn(),
  getBySlug: vi.fn(),
  getFeatured: vi.fn(),
}));

vi.mock("@/lib/db/categories", () => ({
  listAll: vi.fn(),
}));

vi.mock("@/lib/site", () => ({
  siteConfig: {},
}));

import { listAll } from "@/lib/db/categories";
import { getBySlug, getFeatured, listPublished } from "@/lib/db/products";
import {
  CATALOG_PAGE_SIZE,
  getCatalogPage,
  getHomepageData,
  getProductDetail,
  getRelated,
} from "@/lib/storefront";

const listPublishedM = vi.mocked(listPublished);
const getBySlugM = vi.mocked(getBySlug);
const getFeaturedM = vi.mocked(getFeatured);
const listAllM = vi.mocked(listAll);

// --- fixtures ---------------------------------------------------------------

const CATEGORY = { id: "cat-1", slug: "power-tools", name: "Power Tools" };

const PRODUCTS: ProductCard[] = [
  {
    id: "p-1",
    slug: "hammer-drill",
    name: "Hammer Drill",
    description: "Rotary hammer drill",
    imageUrls: ["/images/products/hammer-drill.svg"],
    priceCents: 85000,
    currency: "RWF",
    stockQty: 12,
    featured: true,
    isPublished: true,
    category: { slug: "power-tools", name: "Power Tools" },
  },
  {
    id: "p-2",
    slug: "safety-helmet",
    name: "Safety Helmet",
    description: "Hard hat",
    imageUrls: ["/images/products/safety-helmet.svg"],
    priceCents: 15000,
    currency: "RWF",
    stockQty: 40,
    featured: false,
    isPublished: true,
    category: { slug: "safety", name: "Safety" },
  },
];

const CATEGORIES: CategoryWithCount[] = [
  { id: "cat-1", name: "Power Tools", slug: "power-tools", productCount: 5 },
  { id: "cat-2", name: "Safety", slug: "safety", productCount: 3 },
];

beforeEach(() => {
  vi.clearAllMocks();
});

// --- getHomepageData ---------------------------------------------------------

describe("getHomepageData", () => {
  it("maps featured products to cards and returns categories", async () => {
    getFeaturedM.mockResolvedValue(PRODUCTS);
    listAllM.mockResolvedValue(CATEGORIES);

    const data = await getHomepageData();

    expect(data.featured).toHaveLength(2);
    expect(data.featured[0]).toMatchObject({
      id: "p-1",
      slug: "hammer-drill",
      priceCents: 85000,
      category: { slug: "power-tools", name: "Power Tools" },
    });
    expect(data.categories).toBe(CATEGORIES); // passthrough
    expect(data).not.toHaveProperty("deliveryFeeCents");
    expect(getFeaturedM).toHaveBeenCalledWith(8);
  });
});

// --- getCatalogPage ----------------------------------------------------------

describe("getCatalogPage", () => {
  it("applies defaults (newest sort, no filters) and echoes the filter", async () => {
    listPublishedM.mockResolvedValue({ items: PRODUCTS, nextCursor: "c-2", hasMore: true });
    listAllM.mockResolvedValue(CATEGORIES);

    const data = await getCatalogPage({});

    expect(listPublishedM).toHaveBeenCalledWith({
      categorySlug: undefined,
      search: undefined,
      minPriceCents: undefined,
      maxPriceCents: undefined,
      stock: undefined,
      sort: "newest",
      cursor: undefined,
      limit: CATALOG_PAGE_SIZE,
    });
    expect(listAllM).toHaveBeenCalledWith({
      search: undefined,
      minPriceCents: undefined,
      maxPriceCents: undefined,
      stock: undefined,
    });
    expect(data.page.items).toHaveLength(2);
    expect(data.page.nextCursor).toBe("c-2");
    expect(data.page.hasMore).toBe(true);
    expect(data.filter).toEqual({
      q: null,
      cat: null,
      sort: "newest",
      minPrice: null,
      maxPrice: null,
      avail: null,
    });
  });

  it("passes filters/cursor through and normalizes an invalid sort", async () => {
    listPublishedM.mockResolvedValue({ items: [PRODUCTS[0]!], nextCursor: null, hasMore: false });
    listAllM.mockResolvedValue(CATEGORIES);

    const data = await getCatalogPage({ q: "drill", cat: "power-tools", sort: "bogus", cursor: "c-7" });

    expect(listPublishedM).toHaveBeenCalledWith({
      categorySlug: "power-tools",
      search: "drill",
      minPriceCents: undefined,
      maxPriceCents: undefined,
      stock: undefined,
      sort: "newest", // invalid input normalized
      cursor: "c-7",
      limit: CATALOG_PAGE_SIZE,
    });
    expect(data.filter).toEqual({
      q: "drill",
      cat: "power-tools",
      sort: "newest",
      minPrice: null,
      maxPrice: null,
      avail: null,
    });
  });

  it("supports price-asc and echoes it", async () => {
    listPublishedM.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    listAllM.mockResolvedValue([]);

    const data = await getCatalogPage({ sort: "price-asc" });

    expect(listPublishedM).toHaveBeenCalledWith(expect.objectContaining({ sort: "price-asc" }));
    expect(data.filter.sort).toBe("price-asc");
  });

  it("multi-field search: passes q to the product list AND the category counts", async () => {
    listPublishedM.mockResolvedValue({ items: PRODUCTS, nextCursor: null, hasMore: false });
    listAllM.mockResolvedValue(CATEGORIES);

    const data = await getCatalogPage({ q: "saw" });

    expect(listPublishedM).toHaveBeenCalledWith(
      expect.objectContaining({ search: "saw", categorySlug: undefined }),
    );
    // counts answer "how many in THIS category match the current search"
    expect(listAllM).toHaveBeenCalledWith(expect.objectContaining({ search: "saw" }));
    expect(data.filter.q).toBe("saw");
  });

  it("passes RWF minPrice/maxPrice through IDENTITY to the list + counts (1 RWF = 1 stored unit, ADR 0004) and echoes them", async () => {
    listPublishedM.mockResolvedValue({ items: PRODUCTS, nextCursor: null, hasMore: false });
    listAllM.mockResolvedValue(CATEGORIES);

    const data = await getCatalogPage({ minPrice: "10000", maxPrice: "50000" });

    expect(listPublishedM).toHaveBeenCalledWith(
      expect.objectContaining({ minPriceCents: 10000, maxPriceCents: 50000 }),
    );
    expect(listAllM).toHaveBeenCalledWith(
      expect.objectContaining({ minPriceCents: 10000, maxPriceCents: 50000 }),
    );
    expect(data.filter).toMatchObject({ minPrice: 10000, maxPrice: 50000 });
  });

  it("passes only the bound the client gave", async () => {
    listPublishedM.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    listAllM.mockResolvedValue([]);

    await getCatalogPage({ minPrice: "0" });

    expect(listPublishedM).toHaveBeenCalledWith(
      expect.objectContaining({ minPriceCents: 0, maxPriceCents: undefined }),
    );
    const data = await getCatalogPage({ maxPrice: "750" });
    expect(listAllM).toHaveBeenCalledWith(
      expect.objectContaining({ minPriceCents: undefined, maxPriceCents: 750 }),
    );
    expect(data.filter.maxPrice).toBe(750);
  });

  it("maps avail in/low/out to stock buckets and echoes it", async () => {
    listPublishedM.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    listAllM.mockResolvedValue([]);

    for (const avail of ["in", "low", "out"] as const) {
      const data = await getCatalogPage({ avail });
      expect(listPublishedM).toHaveBeenLastCalledWith(expect.objectContaining({ stock: avail }));
      expect(listAllM).toHaveBeenLastCalledWith(expect.objectContaining({ stock: avail }));
      expect(data.filter.avail).toBe(avail);
    }
  });

  it.each([
    { minPrice: "abc", maxPrice: "-5", avail: "bogus" },
    { minPrice: "12.5", maxPrice: "1e3", avail: "instock" },
    { minPrice: "-10", maxPrice: "", avail: "" },
  ])("ignores invalid params %j (never throws, treated as absent)", async (params) => {
    listPublishedM.mockResolvedValue({ items: PRODUCTS, nextCursor: null, hasMore: false });
    listAllM.mockResolvedValue(CATEGORIES);

    const data = await getCatalogPage(params);

    expect(listPublishedM).toHaveBeenCalledWith(
      expect.objectContaining({ minPriceCents: undefined, maxPriceCents: undefined, stock: undefined }),
    );
    expect(listAllM).toHaveBeenCalledWith(
      expect.objectContaining({ minPriceCents: undefined, maxPriceCents: undefined, stock: undefined }),
    );
    expect(data.filter).toMatchObject({ minPrice: null, maxPrice: null, avail: null });
    expect(data.page.items).toHaveLength(2); // filters treated as absent → normal page
  });

  it("applies q + price + avail additively to BOTH the list and the counts", async () => {
    listPublishedM.mockResolvedValue({ items: PRODUCTS, nextCursor: null, hasMore: false });
    listAllM.mockResolvedValue([
      { ...CATEGORIES[0]!, productCount: 1 },
      { ...CATEGORIES[1]!, productCount: 0 },
    ]);

    const data = await getCatalogPage({
      q: "drill",
      cat: "power-tools",
      minPrice: "20000",
      maxPrice: "100000",
      avail: "in",
    });

    expect(listPublishedM).toHaveBeenCalledWith({
      categorySlug: "power-tools",
      search: "drill",
      minPriceCents: 20000,
      maxPriceCents: 100000,
      stock: "in",
      sort: "newest",
      cursor: undefined,
      limit: CATALOG_PAGE_SIZE,
    });
    // counts apply search/price/avail but NOT the category (chip is the category itself)
    expect(listAllM).toHaveBeenCalledWith({
      search: "drill",
      minPriceCents: 20000,
      maxPriceCents: 100000,
      stock: "in",
    });
    expect(data.filter).toEqual({
      q: "drill",
      cat: "power-tools",
      sort: "newest",
      minPrice: 20000,
      maxPrice: 100000,
      avail: "in",
    });
    expect(data.categories[0]!.productCount).toBe(1); // mocked count — passthrough
  });
});

// --- getProductDetail ----------------------------------------------------------

describe("getProductDetail", () => {
  it("maps a found product to a full DTO (with category)", async () => {
    getBySlugM.mockResolvedValue({
      ...PRODUCTS[0]!,
      lowStockThreshold: 5,
      categoryId: "cat-1",
      deletedAt: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      // getBySlug returns the full Product + Category Prisma rows
      category: {
        id: "cat-1",
        slug: "power-tools",
        name: "Power Tools",
        description: "Drills and saws",
        isActive: true,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      },
    });

    const detail = await getProductDetail("hammer-drill");

    expect(detail).toMatchObject({
      id: "p-1",
      slug: "hammer-drill",
      priceCents: 85000,
      lowStockThreshold: 5,
      isPublished: true,
      featured: true,
      category: { id: "cat-1", slug: "power-tools", name: "Power Tools" },
    });
    expect(getBySlugM).toHaveBeenCalledWith("hammer-drill");
  });

  it("returns null for missing/unpublished slugs (screens call notFound())", async () => {
    getBySlugM.mockResolvedValue(null);
    expect(await getProductDetail("nope")).toBeNull();
  });
});

// --- getRelated ------------------------------------------------------------------

describe("getRelated", () => {
  const product = { ...PRODUCTS[0]!, lowStockThreshold: 5, category: CATEGORY };

  it("excludes the current product and stops at the limit (no featured fetch)", async () => {
    // category yields 4 usable items (p-1 is self, filtered out) → limit reached
    const extras: ProductCard[] = [
      PRODUCTS[1]!, // p-2
      { ...PRODUCTS[1]!, id: "p-3", slug: "saw", name: "Saw" },
      { ...PRODUCTS[1]!, id: "p-4", slug: "grinder", name: "Grinder" },
      { ...PRODUCTS[1]!, id: "p-5", slug: "sander", name: "Sander" },
    ];
    listPublishedM.mockResolvedValue({ items: [PRODUCTS[0]!, ...extras], nextCursor: null, hasMore: false });
    getFeaturedM.mockResolvedValue([]);

    const related = await getRelated(product);

    expect(related.map((r) => r.id)).toEqual(["p-2", "p-3", "p-4", "p-5"]);
    expect(listPublishedM).toHaveBeenCalledWith({ categorySlug: "power-tools", limit: 4 });
    expect(getFeaturedM).not.toHaveBeenCalled();
  });

  it("pads from featured when the category is thin (self excluded, deduped vs category)", async () => {
    // category returns ONLY the product itself → nothing usable
    listPublishedM.mockResolvedValue({ items: [PRODUCTS[0]!], nextCursor: null, hasMore: false });
    // featured: a fresh pick + the product itself (excluded) + another fresh pick
    getFeaturedM.mockResolvedValue([PRODUCTS[1]!, PRODUCTS[0]!, PRODUCTS[1]!, PRODUCTS[1]!]);

    const related = await getRelated(product, 2);

    expect(related.map((r) => r.id)).toEqual(["p-2", "p-2"]); // dupes within featured are NOT deduped
    expect(getFeaturedM).toHaveBeenCalledWith(4); // limit * 2
  });

  it("slices the combined list to the limit", async () => {
    const extra: ProductCard = { ...PRODUCTS[1]!, id: "p-3", slug: "gloves", name: "Gloves" };
    listPublishedM.mockResolvedValue({ items: [PRODUCTS[0]!, extra], nextCursor: null, hasMore: false });

    const related = await getRelated(product, 1);

    expect(related).toHaveLength(1);
  });
});
