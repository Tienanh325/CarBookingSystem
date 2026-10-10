import { z } from "zod";

export const pointSchema = z.object({
  address: z.string().min(5),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});

export const estimateSchema = z.object({
  pickup: pointSchema,
  dropoff: pointSchema,
  stops: z
    .array(pointSchema.extend({ dwellMinutes: z.number().int().min(1).max(30).default(5) }))
    .max(2)
    .default([]),
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

const minuteOfDaySchema = z.number().int().min(0).max(1439);

const surchargeRuleFields = z.object({
  vehicleTypeId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(2).max(100),
  type: z.enum(["PEAK_HOUR", "LATE_NIGHT", "WEATHER", "CUSTOM"]),
  multiplier: z.number().min(1).max(5),
  fixedAmount: z.number().int().min(0).max(10_000_000),
  startMinute: minuteOfDaySchema.nullable().optional(),
  endMinute: minuteOfDaySchema.nullable().optional(),
  daysOfWeek: z
    .array(z.number().int().min(0).max(6))
    .max(7)
    .optional()
    .transform((days) => days?.sort().join(",")),
  weatherConditions: z
    .array(z.enum(["RAIN", "HEAVY_RAIN", "FLOOD"]))
    .max(3)
    .optional()
    .transform((items) => items?.join(",")),
  activeFrom: z.coerce.date().optional(),
  activeTo: z.coerce.date().nullable().optional(),
  isActive: z.boolean().optional()
});

export const createSurchargeRuleSchema = surchargeRuleFields
  .extend({
    multiplier: surchargeRuleFields.shape.multiplier.default(1),
    fixedAmount: surchargeRuleFields.shape.fixedAmount.default(0)
  })
  .refine((value) => (value.startMinute == null) === (value.endMinute == null), {
    message: "startMinute va endMinute phai duoc khai bao cung nhau"
  })
  .refine((value) => value.type !== "WEATHER" || Boolean(value.weatherConditions), {
    message: "Phu phi thoi tiet can weatherConditions"
  });

export const updateSurchargeRuleSchema = surchargeRuleFields
  .partial()
  .refine(
    (value) =>
      !(value.startMinute !== undefined && value.endMinute === undefined) &&
      !(value.endMinute !== undefined && value.startMinute === undefined),
    { message: "Khi doi khung gio, can gui ca startMinute va endMinute" }
  );

export const weatherContextSchema = z.object({
  weatherCondition: z.enum(["NORMAL", "RAIN", "HEAVY_RAIN", "FLOOD"])
});
