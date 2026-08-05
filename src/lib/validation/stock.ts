/**
 * Stock / inventory validation schemas (zod v4). Pure + client-safe.
 */
import { z } from 'zod';

export const stockAdjustSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').max(10000),
  reason: z.enum(['RESTOCK', 'ADJUSTMENT']),
  /** IN adds to stock, OUT writes off (e.g. damage). Defaults to IN. */
  direction: z.enum(['IN', 'OUT']).default('IN'),
  note: z.string().trim().max(500).optional(),
});

export type StockAdjustInput = z.infer<typeof stockAdjustSchema>;

export const listMovementsSchema = z.object({
  productId: z.string().min(1).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type ListMovementsInput = z.infer<typeof listMovementsSchema>;
