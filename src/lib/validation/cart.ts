/**
 * Cart validation schemas (zod v4). Pure + client-safe.
 */
import { z } from 'zod';

export const cartItemSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  /** Quantity is capped server-side at product.stockQty (lib/cart.ts). */
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').max(99, 'Quantity must be at most 99'),
});

export type CartItemInput = z.infer<typeof cartItemSchema>;

export const removeCartItemSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
});

export type RemoveCartItemInput = z.infer<typeof removeCartItemSchema>;
