import { z } from "zod";

export const notificationListSchema = z.object({
  unreadOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const notificationParamSchema = z.object({ id: z.string().uuid() });

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(512),
  keys: z.object({
    p256dh: z.string().min(20).max(512),
    auth: z.string().min(8).max(512)
  })
});

export const removePushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(512)
});
