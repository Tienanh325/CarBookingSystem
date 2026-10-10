import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { ROLES } from "../../utils/roles";
import * as controller from "./driver.controller";
import {
  driverCancelRideSchema,
  registerDriverSchema,
  rideParamSchema,
  updateDriverSchema,
  updateLocationSchema
} from "./driver.schemas";
import * as walletController from "../wallets/wallet.controller";
import { createWithdrawalSchema } from "../wallets/wallet.schemas";

export const driverRouter = Router();

driverRouter.use(requireAuth);

driverRouter.post("/register", validate({ body: registerDriverSchema }), controller.registerDriver);

driverRouter.use(authorize(ROLES.DRIVER, ROLES.ADMIN));

driverRouter.get("/me", controller.getMe);
driverRouter.patch("/me", validate({ body: updateDriverSchema }), controller.updateMe);
driverRouter.post("/me/online", controller.goOnline);
driverRouter.post("/me/offline", controller.goOffline);
driverRouter.post("/me/location", validate({ body: updateLocationSchema }), controller.updateLocation);
driverRouter.get("/me/ride-requests", controller.listRideRequests);
driverRouter.get("/me/earnings", controller.getEarnings);
driverRouter.get("/me/wallet", walletController.getDriverWallet);
driverRouter.post("/me/withdrawals", validate({ body: createWithdrawalSchema }), walletController.createWithdrawal);

driverRouter.post("/rides/:id/accept", validate({ params: rideParamSchema }), controller.acceptRide);
driverRouter.post("/rides/:id/reject", validate({ params: rideParamSchema }), controller.rejectRide);
driverRouter.post("/rides/:id/arrived", validate({ params: rideParamSchema }), controller.markArrived);
driverRouter.post("/rides/:id/start", validate({ params: rideParamSchema }), controller.startRide);
driverRouter.post("/rides/:id/complete", validate({ params: rideParamSchema }), controller.completeRide);
driverRouter.post(
  "/rides/:id/cancel",
  validate({ params: rideParamSchema, body: driverCancelRideSchema }),
  controller.cancelRide
);
