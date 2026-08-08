/**
 * Typed error classes + toActionResult mapping (ADR 0004).
 * Every server action maps thrown errors to the { ok:false, error } envelope;
 * the httpStatus carried on AppError is the HTTP-ish semantic for future
 * route handlers (actions only consume code/message/details).
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import {
  AppError,
  ConflictError,
  InvalidTransitionError,
  NotAuthorizedError,
  NotFoundError,
  ProductOutOfStockError,
  RateLimitError,
  ValidationError,
  toActionResult,
} from "@/lib/errors";
import { InsufficientStockError, InvalidQuantityError, ProductNotFoundError } from "@/lib/db/errors";

afterEach(() => {
  vi.restoreAllMocks();
});

function expectMapped(error: unknown, code: string, message: string, details?: unknown) {
  const result = toActionResult(error);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe(code);
    expect(result.error.message).toBe(message);
    if (details !== undefined) expect(result.error.details).toEqual(details);
  }
}

describe("toActionResult — typed AppError subclasses", () => {
  it("maps NotAuthorizedError with default 401 (no session)", () => {
    const err = new NotAuthorizedError();
    expect(err.httpStatus).toBe(401);
    expect(err.code).toBe("NOT_AUTHORIZED");
    expectMapped(err, "NOT_AUTHORIZED", "You are not authorized to perform this action");
  });

  it("maps NotAuthorizedError with explicit 403 (wrong role / IDOR)", () => {
    const err = new NotAuthorizedError("Admin access required", 403);
    expect(err.httpStatus).toBe(403);
    expectMapped(err, "NOT_AUTHORIZED", "Admin access required");
  });

  it("maps NotFoundError to NOT_FOUND / 404", () => {
    const err = new NotFoundError("Order not found");
    expect(err.httpStatus).toBe(404);
    expectMapped(err, "NOT_FOUND", "Order not found");
  });

  it("maps ValidationError to VALIDATION / 400 and keeps details", () => {
    const err = new ValidationError("Invalid input", { fieldErrors: { name: ["too short"] } });
    expect(err.httpStatus).toBe(400);
    expectMapped(err, "VALIDATION", "Invalid input", { fieldErrors: { name: ["too short"] } });
  });

  it("maps ProductOutOfStockError to OUT_OF_STOCK / 409 with product context", () => {
    const err = new ProductOutOfStockError("prod-1", 5, 2);
    expect(err.httpStatus).toBe(409);
    expectMapped(err, "OUT_OF_STOCK", "Product prod-1 is out of stock: 2 available, 5 requested", {
      productId: "prod-1",
      requested: 5,
      available: 2,
    });
  });

  it("maps InvalidTransitionError to INVALID_TRANSITION / 409 with details", () => {
    const err = new InvalidTransitionError("Cannot move order from PENDING to FULFILLED", {
      from: "PENDING",
      to: "FULFILLED",
    });
    expect(err.httpStatus).toBe(409);
    expectMapped(err, "INVALID_TRANSITION", "Cannot move order from PENDING to FULFILLED", {
      from: "PENDING",
      to: "FULFILLED",
    });
  });

  it("maps RateLimitError to RATE_LIMITED / 429 with retryAfterSeconds", () => {
    const err = new RateLimitError("Too many requests — try again in 30s", 30);
    expect(err.httpStatus).toBe(429);
    expectMapped(err, "RATE_LIMITED", "Too many requests — try again in 30s", { retryAfterSeconds: 30 });
  });

  it("maps ConflictError to CONFLICT / 409", () => {
    const err = new ConflictError("An account with this email already exists");
    expect(err.httpStatus).toBe(409);
    expectMapped(err, "CONFLICT", "An account with this email already exists");
  });

  it("keeps the subclass name for instance identification", () => {
    expect(new RateLimitError().name).toBe("RateLimitError");
    expect(new ValidationError().name).toBe("ValidationError");
  });
});

describe("toActionResult — non-AppError inputs", () => {
  it("maps a ZodError to VALIDATION with flattened fieldErrors", () => {
    const err = new ZodError([
      { code: "too_small", minimum: 8, origin: "string", inclusive: true, exact: false, message: "Password must be at least 8 characters", path: ["password"] },
    ]);
    const result = toActionResult(err);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION");
      expect(result.error.message).toBe("Password must be at least 8 characters");
      expect(result.error.details).toEqual({
        fieldErrors: { password: ["Password must be at least 8 characters"] },
      });
    }
  });

  it("maps a Prisma P2002 unique violation to CONFLICT with target details", () => {
    const err = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "6.19.3",
      meta: { target: ["email"] },
    });
    const result = toActionResult(err);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFLICT");
      expect(result.error.message).toBe("A record with that value already exists");
      expect(result.error.details).toEqual({ target: ["email"] });
    }
  });

  it("maps a Prisma P2025 record-not-found to NOT_FOUND", () => {
    const err = new Prisma.PrismaClientKnownRequestError("Record not found", {
      code: "P2025",
      clientVersion: "6.19.3",
    });
    expectMapped(err, "NOT_FOUND", "Resource not found");
  });

  it("maps a Prisma unknown-code error to INTERNAL (never leaks details)", () => {
    const err = new Prisma.PrismaClientKnownRequestError("Server error", {
      code: "P2010",
      clientVersion: "6.19.3",
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = toActionResult(err);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL");
      expect(result.error.message).toBe("Something went wrong. Please try again.");
      expect(result.error.details).toBeUndefined();
    }
    expect(spy).toHaveBeenCalledOnce();
  });

  it("maps repository InsufficientStockError to OUT_OF_STOCK with product context", () => {
    const err = new InsufficientStockError("Hammer 16oz", 3, 10);
    expectMapped(err, "OUT_OF_STOCK", 'Insufficient stock for "Hammer 16oz": 3 available, 10 requested', {
      productName: "Hammer 16oz",
      available: 3,
      requested: 10,
    });
  });

  it("maps repository ProductNotFoundError to NOT_FOUND", () => {
    const err = new ProductNotFoundError("prod-42");
    expectMapped(err, "NOT_FOUND", "Product not found: prod-42");
  });

  it("maps repository InvalidQuantityError to VALIDATION", () => {
    const err = new InvalidQuantityError('"Safety Vest" is out of stock — remove it from your cart');
    expectMapped(err, "VALIDATION", '"Safety Vest" is out of stock — remove it from your cart');
  });

  it("maps unknown errors to INTERNAL with a generic message and logs them", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = toActionResult(new Error("boom"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL");
      expect(result.error.message).toBe("Something went wrong. Please try again.");
    }
    expect(spy).toHaveBeenCalledOnce();
  });

  it("catches any AppError subclass (future-proofing) before the generic branch", () => {
    class FutureError extends AppError {
      readonly code = "CONFLICT" as const;
      constructor() {
        super("future conflict", 409, { hint: "future" });
      }
    }
    const err = new FutureError();
    expect(err).toBeInstanceOf(AppError);
    expectMapped(err, "CONFLICT", "future conflict", { hint: "future" });
  });
});
