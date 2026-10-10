import { z } from "zod";

export const createTopUpSchema = z.object({
  amount: z.number().int().min(10_000).max(100_000_000)
});

export const createWithdrawalSchema = z.object({
  amount: z.number().int().min(50_000).max(100_000_000),
  bankCode: z.string().trim().min(2).max(30).transform((value) => value.toUpperCase()),
  accountNumber: z.string().trim().regex(/^\d{6,30}$/),
  accountName: z.string().trim().min(2).max(150).transform((value) => value.toUpperCase())
});

export const withdrawalParamSchema = z.object({
  id: z.string().uuid()
});

export const rejectWithdrawalSchema = z.object({
  reason: z.string().trim().min(3).max(255)
});

export const withdrawalListSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});
