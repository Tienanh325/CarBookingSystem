import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { ROLES } from "../../utils/roles";
import { estimateSchema } from "../pricing/pricing.schemas";
import * as controller from "./ride.controller";
import { cancelRideSchema, createRideSchema, ratingSchema, rideListQuerySchema, rideParamSchema } from "./ride.schemas";

export const rideRouter = Router();

rideRouter.use(requireAuth);

rideRouter.post("/estimate", authorize(ROLES.CUSTOMER, ROLES.ADMIN), validate({ body: estimateSchema }), controller.estimateRide);
rideRouter.post("/", authorize(ROLES.CUSTOMER), validate({ body: createRideSchema }), controller.createRide);
rideRouter.get("/current", validate({ query: rideListQuerySchema }), controller.getCurrentRide);
rideRouter.get("/", validate({ query: rideListQuerySchema }), controller.listRides);
rideRouter.get("/:id", validate({ params: rideParamSchema }), controller.getRideById);
rideRouter.post("/:id/cancel", authorize(ROLES.CUSTOMER), validate({ params: rideParamSchema, body: cancelRideSchema }), controller.cancelRide);
rideRouter.post("/:id/rating", authorize(ROLES.CUSTOMER), validate({ params: rideParamSchema, body: ratingSchema }), controller.rateRide);
