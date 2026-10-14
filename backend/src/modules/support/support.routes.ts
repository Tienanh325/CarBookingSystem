import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as controller from "./support.controller";
import {
  createTicketSchema,
  ticketListSchema,
  ticketMessageSchema,
  ticketParamSchema
} from "./support.schemas";

export const supportRouter = Router();
supportRouter.use(requireAuth);
supportRouter.get(
  "/tickets",
  validate({ query: ticketListSchema.pick({ page: true, limit: true }) }),
  controller.listOwn
);
supportRouter.post("/tickets", validate({ body: createTicketSchema }), controller.create);
supportRouter.get("/tickets/:id", validate({ params: ticketParamSchema }), controller.detail);
supportRouter.post(
  "/tickets/:id/messages",
  validate({ params: ticketParamSchema, body: ticketMessageSchema }),
  controller.message
);
