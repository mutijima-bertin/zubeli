/**
 * Admin product operations (src/lib/products-admin.ts): the slug-collision
 * guard (friendly ValidationError BEFORE the DB partial unique index — only
 * LIVE rows conflict, soft-deleted slugs are reusable), the initial-stock
 * ledger on create, and NotFound on unknown ids. Prisma is mocked
 * (vi.mock('@/lib/db')) — no DB.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryReason, InventoryMovementType } from "@prisma/client";
import { createProduct, slugConflictMessage, updateProduct } from "@/lib/products-admin";
import { NotFoundError, ValidationError } from "@/lib/errors";

const SLUG = "claw-hammer";

type Row = {
  id: string;
  name: string;
  slug: string;
  deletedAt: Date | null;
  stockQty: number;
  categoryId: string;
};

// --- mocked prisma ---------------------------------------------------------

const m = vi.hoisted(() => {
  let rows: Row[] = [];

  const client = {
    product: {
      findUnique: vi.fn(async (args: { where: { id: string } }) =>
        rows.find((row) => row.id === args.where.id) ?? null,
      ),
      // Evaluates the exact where predicates the guard uses: slug equality,
      // deletedAt === null, id !== excluded id.
      findFirst: vi.fn(async (args: { where: Record<string, unknown> }) => {
        const where = args.where;
        const idNot = (where.id as { not?: string } | undefined)?.not;
        const row = rows.find(
          (r) =>
            (where.slug === undefined || r.slug === where.slug) &&
            (where.deletedAt === undefined || r.deletedAt === where.deletedAt) &&
            (idNot === undefined || r.id !== idNot),
        );
        return row ?? null;
      }),
      create: vi.fn(async (args: { data: Partial<Row> }) => ({
        id: "p-new",
        name: args.data.name ?? "New product",
        slug: args.data.slug ?? SLUG,
        stockQty: args.data.stockQty ?? 0,
        categoryId: args.data.categoryId ?? "c-tools",
        deletedAt: null,
        category: { id: "c-tools", slug: "tools", name: "Tools" },
      })),
      update: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        const current = rows.find((r) => r.id === args.where.id) ?? ({} as Row);
        return { ...current, ...args.data, deletedAt: null, category: { id: "c-tools", slug: "tools", name: "Tools" } };
      }),
    },
    inventoryMovement: { create: vi.fn(async (args: unknown) => args) },
    $transaction: vi.fn(async (arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg as Promise<unknown>[]);
      const fn = arg as (tx: unknown) => Promise<unknown>;
      return fn(client);
    }),
  };

  return {
    client,
    setRows: (next: Row[]) => {
      rows = next;
    },
  };
});

vi.mock("@/lib/db", () => ({ prisma: m.client }));

beforeEach(() => {
  vi.clearAllMocks();
  m.setRows([]);
});

// --- fixtures ---------------------------------------------------------------

function liveRow(overrides: Partial<Row> = {}): Row {
  return {
    id: "p-live",
    name: "Claw Hammer 500g",
    slug: SLUG,
    deletedAt: null,
    stockQty: 10,
    categoryId: "c-tools",
    ...overrides,
  };
}

function createInput(overrides: Partial<Parameters<typeof createProduct>[0]> = {}) {
  return {
    name: "Hammer Deluxe",
    slug: SLUG,
    description: "A hammer",
    priceCents: 5000,
    categoryId: "c-tools",
    stockQty: 4,
    lowStockThreshold: 5,
    isPublished: true,
    featured: false,
    imageUrls: [],
    ...overrides,
  };
}

const expectedMessage = slugConflictMessage("Claw Hammer 500g", SLUG);

// --- tests ------------------------------------------------------------------

describe("slugConflictMessage", () => {
  it("formats the exact friendly copy with curly quotes", () => {
    expect(slugConflictMessage("Claw Hammer 500g", SLUG)).toBe(
      `A product named \u201cClaw Hammer 500g\u201d already uses the slug \u201cclaw-hammer\u201d. Delete it or pick a different slug.`,
    );
  });
});

describe("createProduct — slug collision guard", () => {
  it("throws a friendly ValidationError when a LIVE product owns the slug (before create)", async () => {
    m.setRows([liveRow()]);
    const promise = createProduct(createInput({ name: "Hammer Deluxe" }));
    await expect(promise).rejects.toBeInstanceOf(ValidationError);
    await expect(promise).rejects.toMatchObject({
      code: "VALIDATION",
      message: expectedMessage,
      details: { fieldErrors: { slug: [expectedMessage] } },
    });
    expect(m.client.product.create).not.toHaveBeenCalled();
  });

  it("reuses a soft-deleted slug (partial unique index) and creates successfully", async () => {
    m.setRows([liveRow({ deletedAt: new Date("2026-01-01T00:00:00.000Z"), name: "Old Hammer" })]);
    const product = await createProduct(createInput());

    expect(product.id).toBe("p-new");
    expect(m.client.product.findFirst).toHaveBeenCalledWith({
      where: { slug: SLUG, deletedAt: null },
      select: { name: true },
    });
    // Initial stock writes a RESTOCK ledger entry.
    expect(m.client.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productId: "p-new",
          type: InventoryMovementType.IN,
          reason: InventoryReason.RESTOCK,
          quantity: 4,
        }),
      }),
    );
  });

  it("creates with no ledger when initial stock is 0", async () => {
    m.setRows([]);
    const product = await createProduct(createInput({ stockQty: 0 }));
    expect(product.id).toBe("p-new");
    expect(m.client.inventoryMovement.create).not.toHaveBeenCalled();
  });
});

describe("updateProduct — slug collision guard", () => {
  it("throws a friendly ValidationError when the new slug belongs to another LIVE product", async () => {
    m.setRows([
      liveRow({ id: "p-edited", name: "My Own Hammer", slug: "my-own-hammer" }),
      liveRow({ id: "p-other", name: "Claw Hammer 500g" }),
    ]);

    const promise = updateProduct("p-edited", { slug: SLUG });
    await expect(promise).rejects.toBeInstanceOf(ValidationError);
    await expect(promise).rejects.toMatchObject({
      code: "VALIDATION",
      message: expectedMessage,
      details: { fieldErrors: { slug: [expectedMessage] } },
    });
    // Guard ran with the self-exclusion — update never fired.
    expect(m.client.product.findFirst).toHaveBeenCalledWith({
      where: { slug: SLUG, deletedAt: null, id: { not: "p-edited" } },
      select: { name: true },
    });
    expect(m.client.product.update).not.toHaveBeenCalled();
  });

  it("keeps its own slug — no guard query, update succeeds", async () => {
    m.setRows([liveRow({ id: "p-edited", name: "My Own Hammer" })]);
    const product = await updateProduct("p-edited", { slug: SLUG });
    expect(product.slug).toBe(SLUG);
    expect(m.client.product.findFirst).not.toHaveBeenCalled();
    expect(m.client.product.update).toHaveBeenCalledTimes(1);
  });

  it("switches to a free slug (no live owner) and updates", async () => {
    m.setRows([liveRow({ id: "p-edited", slug: "old-slug" })]);
    const product = await updateProduct("p-edited", { slug: "fresh-slug" });
    expect(product.slug).toBe("fresh-slug");
  });

  it("ignores soft-deleted owners of the target slug", async () => {
    m.setRows([
      liveRow({ id: "p-edited", name: "Edited", slug: "edited" }),
      liveRow({ id: "p-dead", name: "Dead Product", slug: SLUG, deletedAt: new Date("2026-01-01T00:00:00.000Z") }),
    ]);
    const product = await updateProduct("p-edited", { slug: SLUG });
    expect(product.slug).toBe(SLUG);
    expect(product.id).toBe("p-edited");
  });

  it("throws NotFoundError for an unknown product id", async () => {
    const promise = updateProduct("missing", { slug: SLUG });
    await expect(promise).rejects.toBeInstanceOf(NotFoundError);
    expect(m.client.product.findFirst).not.toHaveBeenCalled();
  });
});