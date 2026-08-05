/**
 * Auth validation schemas (zod v4). Pure + client-safe: screen agents can
 * reuse these for form-level pre-validation; the server re-validates at the
 * action boundary (server-side validation is the only trust).
 */
import { z } from 'zod';

/** Password rule (ADR 0002): min 8 chars, max 72 (bcrypt input limit). */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters');

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(80),
  email: z.email('Enter a valid email address').trim().toLowerCase(),
  password: passwordSchema,
  phone: z
    .union([z.literal(''), z.string().trim().min(7, 'Phone must be at least 7 digits').max(20)])
    .optional()
    .transform((v) => v || undefined),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email('Enter a valid email address').trim().toLowerCase(),
  // min 1 on purpose: a wrong-but-short password must still hit bcrypt.compare,
  // not fail fast (uniform timing).
  password: z.string().min(1, 'Password is required').max(72),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(80).optional(),
  /** '' or null clears the phone. */
  phone: z
    .union([z.literal(''), z.string().trim().min(7, 'Phone must be at least 7 digits').max(20), z.null()])
    .optional()
    .transform((v) => (v === '' ? null : v)),
});

export type ProfileInput = z.infer<typeof profileSchema>;
