/**
 * Auth primitives (src/lib/auth/*):
 * - password: bcryptjs hash/verify (rounds from env — pinned to 4 in setup)
 * - session-token: sha256(token) hex, cookie name / TTL / rotation constants
 * - session: cookie policy (httpOnly, sameSite lax, 30d), getSession
 *   rotation/throttle, requireUser/requireAdmin (401 no session, 403 non-owner)
 * Prisma and next/headers are mocked — no DB, no request scope.
 */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@prisma/client";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  ROTATE_AFTER_MS,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  hashSessionToken,
  newSessionToken,
} from "@/lib/auth/session-token";
import { createSession, destroySession, getSession, requireAdmin, requireUser } from "@/lib/auth/session";
import { assertAdmin } from "@/lib/auth/guards";
import { NotAuthorizedError } from "@/lib/errors";

// --- mocks ----------------------------------------------------------------

type MockPrisma = {
  session: {
    findUnique: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

const m = vi.hoisted(() => {
  const cookieStore: Record<string, string> = {};
  const setCalls: { name: string; value: string; options?: Record<string, unknown> }[] = [];
  let sessionRow: unknown = null;
  const client = {
    session: {
      findUnique: vi.fn(() => sessionRow),
      deleteMany: vi.fn(async () => ({ count: 1 })),
      create: vi.fn(async (args: unknown) => args),
      delete: vi.fn(async () => ({})),
      update: vi.fn(async (args: unknown) => args),
    },
    $transaction: vi.fn(async (arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg as Promise<unknown>[]);
      throw new Error("interactive $transaction not expected in auth tests");
    }),
  } as unknown as MockPrisma;
  return {
    cookieStore,
    setCalls,
    client,
    setSession: (row: unknown) => {
      sessionRow = row;
    },
    clearCookies: () => {
      for (const k of Object.keys(cookieStore)) delete cookieStore[k];
      setCalls.length = 0;
    },
  };
});

vi.mock("@/lib/db", () => ({ prisma: m.client }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (m.cookieStore[name] !== undefined ? { name, value: m.cookieStore[name] } : undefined),
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      m.cookieStore[name] = value;
      m.setCalls.push({ name, value, options });
    },
    delete: (name: string) => {
      delete m.cookieStore[name];
    },
  }),
}));

// --- fixtures -------------------------------------------------------------

const OWNER: User = {
  id: "user-owner",
  email: "owner@zubeli.rw",
  passwordHash: "hash",
  name: "Owner",
  phone: null,
  role: "OWNER",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const CUSTOMER: User = {
  id: "user-customer",
  email: "customer@zubeli.rw",
  passwordHash: "hash",
  name: "Customer",
  phone: "+250788123456",
  role: "CUSTOMER",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function sessionFixture(user: User, opts: { expiresAt?: Date; lastUsedAt?: Date | null; createdAt?: Date } = {}) {
  const now = Date.now();
  return {
    id: "session-1",
    tokenHash: "t",
    userId: user.id,
    expiresAt: opts.expiresAt ?? new Date(now + 60_000),
    lastUsedAt: opts.lastUsedAt !== undefined ? opts.lastUsedAt : new Date(now - 60_000),
    createdAt: opts.createdAt ?? new Date(now - 60_000),
    updatedAt: new Date(now),
    user,
  };
}

beforeEach(() => {
  m.clearCookies();
  m.setSession(null);
  vi.clearAllMocks();
});

afterEach(() => {
  m.setSession(null);
  m.clearCookies();
});

// --- password -------------------------------------------------------------

describe("password hashing (bcryptjs)", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("Password123!");
    expect(hash).toMatch(/^\$2[aby]\$/);
    await expect(verifyPassword("Password123!", hash)).resolves.toBe(true);
    await expect(verifyPassword("WrongPass!", hash)).resolves.toBe(false);
  });

  it("produces different hashes for the same password (salt)", async () => {
    const a = await hashPassword("Password123!");
    const b = await hashPassword("Password123!");
    expect(a).not.toBe(b);
    await expect(verifyPassword("Password123!", a)).resolves.toBe(true);
    await expect(verifyPassword("Password123!", b)).resolves.toBe(true);
  });
});

// --- session tokens -------------------------------------------------------

describe("session-token primitives", () => {
  it("hashes tokens to deterministic sha256 hex", () => {
    const expected = createHash("sha256").update("abc").digest("hex");
    expect(hashSessionToken("abc")).toBe(expected);
    expect(hashSessionToken("abc")).toHaveLength(64);
    expect(hashSessionToken("abc")).toBe(hashSessionToken("abc"));
    expect(hashSessionToken("abc")).not.toBe(hashSessionToken("abd"));
  });

  it("generates unique base64url tokens of 32 random bytes", () => {
    const a = newSessionToken();
    const b = newSessionToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a).toHaveLength(43);
  });

  it("exports the cookie policy constants (name, 30d TTL, 7d rotation)", () => {
    expect(SESSION_COOKIE).toBe("zubeli_session");
    expect(SESSION_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
    expect(ROTATE_AFTER_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

// --- session cookie policy -------------------------------------------------

describe("session cookie policy", () => {
  it("createSession sets zubeli_session httpOnly, sameSite lax, 30d, non-secure outside production", async () => {
    await createSession(CUSTOMER.id);
    expect(m.cookieStore[SESSION_COOKIE]).toBeTruthy();
    expect(m.setCalls).toHaveLength(1);
    const call = m.setCalls[0]!;
    expect(call.name).toBe("zubeli_session");
    expect(call.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(call.options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    // NODE_ENV is 'test' — secure cookies only in production
    expect(call.options?.secure).toBe(false);
  });

  it("destroySession deletes the session row and clears the cookie", async () => {
    m.cookieStore[SESSION_COOKIE] = "raw-token";
    await destroySession();
    expect(m.client.session.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: hashSessionToken("raw-token") },
    });
    const clearCall = m.setCalls.find((c) => c.name === SESSION_COOKIE);
    expect(clearCall).toBeTruthy();
    expect(clearCall?.value).toBe("");
    expect(clearCall?.options?.maxAge).toBe(0);
    expect(m.cookieStore[SESSION_COOKIE]).toBe("");
  });

  it("destroySession without a cookie only clears the cookie", async () => {
    await destroySession();
    expect(m.client.session.deleteMany).not.toHaveBeenCalled();
    expect(m.setCalls.find((c) => c.name === SESSION_COOKIE)?.value).toBe("");
  });
});

// --- getSession ------------------------------------------------------------

describe("getSession", () => {
  it("returns null when there is no session cookie", async () => {
    await expect(getSession()).resolves.toBeNull();
    expect(m.client.session.findUnique).not.toHaveBeenCalled();
  });

  it("returns the user for a valid, fresh session (no rotation, no throttle write)", async () => {
    m.cookieStore[SESSION_COOKIE] = "raw-token";
    m.setSession(sessionFixture(CUSTOMER, { lastUsedAt: new Date(Date.now() - 5 * 60 * 1000) }));
    await expect(getSession()).resolves.toEqual(CUSTOMER);
    expect(m.client.session.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashSessionToken("raw-token") },
      include: { user: true },
    });
    expect(m.client.session.update).not.toHaveBeenCalled();
    expect(m.setCalls).toHaveLength(0); // no rotation
  });

  it("returns null for an expired session", async () => {
    m.cookieStore[SESSION_COOKIE] = "raw-token";
    m.setSession(sessionFixture(CUSTOMER, { expiresAt: new Date(Date.now() - 1000) }));
    await expect(getSession()).resolves.toBeNull();
  });

  it("returns null when the session row is missing", async () => {
    m.cookieStore[SESSION_COOKIE] = "raw-token";
    m.setSession(null);
    await expect(getSession()).resolves.toBeNull();
  });

  it("rotates the token after 7 days of inactivity and sets the new cookie", async () => {
    m.cookieStore[SESSION_COOKIE] = "old-token";
    m.setSession(sessionFixture(CUSTOMER, { lastUsedAt: new Date(Date.now() - ROTATE_AFTER_MS - 1000) }));
    await expect(getSession()).resolves.toEqual(CUSTOMER);
    const rotatedCall = m.setCalls.find((c) => c.name === SESSION_COOKIE);
    expect(rotatedCall).toBeTruthy();
    expect(rotatedCall!.value).not.toBe("old-token");
    expect(m.cookieStore[SESSION_COOKIE]).toBe(rotatedCall!.value);
  });

  it("throttles lastUsedAt writes to at most hourly", async () => {
    m.cookieStore[SESSION_COOKIE] = "raw-token";
    m.setSession(sessionFixture(CUSTOMER, { lastUsedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) }));
    await getSession();
    expect(m.client.session.update).toHaveBeenCalledOnce();
    expect(m.setCalls).toHaveLength(0); // no cookie write for throttle
  });
});

// --- guards ---------------------------------------------------------------

describe("requireUser / requireAdmin / assertAdmin", () => {
  it("requireUser throws 401 without a session", async () => {
    await expect(requireUser()).rejects.toMatchObject({ code: "NOT_AUTHORIZED", httpStatus: 401 });
  });

  it("requireUser returns the user with a valid session", async () => {
    m.cookieStore[SESSION_COOKIE] = "raw-token";
    m.setSession(sessionFixture(CUSTOMER));
    await expect(requireUser()).resolves.toEqual(CUSTOMER);
  });

  it("requireAdmin throws 403 for a CUSTOMER role", async () => {
    m.cookieStore[SESSION_COOKIE] = "raw-token";
    m.setSession(sessionFixture(CUSTOMER));
    await expect(requireAdmin()).rejects.toMatchObject({ code: "NOT_AUTHORIZED", httpStatus: 403 });
  });

  it("requireAdmin returns the user for an OWNER role", async () => {
    m.cookieStore[SESSION_COOKIE] = "raw-token";
    m.setSession(sessionFixture(OWNER));
    await expect(requireAdmin()).resolves.toEqual(OWNER);
  });

  it("assertAdmin is pure: null → 401, CUSTOMER → 403, OWNER → passes", () => {
    expect(() => assertAdmin(null)).toThrow(NotAuthorizedError);
    try {
      assertAdmin(null);
    } catch (error) {
      expect(error).toMatchObject({ httpStatus: 401 });
    }
    try {
      assertAdmin(CUSTOMER);
      expect.unreachable("expected 403");
    } catch (error) {
      expect(error).toMatchObject({ code: "NOT_AUTHORIZED", httpStatus: 403 });
    }
    expect(() => assertAdmin(OWNER)).not.toThrow();
  });
});
