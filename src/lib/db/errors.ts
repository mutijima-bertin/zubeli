/**
 * Typed errors thrown by the repository layer.
 * backend-agent maps these to HTTP responses (see ADR 0004 / backend-patterns).
 */
export class InsufficientStockError extends Error {
  constructor(
    public readonly productName: string,
    public readonly available: number,
    public readonly requested: number,
  ) {
    super(`Insufficient stock for "${productName}": ${available} available, ${requested} requested`);
    this.name = 'InsufficientStockError';
  }
}

export class ProductNotFoundError extends Error {
  constructor(productId: string) {
    super(`Product not found: ${productId}`);
    this.name = 'ProductNotFoundError';
  }
}

export class InvalidQuantityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidQuantityError';
  }
}
