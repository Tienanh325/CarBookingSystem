import { z } from "zod";

export const pointSchema = z.object({
    address: z.string().min(5),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180)
});

export const estimateSchema = z.object({
  pickup: pointSchema,
  dropoff: pointSchema,
  stops: z.array(pointSchema.extend({ dwellMinutes: z.number().int().min(1).max(30).default(5) })).max(2).default([]),
  vehicleTypeId: z.string().uuid(),
  promotionCode: z.string().trim().min(1).optional(),
  scheduledAt: z.coerce.date().optional()
});

export const createPricingRuleSchema = z.object({
  vehicleTypeId: z.string().uuid(),
  baseFare: z.number().min(0),
  perKmFare: z.number().min(0),
  perMinuteFare: z.number().min(0),
  minimumFare: z.number().min(0),
  waitingFeePerMinute: z.number().min(0).optional(),
  peakMultiplier: z.number().min(1).optional(),
  activeFrom: z.coerce.date().optional(),
  activeTo: z.coerce.date().nullable().optional(),
  isActive: z.boolean().optional()
});

export const updatePricingRuleSchema = createPricingRuleSchema.partial();

export const pricingRuleParamSchema = z.object({
  id: z.string().uuid()
});
