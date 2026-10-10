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
