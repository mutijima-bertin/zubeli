/**
 * Cart queries — guest cart keyed by opaque server-side cartToken cookie,
 * registered cart keyed by userId (one per user). Exactly one of the two is
 * set per ADR 0001 — enforced here.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { InvalidQuantityError } from './errors';

export type GetOrCreateCartParams = { token?: string; userId?: string };

export async function getOrCreateCart({ token, userId }: GetOrCreateCartParams) {
  if (userId) {
    return prisma.cart.upsert({ where: { userId }, update: {}, create: { userId } });
  }
  if (token) {
    return prisma.cart.upsert({ where: { cartToken: token }, update: {}, create: { cartToken: token } });
  }
  throw new Error('getOrCreateCart: provide either cartToken or userId (ADR 0001: exactly one is set)');
}

const cartProductSelect = {
  id: true,
  slug: true,
  name: true,
  priceCents: true,
  currency: true,
  imageUrls: true,
  stockQty: true,
  isPublished: true,
} satisfies Prisma.ProductSelect;

export type CartWithItems = Prisma.CartGetPayload<{
  include: { items: { include: { product: { select: typeof cartProductSelect } } } };
}>;

export async function getCartWithItems(cartId: string): Promise<CartWithItems | null> {
  return prisma.cart.findUnique({
    where: { id: cartId },
    include: {
      items: { orderBy: { createdAt: 'asc' }, include: { product: { select: cartProductSelect } } },
    },
  });
}

function assertPositiveQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new InvalidQuantityError(`CartItem quantity must be a positive integer, got ${quantity}`);
  }
}

/** Upsert a cart line — sets the absolute quantity (caller computes increments). */
export async function upsertCartItem(cartId: string, productId: string, quantity: number) {
  assertPositiveQuantity(quantity);
  return prisma.cartItem.upsert({
    where: { cartId_productId: { cartId, productId } },
    update: { quantity },
    create: { cartId, productId, quantity },
  });
}

export async function updateCartItemQty(cartItemId: string, quantity: number) {
  assertPositiveQuantity(quantity);
  return prisma.cartItem.update({ where: { id: cartItemId }, data: { quantity } });
}

export async function removeCartItem(cartItemId: string) {
  return prisma.cartItem.delete({ where: { id: cartItemId } });
}

export async function clearCart(cartId: string) {
  return prisma.cartItem.deleteMany({ where: { cartId } });
}
