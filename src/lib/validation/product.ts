/**
 * Product (admin) validation schemas (zod v4). Pure + client-safe.
 */
import { z } from 'zod';

const productFields = {
  name: z.string().trim().min(2, 'Name is required').max(160),
  slug: z
    .string()
    .trim()
    .min(2, 'Slug is required')
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug: lowercase letters, digits and dashes only'),
  description: z.string().trim().max(5000).optional(),
  priceCents: z.coerce.number().int().positive('Price must be a positive integer'),
  categoryId: z.string().min(1, 'Category is required'),
  stockQty: z.coerce.number().int().min(0, 'Stock cannot be negative'),
  lowStockThreshold: z.coerce.number().int().min(0),
  isPublished: z.boolean(),
  featured: z.boolean(),
  imageUrls: z.array(z.string().trim().min(1).max(500)).max(8, 'At most 8 images'),
} satisfies z.ZodRawShape;

export const productSchema = z.object({
  ...productFields,
  stockQty: productFields.stockQty.default(0),
  lowStockThreshold: productFields.lowStockThreshold.default(5),
  isPublished: productFields.isPublished.default(false),
  featured: productFields.featured.default(false),
  imageUrls: productFields.imageUrls.default([]),
});

export type ProductInput = z.infer<typeof productSchema>;

/** Update = all-optional (no `.partial()` defaults, so absent keys are untouched). */
export const productUpdateSchema = z.object(productFields).partial();

export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

/** Update action input: the target id + any editable fields. */
export const adminUpdateProductSchema = productUpdateSchema.extend({
  productId: z.string().min(1),
});
export type AdminUpdateProductInput = z.infer<typeof adminUpdateProductSchema>;

export const productIdSchema = z.object({ productId: z.string().min(1) });
export type ProductIdInput = z.infer<typeof productIdSchema>;

export const adminListProductsSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(100).optional(),
  categorySlug: z.string().trim().max(100).optional(),
  includeDeleted: z.boolean().optional(),
});
export type AdminListProductsInput = z.infer<typeof adminListProductsSchema>;
