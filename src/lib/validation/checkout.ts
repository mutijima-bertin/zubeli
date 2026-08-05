/**
 * Checkout validation schema (zod v4). Pure + client-safe.
 * bankTransferReference is conditional on the payment method (ADR 0003):
 * required for BANK_TRANSFER, disallowed otherwise.
 */
import { z } from 'zod';

export const BANK_TRANSFER_REFERENCE_RE = /^[A-Z0-9-]{4,40}$/i;

export const checkoutSchema = z
  .object({
    customer: z.object({
      name: z.string().trim().min(2, 'Name is required').max(120),
      phone: z.string().trim().min(7, 'A valid phone number is required').max(20),
      email: z
        .union([z.literal(''), z.email('Enter a valid email address').trim().toLowerCase()])
        .optional()
        .transform((v) => v || undefined),
      address: z.string().trim().min(5, 'Delivery address is required').max(300),
      city: z.string().trim().min(2, 'City is required').max(80).optional(),
    }),
    /** Only the three MVP methods; MOMO_GATEWAY/CARD are reserved (ADR 0003). */
    paymentMethod: z.enum(['COD_CASH', 'COD_MOBILE_MONEY', 'BANK_TRANSFER']),
    bankTransferReference: z
      .string()
      .trim()
      .regex(BANK_TRANSFER_REFERENCE_RE, 'Reference must be 4–40 letters, digits or dashes')
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.paymentMethod === 'BANK_TRANSFER' && !data.bankTransferReference) {
      ctx.addIssue({
        code: 'custom',
        path: ['bankTransferReference'],
        message: 'bankTransferReference is required when paying by bank transfer',
      });
    }
    if (data.paymentMethod !== 'BANK_TRANSFER' && data.bankTransferReference) {
      ctx.addIssue({
        code: 'custom',
        path: ['bankTransferReference'],
        message: 'bankTransferReference is only allowed when paying by bank transfer',
      });
    }
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;
