/**
 * Shared catalog filter predicate (src/lib/db/catalog.ts) — the WHERE
 * builder used by BOTH the storefront product list and the category sidebar
 * counts. Pure query-shape unit tests: no DB, no mocks needed.
 */
import { describe, expect, it } from "vitest";
import { catalogWhere, escapeLike } from "@/lib/db/catalog";

describe("escapeLike", () => {
  it("escapes % _ and backslash so LIKE input matches literally", () => {
    expect(escapeLike("100%")).toBe("100\\%");
    expect(escapeLike("a_b")).toBe("a\\_b");
    expect(escapeLike("a\\b")).toBe("a\\\\b");
    expect(escapeLike("plain words")).toBe("plain words");
  });
});

describe("catalogWhere", () => {
  it("returns an empty predicate when no filters are applied", () => {
    expect(catalogWhere({})).toEqual({});
  });

  it("filters by category slug", () => {
    expect(catalogWhere({ categorySlug: "power-tools" })).toEqual({
      category: { slug: "power-tools" },
    });
  });

  it("searches name OR description OR category name, case-insensitive, with escaped patterns", () => {
    const where = catalogWhere({ search: "100% off" });
    expect(where.OR).toEqual([
      { name: { contains: "100\\% off", mode: "insensitive" } },
      { description: { contains: "100\\% off", mode: "insensitive" } },
      { category: { name: { contains: "100\\% off", mode: "insensitive" } } },
    ]);
  });

  it("bounds priceCents with gte/lte filters (cents domain)", () => {
    expect(catalogWhere({ minPriceCents: 1000000, maxPriceCents: 5000000 })).toEqual({
      priceCents: { gte: 1000000, lte: 5000000 },
    });
    expect(catalogWhere({ minPriceCents: 1000000 })).toEqual({
      priceCents: { gte: 1000000 },
    });
    expect(catalogWhere({ maxPriceCents: 500 })).toEqual({
      priceCents: { lte: 500 },
    });
  });

  it.each([
    ["in", { gt: 0 }],
    ["low", { gte: 1, lte: 5 }],
    ["out", 0],
  ] as const)("maps availability %s to a stockQty bucket", (avail, expected) => {
    expect(catalogWhere({ stock: avail }).stockQty).toEqual(expected);
  });

  it("ignores unknown availability values (absent)", () => {
    expect(catalogWhere({ stock: "bogus" as never }).stockQty).toBeUndefined();
  });

  it("combines search + price + availability additively", () => {
    const where = catalogWhere({
      search: "drill",
      categorySlug: "power-tools",
      minPriceCents: 2000000,
      maxPriceCents: 10000000,
      stock: "in",
    });

    expect(where.category).toEqual({ slug: "power-tools" });
    expect(where.OR).toHaveLength(3);
    expect(where.priceCents).toEqual({ gte: 2000000, lte: 10000000 });
    expect(where.stockQty).toEqual({ gt: 0 });
  });
});