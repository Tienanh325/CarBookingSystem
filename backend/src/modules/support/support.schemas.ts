import { z } from "zod";

export const ticketParamSchema = z.object({ id: z.string().uuid() });
export const createTicketSchema = z.object({
  rideId: z.string().uuid().optional(),
  subject: z.string().trim().min(3).max(191),
  description: z.string().trim().min(5).max(5000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM")
});
export const ticketMessageSchema = z.object({ body: z.string().trim().min(1).max(5000) });
export const ticketListSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});
export const updateTicketSchema = z
  .object({
    status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    assignedToId: z.string().uuid().nullable().optional(),
    resolution: z.string().trim().max(5000).nullable().optional()
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), "Can it nhat mot thay doi");
