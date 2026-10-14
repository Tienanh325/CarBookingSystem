import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { emitToUser } from "../../realtime/socket";
import { ApiError } from "../../utils/api-error";
import {
  createStoredNotification,
  pushConfiguration,
  removePushSubscription,
  savePushSubscription
} from "./notification.delivery";

export { pushConfiguration, removePushSubscription, savePushSubscription };

export async function listNotifications(
  userId: string,
  query: { unreadOnly?: boolean; page: number; limit: number }
) {
  const where = { userId, ...(query.unreadOnly ? { readAt: null } : {}) };
  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, readAt: null } })
  ]);
  return { items, total, unread, page: query.page, limit: query.limit };
}

export async function markNotificationRead(userId: string, id: string) {
  const changed = await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() }
  });
  if (!changed.count) {
    const exists = await prisma.notification.count({ where: { id, userId } });
    if (!exists) throw new ApiError(404, "NOTIFICATION_NOT_FOUND", "Khong tim thay thong bao");
  }
  return prisma.notification.findFirstOrThrow({ where: { id, userId } });
}

export async function markAllNotificationsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() }
  });
  return { updated: result.count };
}

export async function createNotification(input: {
  userId: string;
  title: string;
  body: string;
  data?: Prisma.InputJsonObject;
  push?: boolean;
}) {
  const notification = await createStoredNotification(input);
  emitToUser(input.userId, "notification.created", notification);
  return notification;
}
