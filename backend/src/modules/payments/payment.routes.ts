import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { ROLES } from "../../utils/roles";
import * as controller from "./payment.controller";
import { createRefundSchema, paymentParamSchema, vietQrWebhookSchema } from "./payment.schemas";

export const paymentRouter = Router();

// Public endpoint authenticated with an HMAC signature in the request body.
paymentRouter.post("/vietqr/ipn", validate({ body: vietQrWebhookSchema }), controller.vietQrWebhook);
paymentRouter.get(
  "/rides/:id",
  requireAuth,
  authorize(ROLES.CUSTOMER, ROLES.ADMIN),
  validate({ params: paymentParamSchema }),
  controller.getRidePayment
);
paymentRouter.post(
  "/rides/:id/refunds",
  requireAuth,
  authorize(ROLES.CUSTOMER),
  validate({ params: paymentParamSchema, body: createRefundSchema }),
  controller.createRefund
);
