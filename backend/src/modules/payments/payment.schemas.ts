import { z } from "zod";

export const paymentParamSchema = z.object({
  id: z.string().uuid()
});

export const vietQrWebhookSchema = z.object({
  transactionId: z.string().trim().min(1).max(191),
  reference: z.string().trim().min(1).max(50),
  amount: z.number().int().positive(),
  paidAt: z.string().datetime(),
  signature: z.string().regex(/^[a-fA-F0-9]{64}$/)
});

export const createRefundSchema = z.object({
  amount: z.number().int().positive(),
  reason: z.string().trim().min(3).max(191)
});

export const reconciliationListSchema = z.object({
  classification: z
    .enum(["EXACT", "UNDERPAID", "OVERPAID", "REFERENCE_NOT_FOUND", "DUPLICATE", "EXPIRED"])
    .optional(),
  status: z.enum(["MATCHED", "REVIEW_REQUIRED", "RESOLVED", "IGNORED"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const reconciliationRunListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const resolveReconciliationSchema = z.object({
  action: z.enum(["ACCEPT", "IGNORE"]),
  note: z.string().trim().min(3).max(191)
});
