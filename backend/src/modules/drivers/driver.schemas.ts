import { z } from "zod";

export const registerDriverSchema = z.object({
  licenseNumber: z.string().min(4).max(40),
  identityNumber: z.string().min(6).max(30),
  vehicle: z.object({
    vehicleTypeId: z.string().uuid(),
    plateNumber: z.string().min(5).max(20),
    brand: z.string().max(80).optional(),
    model: z.string().max(80).optional(),
    color: z.string().max(40).optional()
  })
});

export const updateDriverSchema = z.object({
  licenseNumber: z.string().min(4).max(40).optional(),
  identityNumber: z.string().min(6).max(30).optional()
});

export const updateLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).optional()
});

export const rideParamSchema = z.object({
  id: z.string().uuid()
});

export const driverCancelRideSchema = z.object({
  reason: z.string().min(3).max(255)
});
