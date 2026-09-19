import { z } from "zod";

export const estimateSchema = z.object({
  pickup: z.object({
    address: z.string().min(5),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180)
  }),
  dropoff: z.object({
    address: z.string().min(5),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180)
  }),
  vehicleTypeId: z.string().uuid(),
  promotionCode: z.string().trim().min(1).optional()
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
