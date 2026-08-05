'use server';
/**
 * Cart actions — guest carts (cart_token cookie) and registered carts
 * (userId) are resolved transparently in lib/cart. Return CartDTO.
 */
import { revalidateTag } from 'next/cache';
import { cartItemSchema, removeCartItemSchema } from '@/lib/validation/cart';
import { addToCart, getCart, removeItem, updateQty } from '@/lib/cart';
import { toActionResult } from '@/lib/errors';
import type { ActionResult, CartDTO } from '@/types/api';

export async function getCartAction(): Promise<ActionResult<CartDTO>> {
  try {
    const cart = await getCart();
    return { ok: true, data: cart };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function addToCartAction(input: unknown): Promise<ActionResult<CartDTO>> {
  try {
    const { productId, quantity } = cartItemSchema.parse(input);
    const cart = await addToCart(productId, quantity);
    revalidateTag(`cart:${cart.id}`);
    return { ok: true, data: cart };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function updateCartQtyAction(input: unknown): Promise<ActionResult<CartDTO>> {
  try {
    const { productId, quantity } = cartItemSchema.parse(input);
    const cart = await updateQty(productId, quantity);
    revalidateTag(`cart:${cart.id}`);
    return { ok: true, data: cart };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function removeCartItemAction(input: unknown): Promise<ActionResult<CartDTO>> {
  try {
    const { productId } = removeCartItemSchema.parse(input);
    const cart = await removeItem(productId);
    revalidateTag(`cart:${cart.id}`);
    return { ok: true, data: cart };
  } catch (error) {
    return toActionResult(error);
  }
}
