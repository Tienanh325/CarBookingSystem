import { z } from "zod";

export const updateCustomerSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  email: z.string().email().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional()
});

export const createAddressSchema = z.object({
  label: z.string().min(1).max(80),
  address: z.string().min(5).max(255),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});

export const idParamSchema = z.object({
  id: z.string().uuid()
});
