import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { ROLES } from "../../utils/roles";
import * as controller from "./surcharge.controller";
import { createSurchargeRuleSchema, pricingRuleParamSchema, updateSurchargeRuleSchema, weatherContextSchema } from "./pricing.schemas";

export const surchargeRouter = Router();
surchargeRouter.use(requireAuth, authorize(ROLES.ADMIN, ROLES.OPERATOR));
surchargeRouter.get("/", controller.listRules);
surchargeRouter.post("/", authorize(ROLES.ADMIN), validate({ body: createSurchargeRuleSchema }), controller.createRule);
surchargeRouter.get("/context/weather", controller.getContext);
surchargeRouter.patch("/context/weather", validate({ body: weatherContextSchema }), controller.updateWeather);
surchargeRouter.patch("/:id", authorize(ROLES.ADMIN), validate({ params: pricingRuleParamSchema, body: updateSurchargeRuleSchema }), controller.updateRule);
