import type { RequestHandler } from "express";
import { authenticate } from "../modules/auth/auth.service";
import { ApiError } from "../utils/api-error";
import type { RoleName } from "../utils/roles";
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) throw new ApiError(401, "AUTH_MISSING_TOKEN", "Vui long dang nhap");
    req.auth = await authenticate(header.slice(7));
    next();
  } catch (error) { next(error); }
};
export function authorize(...roles: RoleName[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth?.roles.some(role => roles.includes(role))) return next(new ApiError(403, "AUTH_PERMISSION_DENIED", "Ban khong co quyen thuc hien thao tac nay"));
    next();
  };
}
