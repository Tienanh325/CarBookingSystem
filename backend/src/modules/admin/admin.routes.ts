import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { ROLES } from "../../utils/roles";
import * as controller from "./admin.controller";
import {
  adminCancelRideSchema,
  idParamSchema,
  listQuerySchema,
  rejectDriverSchema,
  updateUserStatusSchema
} from "./admin.schemas";
import * as promotionController from "../promotions/promotion.controller";
import { createPromotionSchema, promotionParamSchema, updatePromotionSchema } from "../promotions/promotion.schemas";
import * as walletController from "../wallets/wallet.controller";
import { rejectWithdrawalSchema, withdrawalListSchema, withdrawalParamSchema } from "../wallets/wallet.schemas";

export const adminRouter = Router();

adminRouter.use(requireAuth);

adminRouter.get(
  "/dashboard",
  authorize(ROLES.ADMIN, ROLES.OPERATOR, ROLES.ACCOUNTANT),
  controller.dashboard
);

adminRouter.get(
  "/users",
  authorize(ROLES.ADMIN, ROLES.SUPPORT),
  validate({ query: listQuerySchema }),
  controller.listUsers
);
adminRouter.patch(
  "/users/:id/status",
  authorize(ROLES.ADMIN),
  validate({ params: idParamSchema, body: updateUserStatusSchema }),
  controller.updateUserStatus
);

adminRouter.get(
  "/drivers",
  authorize(ROLES.ADMIN, ROLES.OPERATOR),
  validate({ query: listQuerySchema }),
  controller.listDrivers
);
adminRouter.get(
  "/drivers/:id",
  authorize(ROLES.ADMIN, ROLES.OPERATOR),
  validate({ params: idParamSchema }),
  controller.getDriver
);
adminRouter.post(
  "/drivers/:id/approve",
  authorize(ROLES.ADMIN),
  validate({ params: idParamSchema }),
  controller.approveDriver
);
adminRouter.post(
  "/drivers/:id/reject",
  authorize(ROLES.ADMIN),
  validate({ params: idParamSchema, body: rejectDriverSchema }),
  controller.rejectDriver
);

adminRouter.get(
  "/rides",
  authorize(ROLES.ADMIN, ROLES.OPERATOR, ROLES.SUPPORT, ROLES.ACCOUNTANT),
  validate({ query: listQuerySchema }),
  controller.listRides
);
adminRouter.get(
  "/rides/:id",
  authorize(ROLES.ADMIN, ROLES.OPERATOR, ROLES.SUPPORT, ROLES.ACCOUNTANT),
  validate({ params: idParamSchema }),
  controller.getRide
);
adminRouter.post(
  "/rides/:id/cancel",
  authorize(ROLES.ADMIN, ROLES.OPERATOR),
  validate({ params: idParamSchema, body: adminCancelRideSchema }),
  controller.cancelRide
);

adminRouter.get(
  "/payments",
  authorize(ROLES.ADMIN, ROLES.ACCOUNTANT),
  validate({ query: listQuerySchema }),
  controller.listPayments
);
adminRouter.get(
  "/reports/revenue",
  authorize(ROLES.ADMIN, ROLES.ACCOUNTANT),
  controller.revenueReport
);

adminRouter.get(
  "/withdrawals",
  authorize(ROLES.ADMIN, ROLES.ACCOUNTANT),
  validate({ query: withdrawalListSchema }),
  walletController.listWithdrawals
);
adminRouter.post(
  "/withdrawals/:id/approve",
  authorize(ROLES.ADMIN, ROLES.ACCOUNTANT),
  validate({ params: withdrawalParamSchema }),
  walletController.approveWithdrawal
);
adminRouter.post(
  "/withdrawals/:id/reject",
  authorize(ROLES.ADMIN, ROLES.ACCOUNTANT),
  validate({ params: withdrawalParamSchema, body: rejectWithdrawalSchema }),
  walletController.rejectWithdrawal
);

adminRouter.get("/promotions", authorize(ROLES.ADMIN), promotionController.listPromotions);
adminRouter.post(
  "/promotions",
  authorize(ROLES.ADMIN),
  validate({ body: createPromotionSchema }),
  promotionController.createPromotion
);
adminRouter.patch(
  "/promotions/:id",
  authorize(ROLES.ADMIN),
  validate({ params: promotionParamSchema, body: updatePromotionSchema }),
  promotionController.updatePromotion
);
