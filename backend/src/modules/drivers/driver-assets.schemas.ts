import { z } from "zod";

export const assetIdSchema = z.object({ id: z.string().uuid() });
export const vehicleSchema = z.object({
  vehicleTypeId: z.string().uuid(),
  plateNumber: z.string().trim().min(5).max(20),
  brand: z.string().trim().max(80).optional(),
  model: z.string().trim().max(80).optional(),
  color: z.string().trim().max(40).optional(),
  isActive: z.boolean().default(true)
});
export const vehicleUpdateSchema = vehicleSchema.partial().refine((value) => Object.keys(value).length > 0);
export const documentUploadSchema = z.object({
  type: z.string().trim().min(2).max(80),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
  expiresAt: z.string().datetime().optional()
});
export const reviewDocumentSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"]),
    reason: z.string().trim().min(3).max(500).optional()
  })
  .refine((value) => value.status !== "REJECTED" || value.reason, "Can ly do tu choi");
export const reviewVehicleSchema = z.object({ status: z.enum(["APPROVED", "REJECTED"]) });
export const assetListSchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});
