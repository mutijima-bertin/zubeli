/**
 * Admin category CRUD contract — src/actions/admin/categories.ts +
 * src/lib/db/categories.ts — against the REAL test database
 * (TEST_DATABASE_URL, port 5435). Never the dev DB (5434).
 *
 * Harness mirrors tests/integration/actions.test.ts:
 * - next/headers is mocked (in-memory cookie store + constant
 *   x-forwarded-for TEST_IP, which is what the Postgres rate limiter keys
 *   on) and next/cache is mocked so revalidatePath is a no-op.
 * - The app prisma singleton (src/lib/db) resolves to 5435 via
 *   tests/setup.ts; this file's own `db` client is separate and is used for
 *   fixtures, assertions and cleanup.
 * - OWNER/CUSTOMER session rows are re-upserted before every authenticated
 *   call (`ensureSessions`), so each authenticated action starts from a
 *   session row this file just wrote. The cross-file race this used to guard
 *   against — actions.test.ts TRUNCATEing the whole Session table from its
 *   beforeAll/afterAll while this file's upsert was in flight — is CLOSED at
 *   the source: actions.test.ts now deletes only rows owned by its own
 *   `test-` users (see truncateTransactionalTables there). This file's
 *   `cat-`-namespaced sessions are therefore untouchable by any other worker.
 * - Isolation: every row this file creates carries a `cat-crud-` slug prefix
 *   and the users use `cat-owner-`/`cat-customer-` emails — deliberately NOT
 *   the `test-` prefix actions.test.ts deletes in its own lifecycle — and
 *   everything is removed in afterAll. Rate-limit buckets are scoped to this
 *   file's TEST_IP and cleared in beforeAll/afterAll.
 */
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";
import type { ActionResult } from "@/types/api";
import { expectError, expectOk } from "../helpers/assert";

// --- next/headers + next/cache mocks ----------------------------------------

const req = vi.hoisted(() => {
  const cookieStore: Record<string, string> = {};
  // Constant test IP — the mocked x-forwarded-for value. Rate-limit keys are
  // built from it, so it is also the cleanup key for this file's bucket.
  const TEST_IP = "203.0.113.77";
  return {
    cookieStore,
    TEST_IP,
    setCookie: (name: string, value: string) => {
      cookieStore[name] = value;
    },
    clearCookies: () => {
      for (const k of Object.keys(cookieStore)) delete cookieStore[k];
    },
    cookies: async () => ({
      get: (name: string) => (cookieStore[name] !== undefined ? { name, value: cookieStore[name] } : undefined),
      set: (name: string, value: string) => {
        cookieStore[name] = value;
      },
      delete: (name: string) => {
        delete cookieStore[name];
      },
    }),
    headers: async () => ({ get: (key: string) => (key === "x-forwarded-for" ? TEST_IP : null) }),
  };
});

vi.mock("next/headers", () => ({
  cookies: req.cookies,
  headers: req.headers,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// --- test database ----------------------------------------------------------

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL!;
const db = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });

const RUN = Date.now().toString(36);
const OWNER_TOKEN = `cat-owner-token-${RUN}`;
const CUSTOMER_TOKEN = `cat-customer-token-${RUN}`;
const OWNER_EMAIL = `cat-owner-${RUN}@zubeli.rw`;
const CUSTOMER_EMAIL = `cat-customer-${RUN}@zubeli.rw`;
const OWNER_HASH = createHash("sha256").update(OWNER_TOKEN).digest("hex");
const CUSTOMER_HASH = createHash("sha256").update(CUSTOMER_TOKEN).digest("hex");
const RATE_KEY = `admin-category:${req.TEST_IP}`;

/** Unique slug for a row created by this run (`cat-crud-` = cleanup prefix). */
function slug(name: string): string {
  return `cat-crud-${name}-${RUN}`;
}

let ownerId = "";
let customerId = "";

function fieldErrors(details: unknown): Record<string, string[]> {
  const fe = (details as { fieldErrors?: Record<string, string[]> } | undefined)?.fieldErrors;
  if (!fe || typeof fe !== "object") throw new Error(`expected details.fieldErrors, got ${JSON.stringify(details)}`);
  return fe;
}

const SESSION_EXPIRES = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

/**
 * (Re)create both session rows. Called before every authenticated action so
 * each call runs against a session row this file just wrote (upsert is
 * idempotent). No other worker deletes `cat-`-namespaced sessions any more,
 * so this is cheap insurance rather than a race band-aid.
 */
async function ensureSessions() {
  await Promise.all([
    db.session.upsert({
      where: { tokenHash: OWNER_HASH },
      update: { expiresAt: SESSION_EXPIRES() },
      create: { tokenHash: OWNER_HASH, userId: ownerId, expiresAt: SESSION_EXPIRES() },
    }),
    db.session.upsert({
      where: { tokenHash: CUSTOMER_HASH },
      update: { expiresAt: SESSION_EXPIRES() },
      create: { tokenHash: CUSTOMER_HASH, userId: customerId, expiresAt: SESSION_EXPIRES() },
    }),
  ]);
}

async function asOwner() {
  await ensureSessions();
  req.clearCookies();
  req.setCookie("zubeli_session", OWNER_TOKEN);
}

async function asCustomer() {
  await ensureSessions();
  req.clearCookies();
  req.setCookie("zubeli_session", CUSTOMER_TOKEN);
}

async function asGuest() {
  req.clearCookies();
}

async function clearRateBuckets() {
  await db.$executeRaw`DELETE FROM "RateLimitBucket" WHERE "key" = ${RATE_KEY}`;
}

// --- lifecycle --------------------------------------------------------------

beforeAll(async () => {
  await clearRateBuckets();

  const [owner, customer] = await Promise.all([
    db.user.create({
      data: { email: OWNER_EMAIL, passwordHash: hashSync("OwnerPass2026!", 4), name: "Cat CRUD Owner", role: "OWNER" },
    }),
    db.user.create({
      data: {
        email: CUSTOMER_EMAIL,
        passwordHash: hashSync("CustomerPass2026!", 4),
        name: "Cat CRUD Customer",
        phone: "+250788123457",
        role: "CUSTOMER",
      },
    }),
  ]);
  ownerId = owner.id;
  customerId = customer.id;
  await ensureSessions();
}, 20_000);

afterAll(async () => {
  // FK order: products reference categories (onDelete: Restrict) — delete first.
  await db.product.deleteMany({ where: { slug: { startsWith: "cat-crud-prod-" } } });
  await db.category.deleteMany({ where: { slug: { startsWith: "cat-crud-" } } });
  // …but the auto-derive test's category has NO `cat-crud-` slug (the action
  // derives `power-tools-drills-<RUN>` from the name), so the prefix sweep
  // above missed it and every run leaked one row into 5435. Every category
  // this file creates carries the unique RUN stamp in its name — sweep by that.
  await db.category.deleteMany({ where: { name: { contains: RUN } } });
  await db.session.deleteMany({ where: { tokenHash: { in: [OWNER_HASH, CUSTOMER_HASH] } } });
  await db.user.deleteMany({ where: { id: { in: [ownerId, customerId].filter(Boolean) } } });
  await clearRateBuckets();
  await db.$disconnect();
});

// --- createCategory ---------------------------------------------------------

describe("createCategory", () => {
  it("creates a category for the OWNER (isActive defaults to true, productCount 0)", async () => {
    await asOwner();
    const { createCategory } = await import("@/actions/admin/categories");

    const data = expectOk(await createCategory({ name: `Hammer Crew ${RUN}`, slug: slug("create") }));
    expect(data.name).toBe(`Hammer Crew ${RUN}`);
    expect(data.slug).toBe(slug("create"));
    expect(data.isActive).toBe(true);
    expect(data.productCount).toBe(0);
    expect(data.description).toBeNull();

    const row = await db.category.findUniqueOrThrow({ where: { id: data.id } });
    expect(row.name).toBe(`Hammer Crew ${RUN}`);
    expect(row.isActive).toBe(true);
  });

  it("rejects a missing/blank name with a VALIDATION error and fieldErrors.name", async () => {
    await asOwner();
    const { createCategory } = await import("@/actions/admin/categories");

    const error = expectError(await createCategory({ slug: slug("noname") }));
    expect(error.code).toBe("VALIDATION");
    expect(fieldErrors(error.details).name).toBeDefined();

    const blank = expectError(await createCategory({ name: "   ", slug: slug("blank") }));
    expect(blank.code).toBe("VALIDATION");
    expect(fieldErrors(blank.details).name).toBeDefined();
  });

  it("auto-derives the slug from the name when it is absent", async () => {
    await asOwner();
    const { createCategory } = await import("@/actions/admin/categories");

    const data = expectOk(await createCategory({ name: `Power Tools & Drills ${RUN}` }));
    expect(data.slug).toBe(`power-tools-drills-${RUN}`.toLowerCase());
    const row = await db.category.findUniqueOrThrow({ where: { id: data.id } });
    expect(row.slug).toBe(data.slug);
  });

  it("rejects a duplicate slug with a friendly fieldErrors.slug naming the owner", async () => {
    await asOwner();
    const { createCategory } = await import("@/actions/admin/categories");

    const first = expectOk(await createCategory({ name: `Slug Owner ${RUN}`, slug: slug("dup") }));
    const error = expectError(await createCategory({ name: `Slug Rival ${RUN}`, slug: slug("dup") }));
    expect(error.code).toBe("VALIDATION");
    const messages = fieldErrors(error.details).slug;
    expect(messages).toBeDefined();
    expect(messages![0]).toContain(slug("dup"));
    expect(messages![0]).toContain(`Slug Owner ${RUN}`);

    // only the first category exists — nothing was written on the failed call
    const rows = await db.category.findMany({ where: { slug: slug("dup") } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(first.id);
  });
});

// --- updateCategory ---------------------------------------------------------

describe("updateCategory", () => {
  it("applies a partial update (description only — name and slug untouched)", async () => {
    await asOwner();
    const { createCategory, updateCategory } = await import("@/actions/admin/categories");

    const created = expectOk(await createCategory({ name: `Partial Cat ${RUN}`, slug: slug("partial") }));
    const updated = expectOk(await updateCategory(created.id, { description: "Hand tools" }));

    expect(updated.description).toBe("Hand tools");
    expect(updated.name).toBe(created.name);
    expect(updated.slug).toBe(created.slug);
    expect(updated.isActive).toBe(created.isActive);
  });

  it("renaming without a slug keeps the slug stable and leaves other categories untouched", async () => {
    await asOwner();
    const { createCategory, updateCategory } = await import("@/actions/admin/categories");

    const target = expectOk(await createCategory({ name: `Rename Me ${RUN}`, slug: slug("rename") }));
    const bystander = expectOk(await createCategory({ name: `Bystander ${RUN}`, slug: slug("bystander") }));

    const updated = expectOk(await updateCategory(target.id, { name: `Renamed Category ${RUN}` }));
    expect(updated.name).toBe(`Renamed Category ${RUN}`);
    expect(updated.slug).toBe(slug("rename")); // slug is never silently re-derived on rename

    const untouched = await db.category.findUniqueOrThrow({ where: { id: bystander.id } });
    expect(untouched.name).toBe(`Bystander ${RUN}`);
    expect(untouched.slug).toBe(slug("bystander"));

    // clearing a description with an empty string stores NULL
    const cleared = expectOk(await updateCategory(target.id, { description: "" }));
    expect(cleared.description).toBeNull();
  });

  it("rejects a slug that belongs to another category with fieldErrors.slug", async () => {
    await asOwner();
    const { createCategory, updateCategory } = await import("@/actions/admin/categories");

    await createCategory({ name: `Other Cat ${RUN}`, slug: slug("taken") });
    const mine = expectOk(await createCategory({ name: `My Cat ${RUN}`, slug: slug("mine") }));

    const error = expectError(await updateCategory(mine.id, { slug: slug("taken") }));
    expect(error.code).toBe("VALIDATION");
    expect(fieldErrors(error.details).slug![0]).toContain(slug("taken"));

    // its own row is unchanged
    const row = await db.category.findUniqueOrThrow({ where: { id: mine.id } });
    expect(row.slug).toBe(slug("mine"));
  });

  it("returns NOT_FOUND for an unknown id", async () => {
    await asOwner();
    const { updateCategory } = await import("@/actions/admin/categories");

    const error = expectError(await updateCategory("cat-does-not-exist", { name: `Nope ${RUN}` }));
    expect(error.code).toBe("NOT_FOUND");
  });
});

// --- deleteCategory ---------------------------------------------------------

describe("deleteCategory", () => {
  it("is blocked while products reference the category — message carries the product count", async () => {
    await asOwner();
    const { createCategory, deleteCategory } = await import("@/actions/admin/categories");

    const category = expectOk(await createCategory({ name: `Busy Cat ${RUN}`, slug: slug("busy") }));
    await db.product.create({
      data: {
        name: `Cat CRUD Product ${RUN}`,
        slug: slug("prod"),
        priceCents: 5000,
        categoryId: category.id,
        stockQty: 3,
        isPublished: true,
      },
    });

    const error = expectError(await deleteCategory(category.id));
    expect(error.code).toBe("VALIDATION");
    expect(error.message).toContain("1 product");
    expect(error.message).toContain("Reassign");

    // the category still exists (never silently cascaded / orphaned)
    const row = await db.category.findUnique({ where: { id: category.id } });
    expect(row).not.toBeNull();
  });

  it("deletes a product-free category", async () => {
    await asOwner();
    const { createCategory, deleteCategory } = await import("@/actions/admin/categories");

    const category = expectOk(await createCategory({ name: `Empty Cat ${RUN}`, slug: slug("empty") }));
    expectOk(await deleteCategory(category.id));

    const row = await db.category.findUnique({ where: { id: category.id } });
    expect(row).toBeNull();
  });

  it("returns NOT_FOUND for an unknown id", async () => {
    await asOwner();
    const { deleteCategory } = await import("@/actions/admin/categories");

    const error = expectError(await deleteCategory("cat-does-not-exist"));
    expect(error.code).toBe("NOT_FOUND");
  });
});

// --- toggleCategoryActive ---------------------------------------------------

describe("toggleCategoryActive", () => {
  it("flips active → inactive and persists", async () => {
    await asOwner();
    const { createCategory, toggleCategoryActive } = await import("@/actions/admin/categories");

    const created = expectOk(await createCategory({ name: `Toggle A ${RUN}`, slug: slug("toggle-a") }));
    expect(created.isActive).toBe(true);

    const toggled = expectOk(await toggleCategoryActive(created.id));
    expect(toggled.isActive).toBe(false);
    expect((await db.category.findUniqueOrThrow({ where: { id: created.id } })).isActive).toBe(false);
  });

  it("flips inactive → active and persists", async () => {
    await asOwner();
    const { createCategory, toggleCategoryActive } = await import("@/actions/admin/categories");

    const created = expectOk(await createCategory({ name: `Toggle B ${RUN}`, slug: slug("toggle-b"), isActive: false }));
    expect(created.isActive).toBe(false);

    const toggled = expectOk(await toggleCategoryActive(created.id));
    expect(toggled.isActive).toBe(true);
    expect((await db.category.findUniqueOrThrow({ where: { id: created.id } })).isActive).toBe(true);
  });

  it("returns NOT_FOUND for an unknown id", async () => {
    await asOwner();
    const { toggleCategoryActive } = await import("@/actions/admin/categories");

    const error = expectError(await toggleCategoryActive("cat-does-not-exist"));
    expect(error.code).toBe("NOT_FOUND");
  });
});

// --- authorization ----------------------------------------------------------

describe("authorization (all four mutations)", () => {
  type Mutation = { label: string; run: (actions: typeof import("@/actions/admin/categories")) => Promise<ActionResult<unknown>> };

  const mutations: Mutation[] = [
    { label: "createCategory", run: (a) => a.createCategory({ name: `Auth Cat ${RUN}`, slug: slug("auth") }) },
    { label: "updateCategory", run: (a) => a.updateCategory("any-id", { name: `Auth Cat ${RUN}` }) },
    { label: "deleteCategory", run: (a) => a.deleteCategory("any-id") },
    { label: "toggleCategoryActive", run: (a) => a.toggleCategoryActive("any-id") },
  ];

  it("rejects every mutation with no session (401 — 'You must be signed in')", async () => {
    const actions = await import("@/actions/admin/categories");
    await asGuest();

    for (const mutation of mutations) {
      const error = expectError(await mutation.run(actions));
      expect(error.code, mutation.label).toBe("NOT_AUTHORIZED");
      expect(error.message, mutation.label).toBe("You must be signed in");
    }
  });

  it("rejects every mutation for a CUSTOMER session (403 — 'Admin access required')", async () => {
    const actions = await import("@/actions/admin/categories");
    await asCustomer();

    for (const mutation of mutations) {
      const error = expectError(await mutation.run(actions));
      expect(error.code, mutation.label).toBe("NOT_AUTHORIZED");
      expect(error.message, mutation.label).toBe("Admin access required");
    }

    // rejected before any write
    const rows = await db.category.findMany({ where: { slug: slug("auth") } });
    expect(rows).toHaveLength(0);
  });
});

// --- storefront visibility --------------------------------------------------

describe("storefront visibility of inactive categories", () => {
  it("excludes an inactive category from listAll() but still lists it via listCategoriesForAdmin()", async () => {
    await asOwner();
    const { createCategory, toggleCategoryActive } = await import("@/actions/admin/categories");
    const { listAll, listCategoriesForAdmin } = await import("@/lib/db/categories");

    const shown = expectOk(await createCategory({ name: `Shown Cat ${RUN}`, slug: slug("shown") }));
    const hidden = expectOk(await createCategory({ name: `Hidden Cat ${RUN}`, slug: slug("hidden") }));
    expectOk(await toggleCategoryActive(hidden.id));

    const storefront = await listAll();
    expect(storefront.some((c) => c.id === shown.id)).toBe(true);
    expect(storefront.some((c) => c.id === hidden.id)).toBe(false);
    // active-only is enforced in the query, not post-filtered by callers
    expect(storefront.every((c) => typeof c.productCount === "number")).toBe(true);

    const admin = await listCategoriesForAdmin();
    const hiddenRow = admin.find((c) => c.id === hidden.id);
    const shownRow = admin.find((c) => c.id === shown.id);
    expect(hiddenRow).toBeDefined();
    expect(hiddenRow!.isActive).toBe(false);
    expect(shownRow!.isActive).toBe(true);
    expect(admin.every((c) => typeof c.productCount === "number")).toBe(true);

    // getCategoryById exposes the same admin shape
    const byId = await import("@/lib/db/categories").then((m) => m.getCategoryById(hidden.id));
    expect(byId?.isActive).toBe(false);
    expect(await import("@/lib/db/categories").then((m) => m.getCategoryById("nope"))).toBeNull();
  });
});
