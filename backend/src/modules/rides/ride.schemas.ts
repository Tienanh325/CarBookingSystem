import { z } from "zod";
import { estimateSchema } from "../pricing/pricing.schemas";

export const createRideSchema = estimateSchema.extend({
  paymentMethod: z.enum(["CASH", "CARD", "WALLET"]).default("CASH")
});

export const rideParamSchema = z.object({
  id: z.string().uuid()
});

export const rideListQuerySchema = z.object({
  as: z.enum(["customer", "driver"]).optional()
});

export const cancelRideSchema = z.object({
  reason: z.string().min(3).max(255)
});

export const ratingSchema = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional()
});
