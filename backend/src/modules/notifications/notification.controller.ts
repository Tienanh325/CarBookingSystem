import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { ok } from "../../utils/response";
import * as service from "./notification.service";

export const list = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.listNotifications(req.auth!.userId, req.query as never)));
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.markNotificationRead(req.auth!.userId, req.params.id as string)));
});

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.markAllNotificationsRead(req.auth!.userId)));
});

export const pushConfig = asyncHandler(async (_req: Request, res: Response) => {
  res.json(ok(service.pushConfiguration()));
});

export const subscribePush = asyncHandler(async (req: Request, res: Response) => {
  res.json(
    ok(await service.savePushSubscription(req.auth!.userId, req.body, req.get("user-agent") ?? undefined))
  );
});

export const unsubscribePush = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.removePushSubscription(req.auth!.userId, req.body.endpoint)));
});
