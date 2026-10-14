import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { ROLES } from "../../utils/roles";
import * as controller from "./safety.controller";
import {
  emergencyContactSchema,
  idSchema,
  rideMessageSchema,
  safetyListSchema,
  shareRideSchema,
  sosSchema,
  sosStatusSchema,
  tokenSchema
} from "./safety.schemas";

export const safetyRouter = Router();
safetyRouter.get("/share/:token", validate({ params: tokenSchema }), controller.sharedRide);
safetyRouter.use(requireAuth);
safetyRouter.get("/emergency-contacts", controller.contacts);
safetyRouter.post(
  "/emergency-contacts",
  validate({ body: emergencyContactSchema }),
  controller.createContact
);
safetyRouter.delete("/emergency-contacts/:id", validate({ params: idSchema }), controller.deleteContact);
safetyRouter.post("/sos", validate({ body: sosSchema }), controller.createSos);
safetyRouter.get(
  "/sos",
  authorize(ROLES.ADMIN, ROLES.OPERATOR, ROLES.SUPPORT),
  validate({ query: safetyListSchema }),
  controller.listSos
);
safetyRouter.patch(
  "/sos/:id",
  authorize(ROLES.ADMIN, ROLES.OPERATOR, ROLES.SUPPORT),
  validate({ params: idSchema, body: sosStatusSchema }),
  controller.updateSos
);
safetyRouter.post(
  "/rides/:id/share",
  validate({ params: idSchema, body: shareRideSchema }),
  controller.shareRide
);
safetyRouter.get("/rides/:id/messages", validate({ params: idSchema }), controller.messages);
safetyRouter.post(
  "/rides/:id/messages",
  validate({ params: idSchema, body: rideMessageSchema }),
  controller.sendMessage
);
safetyRouter.get("/rides/:id/contact", validate({ params: idSchema }), controller.contact);
