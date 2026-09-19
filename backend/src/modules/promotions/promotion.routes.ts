import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { validatePromotionSchema } from "./promotion.schemas";
import * as controller from "./promotion.controller";

export const promotionRouter = Router();

promotionRouter.post("/validate", requireAuth, validate({ body: validatePromotionSchema }), controller.validatePromotion);
