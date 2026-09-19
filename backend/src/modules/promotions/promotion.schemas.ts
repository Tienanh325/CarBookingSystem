import { z } from "zod";

export const validatePromotionSchema = z.object({
  code: z.string().trim().min(1),
  fare: z.number().min(0)
});

export const createPromotionSchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().min(2).max(120),
  type: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  value: z.number().min(0),
  maxDiscount: z.number().min(0).nullable().optional(),
  minRideFare: z.number().min(0).nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  perUserLimit: z.number().int().positive().nullable().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  isActive: z.boolean().optional()
});

export const updatePromotionSchema = createPromotionSchema.partial();

export const promotionParamSchema = z.object({
  id: z.string().uuid()
});
