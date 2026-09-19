import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { ROLES } from "../../utils/roles";
import * as controller from "./pricing.controller";
import { createPricingRuleSchema, pricingRuleParamSchema, updatePricingRuleSchema } from "./pricing.schemas";

export const pricingRouter = Router();

pricingRouter.use(requireAuth, authorize(ROLES.ADMIN));
pricingRouter.get("/", controller.listPricingRules);
pricingRouter.post("/", validate({ body: createPricingRuleSchema }), controller.createPricingRule);
pricingRouter.patch("/:id", validate({ params: pricingRuleParamSchema, body: updatePricingRuleSchema }), controller.updatePricingRule);
