import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as controller from "./notification.controller";
import {
  notificationListSchema,
  notificationParamSchema,
  pushSubscriptionSchema,
  removePushSubscriptionSchema
} from "./notification.schemas";

export const notificationRouter = Router();
notificationRouter.use(requireAuth);
notificationRouter.get("/", validate({ query: notificationListSchema }), controller.list);
notificationRouter.post("/read-all", controller.markAllRead);
notificationRouter.patch("/:id/read", validate({ params: notificationParamSchema }), controller.markRead);
notificationRouter.get("/push/config", controller.pushConfig);
notificationRouter.post(
  "/push/subscriptions",
  validate({ body: pushSubscriptionSchema }),
  controller.subscribePush
);
notificationRouter.delete(
  "/push/subscriptions",
  validate({ body: removePushSubscriptionSchema }),
  controller.unsubscribePush
);
