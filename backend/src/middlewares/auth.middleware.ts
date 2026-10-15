import type { RequestHandler } from "express";
import { authenticate } from "../modules/auth/auth.service";
import { ApiError } from "../utils/api-error";
import type { RoleName } from "../utils/roles";
import { prisma } from "../config/prisma";
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) throw new ApiError(401, "AUTH_MISSING_TOKEN", "Vui long dang nhap");
    req.auth = await authenticate(header.slice(7));
    next();
  } catch (error) {
    next(error);
  }
};
export function authorize(...roles: RoleName[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth?.roles.some((role) => roles.includes(role)))
      return next(new ApiError(403, "AUTH_PERMISSION_DENIED", "Ban khong co quyen thuc hien thao tac nay"));
    next();
  };
}

export function authorizePermission(permissionKey: string, ...legacyRoles: RoleName[]): RequestHandler {
  return async (req, _res, next) => {
    try {
      if (!req.auth) throw new ApiError(401, "AUTH_MISSING_TOKEN", "Vui long dang nhap");
      const permission = await prisma.permission.findUnique({
        where: { key: permissionKey },
        select: { id: true }
      });
      if (!permission) {
        if (req.auth.roles.some((role) => legacyRoles.includes(role))) return next();
      } else {
        const granted = await prisma.rolePermission.count({
          where: {
            permissionId: permission.id,
            role: { users: { some: { userId: req.auth.userId } } }
          }
        });
        if (granted) return next();
      }
      return next(new ApiError(403, "AUTH_PERMISSION_DENIED", "Ban khong co quyen thuc hien thao tac nay"));
    } catch (error) {
      next(error);
    }
  };
}
