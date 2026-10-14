import { z } from "zod";

export const idSchema = z.object({ id: z.string().uuid() });
export const tokenSchema = z.object({ token: z.string().min(40).max(200) });

export const emergencyContactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  relationship: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().min(9).max(20),
  isPrimary: z.boolean().default(false)
});

export const sosSchema = z.object({
  rideId: z.string().uuid().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  message: z.string().trim().max(500).optional()
});

export const sosStatusSchema = z.object({
  status: z.enum(["ACKNOWLEDGED", "RESOLVED"])
});

export const rideMessageSchema = z.object({ body: z.string().trim().min(1).max(1000) });

export const shareRideSchema = z.object({
  expiresInHours: z.number().int().min(1).max(48).default(8)
});

export const safetyListSchema = z.object({
  status: z.enum(["ACTIVE", "ACKNOWLEDGED", "RESOLVED"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});
