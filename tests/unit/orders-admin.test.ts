/**
 * Admin order transition matrix (src/lib/orders-admin.ts) — the only writer
 * of OrderStatus (ADR 0003, task-spec widened):
 *   PENDING → PAID (confirm, BANK_TRANSFER requires reference)
 *   PENDING|PAID → CANCELLED (restock IN/CANCEL)
 *   PAID → FULFILLED
 *   PAID|FULFILLED → REFUNDED (restock IN/RETURN)
 * Invalid transitions throw InvalidTransitionError; unknown orders throw
 * NotFoundError. Prisma is mocked (vi.mock('@/lib/db')) — no DB.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryReason, OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import {
  assertTransition,
  cancelOrder,
  confirmOrderPayment,
  fulfillOrder,
  getOrderAdmin,
  listOrdersAdmin,
  refundOrder,
} from "@/lib/orders-admin";
import { InvalidTransitionError, NotFoundError, ValidationError } from "@/lib/errors";
import type { User } from "@prisma/client";

// --- mocked prisma ---------------------------------------------------------

const m = vi.hoisted(() => {
  let orderRow: Record<string, unknown> | null = null;
  const client = {
    order: {
      findUnique: vi.fn(() => orderRow),
      findMany: vi.fn(async () => []),
      update: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        orderRow = orderRow ? { ...orderRow, ...args.data } : orderRow;
        return orderRow;
      }),
    },
    payment: { update: vi.fn(async (args: unknown) => args) },
    product: { update: vi.fn(async (args: unknown) => args) },
    inventoryMovement: { create: vi.fn(async (args: unknown) => args) },
    $transaction: vi.fn(async (arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg as Promise<unknown>[]);
      const fn = arg as (tx: unknown) => Promise<unknown>;
      return fn(client);
    }),
  };
  return {
    client,
    setOrder: (row: Record<string, unknown> | null) => {
      orderRow = row;
    },
  };
});

vi.mock("@/lib/db", () => ({ prisma: m.client }));

const ADMIN: User = {
  id: "admin-1",
  email: "owner@zubeli.rw",
  passwordHash: "h",
  name: "Owner",
  phone: null,
  role: "OWNER",
  createdAt: new Date(),
  updatedAt: new Date(),
};

type ItemRow = {
  id: string;
  orderId: string;
  productId: string | null;
  productName: string;
  unitPriceCents: number;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
};

type PaymentRow = {
  id: string;
  orderId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amountCents: number;
  currency: string;
  providerPaymentId: string | null;
  confirmedById: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function orderFixture(overrides: {
  status?: OrderStatus;
  method?: PaymentMethod;
  bankTransferReference?: string | null;
  items?: ItemRow[];
  payment?: PaymentRow | null;
} = {}): Record<string, unknown> {
  const method = overrides.method ?? PaymentMethod.COD_CASH;
  const items =
    overrides.items ??
    ([
      { id: "item-1", orderId: "order-1", productId: "prod-1", productName: "Hammer 16oz", unitPriceCents: 15000, quantity: 2, createdAt: new Date(), updatedAt: new Date() },
    ] as ItemRow[]);
  const now = new Date();
  return {
    id: "order-1",
    number: "ZBL-00000001",
    status: overrides.status ?? OrderStatus.PENDING,
    customerId: null,
    customerName: "Umutoni Alice",
    customerPhone: "+250788123456",
    customerEmail: null,
    customerAddress: "KN 5 Rd",
    customerCity: "Kigali",
    subtotalCents: 30000,
    deliveryFeeCents: 2000,
    totalCents: 32000,
    currency: "RWF",
    bankTransferReference: overrides.bankTransferReference ?? null,
    idempotencyKey: null,
    paidAt: null,
    fulfilledAt: null,
    cancelledAt: null,
    createdAt: now,
    updatedAt: now,
    items,
    payment:
      overrides.payment === undefined
        ? ({
            id: "pay-1",
            orderId: "order-1",
            method,
            status: PaymentStatus.PENDING,
            amountCents: 32000,
            currency: "RWF",
            providerPaymentId: null,
            confirmedById: null,
            confirmedAt: null,
            createdAt: now,
            updatedAt: now,
          } as PaymentRow)
        : overrides.payment,
    customer: { id: "user-1", email: "alice@zubeli.rw", name: "Umutoni Alice", phone: "+250788123456" },
  };
}

beforeEach(() => {
  m.setOrder(null);
  vi.clearAllMocks();
});

// --- transition matrix ------------------------------------------------------

describe("assertTransition — allowed moves", () => {
  const allowed: [OrderStatus, OrderStatus][] = [
    [OrderStatus.PENDING, OrderStatus.PAID],
    [OrderStatus.PENDING, OrderStatus.CANCELLED],
    [OrderStatus.PAID, OrderStatus.FULFILLED],
    [OrderStatus.PAID, OrderStatus.CANCELLED],
    [OrderStatus.PAID, OrderStatus.REFUNDED],
    [OrderStatus.FULFILLED, OrderStatus.REFUNDED],
  ];
  for (const [from, to] of allowed) {
    it(`${from} → ${to} is allowed`, () => {
      expect(() => assertTransition(from, to)).not.toThrow();
    });
  }
});

describe("assertTransition — illegal moves", () => {
  const illegal: [OrderStatus, OrderStatus][] = [
    [OrderStatus.PENDING, OrderStatus.FULFILLED],
    [OrderStatus.PENDING, OrderStatus.REFUNDED],
    [OrderStatus.PAID, OrderStatus.PAID],
    [OrderStatus.FULFILLED, OrderStatus.PAID],
    [OrderStatus.FULFILLED, OrderStatus.CANCELLED],
    [OrderStatus.CANCELLED, OrderStatus.PAID],
    [OrderStatus.CANCELLED, OrderStatus.PENDING],
    [OrderStatus.CANCELLED, OrderStatus.REFUNDED],
    [OrderStatus.REFUNDED, OrderStatus.PENDING],
    [OrderStatus.REFUNDED, OrderStatus.PAID],
    [OrderStatus.REFUNDED, OrderStatus.FULFILLED],
  ];
  for (const [from, to] of illegal) {
    it(`${from} → ${to} throws InvalidTransitionError`, () => {
      try {
        assertTransition(from, to);
        expect.unreachable(`expected ${from} → ${to} to be rejected`);
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidTransitionError);
        if (error instanceof InvalidTransitionError) {
          expect(error.code).toBe("INVALID_TRANSITION");
          expect(error.httpStatus).toBe(409);
          expect(error.details).toEqual({ from, to });
        }
      }
    });
  }
});

// --- confirmOrderPayment (PENDING → PAID) ----------------------------------

describe("confirmOrderPayment", () => {
  it("confirms a COD order: payment PAID + confirmedBy, order PAID + paidAt", async () => {
    m.setOrder(orderFixture({ status: OrderStatus.PENDING, method: PaymentMethod.COD_CASH }));
    const result = await confirmOrderPayment("order-1", ADMIN);

    expect(m.client.payment.update).toHaveBeenCalledWith({
      where: { orderId: "order-1" },
      data: { status: PaymentStatus.PAID, confirmedById: ADMIN.id, confirmedAt: expect.any(Date) },
    });
    expect(m.client.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: OrderStatus.PAID, paidAt: expect.any(Date) },
    });
    // the fake merges the update into the row, and confirm refetches before returning
    expect(result.status).toBe(OrderStatus.PAID);
    expect(result.id).toBe("order-1");
  });

  it("requires bankTransferReference for BANK_TRANSFER orders", async () => {
    m.setOrder(orderFixture({ status: OrderStatus.PENDING, method: PaymentMethod.BANK_TRANSFER, bankTransferReference: null }));
    await expect(confirmOrderPayment("order-1", ADMIN)).rejects.toBeInstanceOf(ValidationError);
    expect(m.client.order.update).not.toHaveBeenCalled();
  });

  it("confirms a BANK_TRANSFER order carrying a reference", async () => {
    m.setOrder(orderFixture({ status: OrderStatus.PENDING, method: PaymentMethod.BANK_TRANSFER, bankTransferReference: "TRF-8820136" }));
    const result = await confirmOrderPayment("order-1", ADMIN);
    expect(result.status).toBe(OrderStatus.PAID);
    expect(m.client.payment.update).toHaveBeenCalledOnce();
  });

  it("throws NotFoundError when the order is missing", async () => {
    await expect(confirmOrderPayment("missing", ADMIN)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError when the payment row is missing", async () => {
    m.setOrder(orderFixture({ status: OrderStatus.PENDING, payment: null }));
    await expect(confirmOrderPayment("order-1", ADMIN)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects confirm on a PAID order (no PAID → PAID move)", async () => {
    m.setOrder(orderFixture({ status: OrderStatus.PAID }));
    await expect(confirmOrderPayment("order-1", ADMIN)).rejects.toBeInstanceOf(InvalidTransitionError);
    expect(m.client.payment.update).not.toHaveBeenCalled();
  });
});

// --- fulfillOrder (PAID → FULFILLED) ---------------------------------------

describe("fulfillOrder", () => {
  it("fulfills a PAID order", async () => {
    m.setOrder(orderFixture({ status: OrderStatus.PAID }));
    const result = await fulfillOrder("order-1");
    expect(result.status).toBe(OrderStatus.FULFILLED);
    expect(m.client.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: OrderStatus.FULFILLED, fulfilledAt: expect.any(Date) },
    });
  });

  it("rejects fulfill on a PENDING order", async () => {
    m.setOrder(orderFixture({ status: OrderStatus.PENDING }));
    await expect(fulfillOrder("order-1")).rejects.toBeInstanceOf(InvalidTransitionError);
    expect(m.client.order.update).not.toHaveBeenCalled();
  });
});

// --- cancelOrder (PENDING|PAID → CANCELLED, restock IN/CANCEL) -------------

describe("cancelOrder", () => {
  it("cancels a PENDING order: payment FAILED, restock IN/CANCEL with ledger", async () => {
    m.setOrder(orderFixture({ status: OrderStatus.PENDING }));
    const result = await cancelOrder("order-1");

    expect(m.client.payment.update).toHaveBeenCalledWith({
      where: { orderId: "order-1" },
      data: { status: PaymentStatus.FAILED, confirmedById: null, confirmedAt: null },
    });
    expect(m.client.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: OrderStatus.CANCELLED, cancelledAt: expect.any(Date) },
    });
    // restock: stock incremented by the full item quantity
    expect(m.client.product.update).toHaveBeenCalledWith({
      where: { id: "prod-1" },
      data: { stockQty: { increment: 2 } },
    });
    expect(m.client.inventoryMovement.create).toHaveBeenCalledWith({
      data: {
        productId: "prod-1",
        type: "IN",
        reason: InventoryReason.CANCEL,
        quantity: 2,
        orderId: "order-1",
        note: "Order ZBL-00000001 (cancel)",
      },
    });
    expect(result.status).toBe(OrderStatus.CANCELLED);
  });

  it("cancels a PAID order (paid-but-unfulfilled money never changed hands)", async () => {
    m.setOrder(orderFixture({ status: OrderStatus.PAID }));
    await expect(cancelOrder("order-1")).resolves.toMatchObject({ status: OrderStatus.CANCELLED });
  });

  it("skips restock for hard-deleted products (productId null)", async () => {
    m.setOrder(
      orderFixture({
        status: OrderStatus.PENDING,
        items: [
          { id: "item-1", orderId: "order-1", productId: null, productName: "Old Product", unitPriceCents: 500, quantity: 1, createdAt: new Date(), updatedAt: new Date() },
        ],
      }),
    );
    await cancelOrder("order-1");
    expect(m.client.product.update).not.toHaveBeenCalled();
    expect(m.client.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it("rejects cancel on a FULFILLED order", async () => {
    m.setOrder(orderFixture({ status: OrderStatus.FULFILLED }));
    await expect(cancelOrder("order-1")).rejects.toBeInstanceOf(InvalidTransitionError);
  });

  it("rejects cancel on an already-cancelled order (terminal)", async () => {
    m.setOrder(orderFixture({ status: OrderStatus.CANCELLED }));
    await expect(cancelOrder("order-1")).rejects.toBeInstanceOf(InvalidTransitionError);
  });
});

// --- refundOrder (PAID|FULFILLED → REFUNDED, restock IN/RETURN) -------------

describe("refundOrder", () => {
  it("refunds a PAID order: payment REFUNDED, restock IN/RETURN with ledger", async () => {
    m.setOrder(orderFixture({ status: OrderStatus.PAID }));
    const result = await refundOrder("order-1");

    expect(m.client.payment.update).toHaveBeenCalledWith({
      where: { orderId: "order-1" },
      data: { status: PaymentStatus.REFUNDED },
    });
    expect(m.client.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: OrderStatus.REFUNDED },
    });
    expect(m.client.product.update).toHaveBeenCalledWith({
      where: { id: "prod-1" },
      data: { stockQty: { increment: 2 } },
    });
    expect(m.client.inventoryMovement.create).toHaveBeenCalledWith({
      data: {
        productId: "prod-1",
        type: "IN",
        reason: InventoryReason.RETURN,
        quantity: 2,
        orderId: "order-1",
        note: "Order ZBL-00000001 (return)",
      },
    });
    expect(result.status).toBe(OrderStatus.REFUNDED);
  });

  it("refunds a FULFILLED order", async () => {
    m.setOrder(orderFixture({ status: OrderStatus.FULFILLED }));
    await expect(refundOrder("order-1")).resolves.toMatchObject({ status: OrderStatus.REFUNDED });
  });

  it("rejects refund on a PENDING order", async () => {
    m.setOrder(orderFixture({ status: OrderStatus.PENDING }));
    await expect(refundOrder("order-1")).rejects.toBeInstanceOf(InvalidTransitionError);
    expect(m.client.order.update).not.toHaveBeenCalled();
  });
});

// --- read wrappers ---------------------------------------------------------

describe("admin read wrappers", () => {
  it("getOrderAdmin returns the order detail", async () => {
    m.setOrder(orderFixture({ status: OrderStatus.PAID }));
    const order = await getOrderAdmin("order-1");
    expect(order.id).toBe("order-1");
    expect(order.status).toBe(OrderStatus.PAID);
  });

  it("getOrderAdmin throws NotFoundError for unknown orders", async () => {
    await expect(getOrderAdmin("missing")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("listOrdersAdmin delegates to the db repo (cursor page shape)", async () => {
    const page = await listOrdersAdmin({ limit: 5 });
    expect(page).toMatchObject({ items: [], nextCursor: null, hasMore: false });
    expect(m.client.order.findMany).toHaveBeenCalledOnce();
  });
});
