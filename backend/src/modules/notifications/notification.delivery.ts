import type { Prisma } from "@prisma/client";
import webPush from "web-push";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/api-error";

const pushConfigured = Boolean(env.webPushPublicKey && env.webPushPrivateKey);
if (env.webPushPublicKey && env.webPushPrivateKey) {
  webPush.setVapidDetails(env.webPushSubject, env.webPushPublicKey, env.webPushPrivateKey);
}

export async function savePushSubscription(
  userId: string,
  input: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string
) {
  if (!pushConfigured) {
    throw new ApiError(503, "PUSH_NOT_CONFIGURED", "Push notification chua duoc cau hinh");
  }
  return prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      userId,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent
    },
    update: {
      userId,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent
    }
  });
}

export async function removePushSubscription(userId: string, endpoint: string) {
  const result = await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  return { removed: result.count };
}

export function pushConfiguration() {
  return { enabled: pushConfigured, publicKey: pushConfigured ? env.webPushPublicKey : null };
}

export async function createStoredNotification(input: {
  userId: string;
  title: string;
  body: string;
  data?: Prisma.InputJsonObject;
  push?: boolean;
}) {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      body: input.body,
      channel: "IN_APP",
      data: input.data
    }
  });

  if (input.push && pushConfigured) {
    const subscriptions = await prisma.pushSubscription.findMany({ where: { userId: input.userId } });
    let delivered = false;
    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth }
            },
            JSON.stringify({
              title: input.title,
              body: input.body,
              data: input.data ?? {},
              notificationId: notification.id
            })
          );
          delivered = true;
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await prisma.pushSubscription.deleteMany({ where: { id: subscription.id } });
          }
        }
      })
    );
    if (delivered) {
      return prisma.notification.update({
        where: { id: notification.id },
        data: { deliveredAt: new Date() }
      });
    }
  }
  return notification;
}
