import { z } from "zod";

export const listQuerySchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const idParamSchema = z.object({
  id: z.string().uuid()
});

export const updateUserStatusSchema = z.object({
  status: z.enum(["ACTIVE", "LOCKED", "DELETED"])
});

export const rejectDriverSchema = z.object({
  reason: z.string().min(3).max(255)
});

export const adminCancelRideSchema = z.object({
  reason: z.string().min(3).max(255)
});
