import { z } from "zod";
export const roleParamSchema = z.object({ id: z.string().uuid() });
export const rolePermissionsSchema = z.object({ permissionIds: z.array(z.string().uuid()).max(100) });
export const userRolesSchema = z.object({ roleIds: z.array(z.string().uuid()).min(1).max(10) });
export const auditListSchema = z.object({
  action: z.string().max(100).optional(),
  entityType: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});
