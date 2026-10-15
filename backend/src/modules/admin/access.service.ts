import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/api-error";

export const permissionCatalog = [
  ["dashboard.view", "Xem dashboard"],
  ["rides.view", "Xem chuyến"],
  ["rides.manage", "Quản lý chuyến"],
  ["drivers.view", "Xem tài xế"],
  ["drivers.review", "Duyệt tài xế"],
  ["documents.view", "Xem tài liệu"],
  ["documents.review", "Duyệt tài liệu"],
  ["vehicles.view", "Xem phương tiện"],
  ["vehicles.review", "Duyệt phương tiện"],
  ["finance.view", "Xem tài chính"],
  ["finance.manage", "Quản lý tài chính"],
  ["support.manage", "Xử lý hỗ trợ"],
  ["safety.manage", "Xử lý SOS"],
  ["users.view", "Xem người dùng"],
  ["users.manage", "Quản lý người dùng"],
  ["pricing.manage", "Quản lý giá và khuyến mãi"],
  ["access.manage", "Quản lý phân quyền"],
  ["audit.view", "Xem audit log"]
] as const;

export async function listAccessMatrix() {
  await Promise.all(
    permissionCatalog.map(([key, label]) =>
      prisma.permission.upsert({ where: { key }, create: { key, label }, update: { label } })
    )
  );
  return {
    roles: await prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: "asc" }
    }),
    permissions: await prisma.permission.findMany({ orderBy: { key: "asc" } })
  };
}

export async function updateRolePermissions(roleId: string, permissionIds: string[], actorId: string) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new ApiError(404, "ROLE_NOT_FOUND", "Khong tim thay vai tro");
  return prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId } });
    if (permissionIds.length)
      await tx.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId }))
      });
    await tx.auditLog.create({
      data: {
        actorId,
        action: "ROLE_PERMISSIONS_UPDATED",
        entityType: "ROLE",
        entityId: roleId,
        metadata: { permissionIds }
      }
    });
    await tx.authSession.deleteMany({
      where: { user: { roles: { some: { roleId } } } }
    });
    return tx.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } }
    });
  });
}

export async function updateUserRoles(userId: string, roleIds: string[], actorId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "USER_NOT_FOUND", "Khong tim thay nguoi dung");
  return prisma.$transaction(async (tx) => {
    await tx.userRole.deleteMany({ where: { userId } });
    if (roleIds.length) await tx.userRole.createMany({ data: roleIds.map((roleId) => ({ userId, roleId })) });
    await tx.authSession.deleteMany({ where: { userId } });
    await tx.auditLog.create({
      data: {
        actorId,
        action: "USER_ROLES_UPDATED",
        entityType: "USER",
        entityId: userId,
        metadata: { roleIds }
      }
    });
    return tx.user.findUnique({ where: { id: userId }, include: { roles: { include: { role: true } } } });
  });
}

export async function listAuditLogs(query: {
  action?: string;
  entityType?: string;
  page: number;
  limit: number;
}) {
  const where = {
    ...(query.action ? { action: { contains: query.action } } : {}),
    ...(query.entityType ? { entityType: query.entityType } : {})
  };
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, fullName: true, phone: true } } },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit
    }),
    prisma.auditLog.count({ where })
  ]);
  return { items, total, page: query.page, limit: query.limit };
}
