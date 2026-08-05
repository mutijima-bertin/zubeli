/**
 * Typed error classes + the shared ActionResult error mapper (ADR 0004).
 * Every action throws typed errors; `toActionResult` maps them to the
 * `{ ok: false, error }` envelope. HTTP status codes are carried for future
 * route handlers (webhooks) — actions only consume `code`/`message`/`details`.
 */
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import {
  InsufficientStockError,
  InvalidQuantityError,
  ProductNotFoundError,
} from '@/lib/db/errors';
import type { ApiError, ErrorCode } from '@/types/api';

export abstract class AppError extends Error {
  abstract readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: unknown;

  constructor(message: string, httpStatus: number, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

/** 401 (no session) / 403 (wrong role or IDOR) — ADR 0004. */
export class NotAuthorizedError extends AppError {
  readonly code = 'NOT_AUTHORIZED' as const;
  constructor(message = 'You are not authorized to perform this action', httpStatus = 401, details?: unknown) {
    super(message, httpStatus, details);
  }
}

export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND' as const;
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

export class ValidationError extends AppError {
  readonly code = 'VALIDATION' as const;
  constructor(message = 'Invalid input', details?: unknown) {
    super(message, 400, details);
  }
}

/** 409 — checked inside the checkout transaction and at cart-add time. */
export class ProductOutOfStockError extends AppError {
  readonly code = 'OUT_OF_STOCK' as const;
  constructor(
    public readonly productId: string,
    public readonly requested: number,
    public readonly available: number,
  ) {
    super(
      `Product ${productId} is out of stock: ${available} available, ${requested} requested`,
      409,
      { productId, requested, available },
    );
  }
}

/** 409 — illegal OrderStatus move (ADR 0001 lifecycle, enforced in lib/orders-admin). */
export class InvalidTransitionError extends AppError {
  readonly code = 'INVALID_TRANSITION' as const;
  constructor(message = 'Illegal order status transition', details?: unknown) {
    super(message, 409, details);
  }
}

export class RateLimitError extends AppError {
  readonly code = 'RATE_LIMITED' as const;
  constructor(message = 'Too many requests — try again later', retryAfterSeconds?: number) {
    super(message, 429, retryAfterSeconds ? { retryAfterSeconds } : undefined);
  }
}

/** 409 — unique-violation / state conflict (e.g. duplicate email). */
export class ConflictError extends AppError {
  readonly code = 'CONFLICT' as const;
  constructor(message = 'Conflict with current state', details?: unknown) {
    super(message, 409, details);
  }
}

/**
 * Maps any thrown value to the shared error envelope.
 * Order matters: AppError → ZodError → Prisma known errors → repo-layer errors → INTERNAL.
 */
export function toActionResult(error: unknown): { ok: false; error: ApiError } {
  if (error instanceof AppError) {
    return { ok: false, error: { code: error.code, message: error.message, details: error.details } };
  }

  if (error instanceof ZodError) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION',
        message: error.issues[0]?.message ?? 'Invalid input',
        details: { fieldErrors: error.flatten().fieldErrors },
      },
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Resource not found' } };
    }
    if (error.code === 'P2002') {
      return {
        ok: false,
        error: {
          code: 'CONFLICT',
          message: 'A record with that value already exists',
          details: { target: error.meta?.target },
        },
      };
    }
  }

  // Repository-layer errors (src/lib/db/errors.ts) — the checkout transaction throws these.
  if (error instanceof InsufficientStockError) {
    return {
      ok: false,
      error: {
        code: 'OUT_OF_STOCK',
        message: error.message,
        details: { productName: error.productName, available: error.available, requested: error.requested },
      },
    };
  }
  if (error instanceof ProductNotFoundError) {
    return { ok: false, error: { code: 'NOT_FOUND', message: error.message } };
  }
  if (error instanceof InvalidQuantityError) {
    return { ok: false, error: { code: 'VALIDATION', message: error.message } };
  }

  // Never leak internal details to the client — log and return a generic message.
  console.error('[zubeli] unexpected error in action:', error);
  return { ok: false, error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } };
}
