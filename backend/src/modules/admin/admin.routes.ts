import { Router } from "express";
import { authorizePermission, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { ROLES } from "../../utils/roles";
import { asyncHandler } from "../../utils/async-handler";
import { ok } from "../../utils/response";
import * as controller from "./admin.controller";
import {
  adminCancelRideSchema,
  financeReportSchema,
  idParamSchema,
  listQuerySchema,
  rejectDriverSchema,
  updateUserStatusSchema
} from "./admin.schemas";
import * as promotionController from "../promotions/promotion.controller";
import {
  createPromotionSchema,
  promotionParamSchema,
  updatePromotionSchema
} from "../promotions/promotion.schemas";
import * as walletController from "../wallets/wallet.controller";
import {
  refundListSchema,
  refundParamSchema,
  rejectRefundSchema,
  rejectWithdrawalSchema,
  withdrawalListSchema,
  withdrawalParamSchema
} from "../wallets/wallet.schemas";
import * as paymentController from "../payments/payment.controller";
import {
  reconciliationListSchema,
  reconciliationRunListSchema,
  resolveReconciliationSchema
} from "../payments/payment.schemas";
import * as supportController from "../support/support.controller";
import {
  ticketListSchema,
  ticketMessageSchema,
  ticketParamSchema,
  updateTicketSchema
} from "../support/support.schemas";
import * as driverAssets from "../drivers/driver-assets.service";
import {
  assetIdSchema,
  assetListSchema,
  reviewDocumentSchema,
  reviewVehicleSchema
} from "../drivers/driver-assets.schemas";
import * as accessService from "./access.service";
import { auditListSchema, roleParamSchema, rolePermissionsSchema, userRolesSchema } from "./access.schemas";

export const adminRouter = Router();

adminRouter.use(requireAuth);

adminRouter.get(
  "/dashboard",
  authorizePermission("dashboard.view", ROLES.ADMIN, ROLES.OPERATOR, ROLES.ACCOUNTANT),
  controller.dashboard
);

adminRouter.get(
  "/users",
  authorizePermission("users.view", ROLES.ADMIN, ROLES.SUPPORT),
  validate({ query: listQuerySchema }),
  controller.listUsers
);
adminRouter.patch(
  "/users/:id/status",
  authorizePermission("users.manage", ROLES.ADMIN),
  validate({ params: idParamSchema, body: updateUserStatusSchema }),
  controller.updateUserStatus
);

adminRouter.get(
  "/access",
  authorizePermission("access.manage", ROLES.ADMIN),
  asyncHandler(async (_req, res) => res.json(ok(await accessService.listAccessMatrix())))
);
adminRouter.put(
  "/access/roles/:id/permissions",
  authorizePermission("access.manage", ROLES.ADMIN),
  validate({ params: roleParamSchema, body: rolePermissionsSchema }),
  asyncHandler(async (req, res) =>
    res.json(
      ok(
        await accessService.updateRolePermissions(
          req.params.id as string,
          req.body.permissionIds,
          req.auth!.userId
        )
      )
    )
  )
);
adminRouter.put(
  "/users/:id/roles",
  authorizePermission("access.manage", ROLES.ADMIN),
  validate({ params: idParamSchema, body: userRolesSchema }),
  asyncHandler(async (req, res) =>
    res.json(
      ok(await accessService.updateUserRoles(req.params.id as string, req.body.roleIds, req.auth!.userId))
    )
  )
);
adminRouter.get(
  "/audit-logs",
  authorizePermission("audit.view", ROLES.ADMIN, ROLES.SUPPORT, ROLES.ACCOUNTANT),
  validate({ query: auditListSchema }),
  asyncHandler(async (req, res) => res.json(ok(await accessService.listAuditLogs(req.query as never))))
);

adminRouter.get(
  "/drivers",
  authorizePermission("drivers.view", ROLES.ADMIN, ROLES.OPERATOR),
  validate({ query: listQuerySchema }),
  controller.listDrivers
);
adminRouter.get(
  "/drivers/:id",
  authorizePermission("drivers.view", ROLES.ADMIN, ROLES.OPERATOR),
  validate({ params: idParamSchema }),
  controller.getDriver
);
adminRouter.post(
  "/drivers/:id/approve",
  authorizePermission("drivers.review", ROLES.ADMIN),
  validate({ params: idParamSchema }),
  controller.approveDriver
);

adminRouter.get(
  "/driver-documents",
  authorizePermission("documents.view", ROLES.ADMIN, ROLES.OPERATOR),
  validate({ query: assetListSchema }),
  asyncHandler(async (req, res) =>
    res.json(ok(await driverAssets.listAllAssets("documents", req.query as never)))
  )
);
adminRouter.get(
  "/driver-documents/:id/download-url",
  authorizePermission("documents.view", ROLES.ADMIN, ROLES.OPERATOR),
  validate({ params: assetIdSchema }),
  asyncHandler(async (req, res) =>
    res.json(ok(await driverAssets.documentDownload(req.auth!.userId, req.params.id as string, true)))
  )
);
adminRouter.patch(
  "/driver-documents/:id/review",
  authorizePermission("documents.review", ROLES.ADMIN),
  validate({ params: assetIdSchema, body: reviewDocumentSchema }),
  asyncHandler(async (req, res) =>
    res.json(ok(await driverAssets.reviewDocument(req.params.id as string, req.auth!.userId, req.body)))
  )
);
adminRouter.get(
  "/vehicles",
  authorizePermission("vehicles.view", ROLES.ADMIN, ROLES.OPERATOR),
  validate({ query: assetListSchema }),
  asyncHandler(async (req, res) =>
    res.json(ok(await driverAssets.listAllAssets("vehicles", req.query as never)))
  )
);
adminRouter.patch(
  "/vehicles/:id/review",
  authorizePermission("vehicles.review", ROLES.ADMIN),
  validate({ params: assetIdSchema, body: reviewVehicleSchema }),
  asyncHandler(async (req, res) =>
    res.json(ok(await driverAssets.reviewVehicle(req.params.id as string, req.body.status)))
  )
);

adminRouter.get(
  "/support/tickets",
  authorizePermission("support.manage", ROLES.ADMIN, ROLES.SUPPORT),
  validate({ query: ticketListSchema }),
  supportController.listAll
);
adminRouter.get(
  "/support/tickets/:id",
  authorizePermission("support.manage", ROLES.ADMIN, ROLES.SUPPORT),
  validate({ params: ticketParamSchema }),
  supportController.detail
);
adminRouter.patch(
  "/support/tickets/:id",
  authorizePermission("support.manage", ROLES.ADMIN, ROLES.SUPPORT),
  validate({ params: ticketParamSchema, body: updateTicketSchema }),
  supportController.update
);
adminRouter.post(
  "/support/tickets/:id/messages",
  authorizePermission("support.manage", ROLES.ADMIN, ROLES.SUPPORT),
  validate({ params: ticketParamSchema, body: ticketMessageSchema }),
  supportController.message
);
adminRouter.post(
  "/drivers/:id/reject",
  authorizePermission("drivers.review", ROLES.ADMIN),
  validate({ params: idParamSchema, body: rejectDriverSchema }),
  controller.rejectDriver
);

adminRouter.get(
  "/rides",
  authorizePermission("rides.view", ROLES.ADMIN, ROLES.OPERATOR, ROLES.SUPPORT, ROLES.ACCOUNTANT),
  validate({ query: listQuerySchema }),
  controller.listRides
);
adminRouter.get(
  "/rides/:id",
  authorizePermission("rides.view", ROLES.ADMIN, ROLES.OPERATOR, ROLES.SUPPORT, ROLES.ACCOUNTANT),
  validate({ params: idParamSchema }),
  controller.getRide
);
adminRouter.post(
  "/rides/:id/cancel",
  authorizePermission("rides.manage", ROLES.ADMIN, ROLES.OPERATOR),
  validate({ params: idParamSchema, body: adminCancelRideSchema }),
  controller.cancelRide
);

adminRouter.get(
  "/payments",
  authorizePermission("finance.view", ROLES.ADMIN, ROLES.ACCOUNTANT),
  validate({ query: listQuerySchema }),
  controller.listPayments
);
adminRouter.get(
  "/reports/revenue",
  authorizePermission("finance.view", ROLES.ADMIN, ROLES.ACCOUNTANT),
  controller.revenueReport
);
adminRouter.get(
  "/reports/finance.csv",
  authorizePermission("finance.view", ROLES.ADMIN, ROLES.ACCOUNTANT),
  validate({ query: financeReportSchema }),
  controller.financeCsvReportDownload
);

adminRouter.post(
  "/reconciliation/run",
  authorizePermission("finance.manage", ROLES.ADMIN, ROLES.ACCOUNTANT),
  paymentController.runReconciliation
);
adminRouter.get(
  "/reconciliation/runs",
  authorizePermission("finance.view", ROLES.ADMIN, ROLES.ACCOUNTANT),
  validate({ query: reconciliationRunListSchema }),
  paymentController.listReconciliationRuns
);
adminRouter.get(
  "/reconciliation/items",
  authorizePermission("finance.view", ROLES.ADMIN, ROLES.ACCOUNTANT),
  validate({ query: reconciliationListSchema }),
  paymentController.listReconciliationItems
);
adminRouter.post(
  "/reconciliation/items/:id/resolve",
  authorizePermission("finance.manage", ROLES.ADMIN, ROLES.ACCOUNTANT),
  validate({ params: idParamSchema, body: resolveReconciliationSchema }),
  paymentController.resolveReconciliationItem
);

adminRouter.get(
  "/withdrawals",
  authorizePermission("finance.view", ROLES.ADMIN, ROLES.ACCOUNTANT),
  validate({ query: withdrawalListSchema }),
  walletController.listWithdrawals
);
adminRouter.post(
  "/withdrawals/:id/approve",
  authorizePermission("finance.manage", ROLES.ADMIN, ROLES.ACCOUNTANT),
  validate({ params: withdrawalParamSchema }),
  walletController.approveWithdrawal
);
adminRouter.post(
  "/withdrawals/:id/reject",
  authorizePermission("finance.manage", ROLES.ADMIN, ROLES.ACCOUNTANT),
  validate({ params: withdrawalParamSchema, body: rejectWithdrawalSchema }),
  walletController.rejectWithdrawal
);

adminRouter.get(
  "/refunds",
  authorizePermission("finance.view", ROLES.ADMIN, ROLES.ACCOUNTANT),
  validate({ query: refundListSchema }),
  walletController.listRefunds
);
adminRouter.post(
  "/refunds/:id/approve",
  authorizePermission("finance.manage", ROLES.ADMIN, ROLES.ACCOUNTANT),
  validate({ params: refundParamSchema }),
  walletController.approveRefund
);
adminRouter.post(
  "/refunds/:id/reject",
  authorizePermission("finance.manage", ROLES.ADMIN, ROLES.ACCOUNTANT),
  validate({ params: refundParamSchema, body: rejectRefundSchema }),
  walletController.rejectRefund
);

adminRouter.get(
  "/promotions",
  authorizePermission("pricing.manage", ROLES.ADMIN),
  promotionController.listPromotions
);
adminRouter.post(
  "/promotions",
  authorizePermission("pricing.manage", ROLES.ADMIN),
  validate({ body: createPromotionSchema }),
  promotionController.createPromotion
);
adminRouter.patch(
  "/promotions/:id",
  authorizePermission("pricing.manage", ROLES.ADMIN),
  validate({ params: promotionParamSchema, body: updatePromotionSchema }),
  promotionController.updatePromotion
);
