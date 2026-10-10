/**
 * Category validation schemas (zod v4). Pure + client-safe — shared by the
 * admin category actions (src/actions/admin/categories.ts) and their tests.
 *
 * Slug rules mirror the product slug contract (src/lib/validation/product.ts):
 * lowercase letters, digits and dashes only. `createCategorySchema` derives
 * the slug from the name when the caller omits it, and validates the DERIVED
 * value through the same field schema, so a name that slugifies to nothing
 * ("!!!") fails with a proper `fieldErrors.slug` instead of reaching the DB.
 */
import { z } from 'zod';

export const CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** URL-safe slug from any display name: "Power Tools & Drills" → "power-tools-drills". */
export function categorySlugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // drop accents before they become dashes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .slice(0, 160)
    .replace(/-+$/, ''); // slicing a long slug can re-expose a trailing dash
}

const nameField = z.string().trim().min(2, 'Name is required').max(100);
const slugField = z
  .string()
  .trim()
  .min(2, 'Slug is required')
  .max(160)
  .regex(CATEGORY_SLUG_PATTERN, 'Slug: lowercase letters, digits and dashes only');
const descriptionField = z.string().trim().max(2000);

export const createCategorySchema = z
  .object({
    name: nameField,
    /** Optional — auto-derived from `name` via categorySlugify when absent. */
    slug: z.string().trim().max(160).optional(),
    description: descriptionField.optional(),
    isActive: z.boolean().default(true),
  })
  // Unknown keys are rejected (not silently stripped) — the server is the
  // authoritative boundary, so an unexpected field is a client bug, not data.
  .strict()
  .transform((data, ctx) => {
    const slug = data.slug ?? categorySlugify(data.name);
    const parsed = slugField.safeParse(slug);
    if (!parsed.success) {
      ctx.addIssue({ code: 'custom', path: ['slug'], message: parsed.error.issues[0]?.message ?? 'Invalid slug' });
      return z.NEVER;
    }
    return { ...data, slug: parsed.data };
  });

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

/**
 * Update = all-optional, absent keys untouched (products' `productUpdateSchema`
 * convention — no `.partial()` on a schema with defaults, so `isActive` has no
 * default here). The slug is NEVER re-derived from a renamed `name`: changing a
 * category's name must not silently change URLs that already exist.
 */
export const updateCategorySchema = z
  .object({
    name: nameField.optional(),
    slug: slugField.optional(),
    description: descriptionField.optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

/** Single-arg id guard (delete/toggle/update take `id` as their own parameter). */
export const categoryIdSchema = z.string().min(1, 'Category id is required');
