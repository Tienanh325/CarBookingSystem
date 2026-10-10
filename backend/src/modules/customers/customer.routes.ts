import { Router } from "express";
import { requireAuth, authorize } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { ROLES } from "../../utils/roles";
import * as controller from "./customer.controller";
import { createAddressSchema, idParamSchema, updateCustomerSchema } from "./customer.schemas";
import * as walletController from "../wallets/wallet.controller";
import { createTopUpSchema } from "../wallets/wallet.schemas";

export const customerRouter = Router();

customerRouter.use(requireAuth, authorize(ROLES.CUSTOMER, ROLES.ADMIN));

customerRouter.get("/me", controller.getMe);
customerRouter.patch("/me", validate({ body: updateCustomerSchema }), controller.updateMe);
customerRouter.get("/me/addresses", controller.listAddresses);
customerRouter.post("/me/addresses", validate({ body: createAddressSchema }), controller.createAddress);
customerRouter.delete("/me/addresses/:id", validate({ params: idParamSchema }), controller.deleteAddress);
customerRouter.get("/me/wallet", walletController.getCustomerWallet);
customerRouter.post("/me/wallet/top-ups", validate({ body: createTopUpSchema }), walletController.createTopUp);
