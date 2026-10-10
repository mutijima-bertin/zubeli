/**
 * Storefront buying flow — customer account actions (Phase C, Checkpoint 3).
 *
 * getMyOrdersAction / getMyOrderAction / updateProfileAction run against the
 * REAL auth session resolution (requireUser), the IDOR check in lib/orders
 * (getOrderForUser) and the real DTO mappers, with the DB layer mocked at
 * the prisma singleton (src/lib/db). next/headers is mocked so the
 * zubeli_session cookie drives an in-memory session fixture; next/cache is a
 * no-op. No live DB, no dev server.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session, User } from "@prisma/client";
import { expectError, expectOk } from "../../helpers/assert";

// --- mocks ----------------------------------------------------------------

const m = vi.hoisted(() => {
  const cookieStore: Record<string, string> = {};
  let sessionRow: (Session & { user: User }) | null = null;
  let userRow: User | null = null;
  let orderRow: Record<string, unknown> | null = null;
  const orderRows: Record<string, unknown>[] = [];

  const client = {
    session: {
      findUnique: vi.fn(async () => sessionRow),
      update: vi.fn(async () => ({})),
    },
    user: {
      update: vi.fn(async ({ data }: { data: { name?: string; phone?: string | null } }) => {
        userRow = { ...(userRow as User), ...data };
        return userRow;
      }),
    },
    order: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (orderRow && orderRow.id === where.id ? orderRow : null)),
      findMany: vi.fn(async () => orderRows),
    },
    $transaction: vi.fn(async () => {
      throw new Error("interactive $transaction not expected in account action tests");
    }),
  };

  return {
    cookieStore,
    client,
    reset: () => {
      sessionRow = null;
      userRow = null;
      orderRow = null;
      orderRows.length = 0;
    },
    setSession: (row: (Session & { user: User }) | null) => {
      sessionRow = row;
    },
    setUser: (u: User) => {
      userRow = u;
    },
    setOrder: (o: Record<string, unknown> | null) => {
      orderRow = o;
    },
    setOrderRows: (rows: Record<string, unknown>[]) => {
      orderRows.splice(0, orderRows.length, ...rows);
    },
    clearCookies: () => {
      for (const k of Object.keys(cookieStore)) delete cookieStore[k];
    },
  };
});

vi.mock("@/lib/db", () => ({ prisma: m.client }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (m.cookieStore[name] !== undefined ? { name, value: m.cookieStore[name] } : undefined),
    set: (name: string, value: string) => {
      m.cookieStore[name] = value;
    },
    delete: (name: string) => {
      delete m.cookieStore[name];
    },
  }),
  headers: async () => ({ get: () => null }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { getMyOrderAction, getMyOrdersAction, updateProfileAction } from "@/actions/account";

// --- fixtures + helpers ---------------------------------------------------

const CUSTOMER: User = {
  id: "user-1",
  email: "umutoni@demo.rw",
  passwordHash: "hash",
  name: "Umutoni",
  phone: "+250788123456",
  role: "CUSTOMER",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

/** Signs the in-memory cookie store in as CUSTOMER. */
function signIn() {
  m.cookieStore["zubeli_session"] = "raw-token";
  m.setSession({
    id: "session-1",
    tokenHash: "t",
    userId: CUSTOMER.id,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    lastUsedAt: new Date(Date.now() - 5 * 60 * 1000),
    createdAt: new Date(Date.now() - 60_000),
    updatedAt: new Date(Date.now()),
    user: CUSTOMER,
  });
}

function orderFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    number: "ZBL-00000001",
    status: "PENDING",
    customerId: CUSTOMER.id,
    customerName: "Umutoni",
    customerPhone: "+250788123456",
    customerEmail: "umutoni@demo.rw",
    customerAddress: "KN 5 Rd, Kigali",
    customerCity: "Kigali",
    subtotalCents: 30000,
    deliveryFeeCents: 2000,
    totalCents: 32000,
    currency: "RWF",
    bankTransferReference: null,
    idempotencyKey: "cart-1",
    paidAt: null,
    fulfilledAt: null,
    cancelledAt: null,
    createdAt: new Date("2026-08-01T09:00:00.000Z"),
    updatedAt: new Date("2026-08-01T09:00:00.000Z"),
    items: [
      {
        id: "oi-1",
        orderId: "order-1",
        productId: "p-1",
        productName: "Claw Hammer",
        unitPriceCents: 15000,
        quantity: 2,
        createdAt: new Date("2026-08-01T09:00:00.000Z"),
        updatedAt: new Date("2026-08-01T09:00:00.000Z"),
      },
    ],
    payment: {
      id: "pay-1",
      orderId: "order-1",
      method: "COD_MOBILE_MONEY",
      status: "PENDING",
      amountCents: 32000,
      currency: "RWF",
      confirmedById: null,
      confirmedAt: null,
      createdAt: new Date("2026-08-01T09:00:00.000Z"),
      updatedAt: new Date("2026-08-01T09:00:00.000Z"),
    },
    customer: { id: CUSTOMER.id, email: CUSTOMER.email, name: CUSTOMER.name, phone: CUSTOMER.phone },
    ...overrides,
  };
}

/** Row shape matching the account-history select in src/lib/db/orders.ts. */
function listRowFixture(id: string, overrides: Record<string, unknown> = {}) {
  // Day derived from the FULL numeric portion of the id — unique per id and
  // always-valid ISO (1 + n stays < 32 for realistic n; order-9 → day 10,
  // order-11 → day 12, no "010" day overflow, no order-10/11 date collisions).
  const n = Number(id.match(/\d+$/)?.[0] ?? 1);
  return {
    id,
    number: `ZBL-${id.toUpperCase().replace(/[^0-9]/g, "").padStart(8, "0")}`,
    status: "PENDING",
    totalCents: 32000,
    currency: "RWF",
    createdAt: new Date(Date.UTC(2026, 7, 1 + n, 9)),
    items: [{ productName: "Claw Hammer", quantity: 2, unitPriceCents: 15000 }],
    payment: { method: "COD_CASH", status: "PENDING" },
    ...overrides,
  };
}

beforeEach(() => {
  m.reset();
  m.clearCookies();
  vi.clearAllMocks();
});

// --- tests ----------------------------------------------------------------

describe("getMyOrdersAction (order history)", () => {
  it("returns the page mapped to OrderListItemDTO (newest-first, cursor passthrough)", async () => {
    signIn();
    m.setOrderRows([listRowFixture("order-1"), listRowFixture("order-2", { status: "FULFILLED", payment: { method: "BANK_TRANSFER", status: "PAID" } })]);

    const page = expectOk(await getMyOrdersAction({ cursor: "order-2", limit: 10 }));

    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
    expect(page.hasMore).toBe(false);
    expect(page.items[0]!).toMatchObject({
      number: expect.stringMatching(/^ZBL-/),
      status: "PENDING",
      method: "COD_CASH",
      totalCents: 32000,
      paymentStatus: "PENDING",
      items: [{ productName: "Claw Hammer", quantity: 2, unitPriceCents: 15000, lineTotalCents: 30000 }],
    });
    expect(page.items[1]!.status).toBe("FULFILLED");
    expect(page.items[1]!.method).toBe("BANK_TRANSFER");
    expect(typeof page.items[0]!.createdAt).toBe("string");

    // Cursor + take+1 keyset pagination passed to the repo
    expect(m.client.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerId: "user-1" },
        take: 11,
        cursor: { id: "order-2" },
        skip: 1,
      }),
    );
  });

  it("paginates: take+1 rows → hasMore true + nextCursor = last shown row", async () => {
    signIn();
    m.setOrderRows(Array.from({ length: 11 }, (_, i) => listRowFixture(`order-${i + 1}`)));

    const page = expectOk(await getMyOrdersAction({}));

    expect(page.items).toHaveLength(10);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe(page.items[9]!.id);
  });

  it("requires a session — NOT_AUTHORIZED when signed out", async () => {
    const error = expectError(await getMyOrdersAction({}));
    expect(error.code).toBe("NOT_AUTHORIZED");
    expect(m.client.order.findMany).not.toHaveBeenCalled();
  });

  it("rejects invalid input with VALIDATION", async () => {
    signIn();
    const error = expectError(await getMyOrdersAction({ limit: 0 }));
    expect(error.code).toBe("VALIDATION");
  });
});

describe("getMyOrderAction (order detail)", () => {
  it("returns the OrderDTO + paymentInstructions for the order owner", async () => {
    signIn();
    m.setOrder(orderFixture());

    const dto = expectOk(await getMyOrderAction({ orderId: "order-1" }));

    expect(dto.id).toBe("order-1");
    expect(dto.number).toBe("ZBL-00000001");
    expect(dto.status).toBe("PENDING");
    expect(dto.method).toBe("COD_MOBILE_MONEY");
    expect(dto.items[0]!).toMatchObject({ productName: "Claw Hammer", quantity: 2, lineTotalCents: 30000 });
    expect(dto.totalCents).toBe(32000);
    expect(dto.createdAt).toBe("2026-08-01T09:00:00.000Z");
    expect(dto.payment).toMatchObject({ method: "COD_MOBILE_MONEY", status: "PENDING", amountCents: 32000 });
    expect(dto.paymentInstructions).toEqual({
      title: "Mobile money on delivery",
      steps: expect.arrayContaining(["Pay at the door via MTN MoMo or Airtel Money to +250700000000."]),
    });
  });

  it("returns NOT_FOUND for an unknown order", async () => {
    signIn();
    m.setOrder(null);
    const error = expectError(await getMyOrderAction({ orderId: "order-unknown" }));
    expect(error.code).toBe("NOT_FOUND");
  });

  it("returns NOT_AUTHORIZED for another user's order (IDOR)", async () => {
    signIn();
    m.setOrder(orderFixture({ customerId: "user-other" }));
    const error = expectError(await getMyOrderAction({ orderId: "order-1" }));
    expect(error.code).toBe("NOT_AUTHORIZED");
  });

  it("requires a session — NOT_AUTHORIZED when signed out", async () => {
    m.setOrder(orderFixture());
    const error = expectError(await getMyOrderAction({ orderId: "order-1" }));
    expect(error.code).toBe("NOT_AUTHORIZED");
  });
});

describe("updateProfileAction", () => {
  it("updates name + phone and returns the UserDTO", async () => {
    signIn();
    m.setUser(CUSTOMER);

    const dto = expectOk(await updateProfileAction({ name: "Umutoni Uwase", phone: "+250788000001" }));

    expect(m.client.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { name: "Umutoni Uwase", phone: "+250788000001" },
    });
    expect(dto).toEqual({
      id: "user-1",
      email: "umutoni@demo.rw",
      name: "Umutoni Uwase",
      phone: "+250788000001",
      role: "CUSTOMER",
    });
  });

  it("clears the phone when an empty string is passed", async () => {
    signIn();
    m.setUser(CUSTOMER);
    const dto = expectOk(await updateProfileAction({ phone: "" }));
    expect(m.client.user.update).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { name: undefined, phone: null } });
    expect(dto.phone).toBeNull();
  });

  it("rejects invalid input with VALIDATION (no write)", async () => {
    signIn();
    const error = expectError(await updateProfileAction({ name: "A" }));
    expect(error.code).toBe("VALIDATION");
    expect(m.client.user.update).not.toHaveBeenCalled();
  });

  it("rejects a short phone with VALIDATION", async () => {
    signIn();
    const error = expectError(await updateProfileAction({ phone: "123" }));
    expect(error.code).toBe("VALIDATION");
    expect(m.client.user.update).not.toHaveBeenCalled();
  });

  it("requires a session — NOT_AUTHORIZED when signed out", async () => {
    const error = expectError(await updateProfileAction({ name: "Umutoni" }));
    expect(error.code).toBe("NOT_AUTHORIZED");
    expect(m.client.user.update).not.toHaveBeenCalled();
  });
});
