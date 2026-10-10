/**
 * Notification helpers (src/lib/notifications.ts) — fail-soft insert contract:
 * notify* NEVER throw into the caller even when prisma fails. Prisma is
 * mocked (vi.mock('@/lib/db')) — no DB.
 *
 * Covered:
 * - notifyUser happy path + body/link defaulting (null)
 * - notifyUser fail-soft (create throws -> resolves, error logged)
 * - notifyOwners fans out to every OWNER row; fail-soft on lookup failure
 * - notifyOrderCustomer notifies the owner of the order; guest (no userId) skips
 * - notifyOrderOwners delegates to notifyOwners
 * - toNotificationDTO: ISO strings, nullable readAt
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Notification } from "@prisma/client";
import {
  notifyOrderCustomer,
  notifyOrderOwners,
  notifyOwners,
  notifyUser,
  toNotificationDTO,
} from "@/lib/notifications";

// --- mocked prisma ---------------------------------------------------------

type MockPrisma = {
  notification: { create: ReturnType<typeof vi.fn> };
  user: { findMany: ReturnType<typeof vi.fn> };
};

const m = vi.hoisted(() => {
  const notifyCreate = vi.fn(async (args: unknown) => args);
  const client = {
    notification: { create: notifyCreate },
    user: {
      findMany: vi.fn(async () => [
        { id: "owner-1" },
        { id: "owner-2" },
      ]),
    },
  } as unknown as MockPrisma;
  return { client };
});

vi.mock("@/lib/db", () => ({ prisma: m.client }));

const NOTIFICATION: Notification = {
  id: "n-1",
  userId: "user-1",
  type: "NEW_ORDER",
  title: "New order ZBL-00000001",
  body: "Cash on delivery for 32,000 RWF",
  link: "/admin/orders/order-1",
  readAt: null,
  createdAt: new Date("2026-08-09T09:00:00.000Z"),
};

let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null;

function expectNoThrow(promise: Promise<unknown>): Promise<unknown> {
  return expect(promise).resolves.toBeUndefined();
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  consoleErrorSpy?.mockRestore();
  consoleErrorSpy = null;
});

// --- notifyUser ------------------------------------------------------------

describe("notifyUser", () => {
  it("creates a notification row with the given data", async () => {
    await notifyUser("user-1", {
      type: "NEW_ORDER",
      title: "New order ZBL-00000001",
      body: "Cash on delivery for 32,000 RWF",
      link: "/admin/orders/order-1",
    });
    expect(m.client.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        type: "NEW_ORDER",
        title: "New order ZBL-00000001",
        body: "Cash on delivery for 32,000 RWF",
        link: "/admin/orders/order-1",
      },
    });
  });

  it("defaults optional body and link to null", async () => {
    await notifyUser("user-1", { type: "LOW_STOCK", title: "Low stock: Hammer" });
    expect(m.client.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        type: "LOW_STOCK",
        title: "Low stock: Hammer",
        body: null,
        link: null,
      },
    });
  });

  it("FAIL-SOFT: a create error logs and never throws into the caller", async () => {
    m.client.notification.create.mockRejectedValueOnce(new Error("db down"));
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expectNoThrow(notifyUser("user-1", { type: "ORDER_STATUS", title: "x" }));
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

// --- notifyOwners ----------------------------------------------------------

describe("notifyOwners", () => {
  it("notifies every OWNER-role user", async () => {
    await notifyOwners({ type: "NEW_ORDER", title: "New order ZBL-1", link: "/admin/orders/o1" });
    expect(m.client.user.findMany).toHaveBeenCalledWith({
      where: { role: "OWNER" },
      select: { id: true },
    });
    expect(m.client.notification.create).toHaveBeenCalledTimes(2);
    expect(m.client.notification.create.mock.calls[0]![0]!.data.userId).toBe("owner-1");
    expect(m.client.notification.create.mock.calls[1]![0]!.data.userId).toBe("owner-2");
  });

  it("FAIL-SOFT: an owner-lookup failure never throws into the caller", async () => {
    m.client.user.findMany.mockRejectedValueOnce(new Error("db down"));
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expectNoThrow(notifyOwners({ type: "NEW_ORDER", title: "x" }));
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

// --- notifyOrderCustomer / notifyOrderOwners --------------------------------

describe("notifyOrderCustomer", () => {
  it("notifies the customer attached to the order", async () => {
    await notifyOrderCustomer({ customerId: "user-9" }, { type: "ORDER_STATUS", title: "t", link: "/l" });
    expect(m.client.notification.create).toHaveBeenCalledWith({
      data: { userId: "user-9", type: "ORDER_STATUS", title: "t", body: null, link: "/l" },
    });
  });

  it("skips silently for guest orders (no userId)", async () => {
    await notifyOrderCustomer({ customerId: null }, { type: "ORDER_STATUS", title: "t" });
    expect(m.client.notification.create).not.toHaveBeenCalled();
  });
});

describe("notifyOrderOwners", () => {
  it("delegates to notifyOwners (admins at order placement)", async () => {
    await notifyOrderOwners({ id: "order-1" }, { type: "NEW_ORDER", title: "New order Z-1" });
    expect(m.client.user.findMany).toHaveBeenCalledWith({
      where: { role: "OWNER" },
      select: { id: true },
    });
  });
});

// --- toNotificationDTO -----------------------------------------------------

describe("toNotificationDTO", () => {
  it("maps ISO strings and nullable readAt", () => {
    const row: Notification = {
      ...NOTIFICATION,
      type: "NEW_ORDER",
      body: null,
      link: null,
      readAt: null,
      createdAt: new Date("2026-08-09T09:00:00.000Z"),
    };
    expect(toNotificationDTO(row)).toEqual({
      id: "n-1",
      type: "NEW_ORDER",
      title: "New order ZBL-00000001",
      body: null,
      link: null,
      readAt: null,
      createdAt: "2026-08-09T09:00:00.000Z",
    });
  });

  it("keeps a readAt timestamp as ISO", () => {
    const dto = toNotificationDTO({ ...NOTIFICATION, readAt: new Date("2026-08-09T10:00:00.000Z") });
    expect(dto.readAt).toBe("2026-08-09T10:00:00.000Z");
    expect(dto.createdAt).toBe("2026-08-09T09:00:00.000Z");
  });
});