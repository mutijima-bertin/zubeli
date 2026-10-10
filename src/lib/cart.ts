/**
 * Cart operations — the single entry point for cart actions.
 * Guest carts are keyed by an opaque server-side `cart_token` cookie
 * (32-byte hex, httpOnly, 1 year); registered users get one cart keyed by
 * userId (repo layer enforces "exactly one of the two", ADR 0001).
 * Quantity is capped at product.stockQty; 0 stock throws InvalidQuantityError.
 */
import 'server-only';
import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { getById } from '@/lib/db/products';
import {
  clearCart as clearCartRows,
  getCartWithItems,
  getOrCreateCart,
  removeCartItem,
  updateCartItemQty,
  upsertCartItem,
} from '@/lib/db/cart';
import { InvalidQuantityError, ProductNotFoundError } from '@/lib/db/errors';
import { getSession } from '@/lib/auth/session';
import { NotFoundError } from '@/lib/errors';
import { cartWithFullProducts, toCartDTO } from '@/lib/dto';
import type { CartDTO } from '@/types/api';

export const CART_COOKIE = 'cart_token';
const CART_COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

function cartCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: CART_COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  };
}

/** Reads the guest cart cookie, creating it (32-byte hex) when absent. */
export async function getOrCreateCartToken(): Promise<string> {
  const store = await cookies();
  const existing = store.get(CART_COOKIE)?.value;
  if (existing) return existing;
  const token = randomBytes(32).toString('hex');
  store.set(CART_COOKIE, token, cartCookieOptions());
  return token;
}

/**
 * Resolves the active cart: registered user → their cart; otherwise the
 * guest cart cookie. Never throws — creates the row on first touch.
 */
export async function ensureCart() {
  const user = await getSession();
  if (user) return getOrCreateCart({ userId: user.id });
  const token = await getOrCreateCartToken();
  return getOrCreateCart({ token });
}

async function loadCartDto(cartId: string): Promise<CartDTO> {
  const cart = await getCartWithItems(cartId);
  if (!cart) throw new NotFoundError('Cart not found');
  const full = await cartWithFullProducts(cart);
  return toCartDTO(full);
}

export async function getCart(): Promise<CartDTO> {
  const cart = await ensureCart();
  return loadCartDto(cart.id);
}

export async function addToCart(productId: string, quantity: number): Promise<CartDTO> {
  const product = await getById(productId);
  if (!product || product.deletedAt) throw new ProductNotFoundError(productId);
  if (product.stockQty <= 0) {
    throw new InvalidQuantityError(`"${product.name}" is out of stock — remove it from your cart or wait for a restock`);
  }
  const capped = Math.min(quantity, product.stockQty);
  const cart = await ensureCart();
  await upsertCartItem(cart.id, productId, capped);
  return loadCartDto(cart.id);
}

/** Sets an absolute quantity (capped at stock). quantity < 1 removes the line. */
export async function updateQty(productId: string, quantity: number): Promise<CartDTO> {
  const cart = await ensureCart();
  const withItems = await getCartWithItems(cart.id);
  const item = withItems?.items.find((i) => i.productId === productId);
  if (!item) throw new NotFoundError('Item is not in your cart');

  const product = await getById(productId);
  if (!product || product.deletedAt) throw new ProductNotFoundError(productId);

  if (quantity < 1) {
    await removeCartItem(item.id);
  } else {
    await updateCartItemQty(item.id, Math.min(quantity, product.stockQty));
  }
  return loadCartDto(cart.id);
}

export async function removeItem(productId: string): Promise<CartDTO> {
  const cart = await ensureCart();
  const withItems = await getCartWithItems(cart.id);
  const item = withItems?.items.find((i) => i.productId === productId);
  if (!item) throw new NotFoundError('Item is not in your cart');
  await removeCartItem(item.id);
  return loadCartDto(cart.id);
}

export async function clearCart(): Promise<CartDTO> {
  const cart = await ensureCart();
  await clearCartRows(cart.id);
  return loadCartDto(cart.id);
}
