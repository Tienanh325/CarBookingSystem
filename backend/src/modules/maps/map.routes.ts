import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as controller from "./map.controller";
import { addressSearchSchema, reverseGeocodeSchema } from "./map.schemas";

export const mapRouter = Router();
mapRouter.use(requireAuth);
mapRouter.get("/search", validate({ query: addressSearchSchema }), controller.search);
mapRouter.get("/reverse", validate({ query: reverseGeocodeSchema }), controller.reverse);
