import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes";
import { customerRouter } from "../modules/customers/customer.routes";
import { driverRouter } from "../modules/drivers/driver.routes";
import { rideRouter } from "../modules/rides/ride.routes";
import { adminRouter } from "../modules/admin/admin.routes";
import { pricingRouter } from "../modules/pricing/pricing.routes";
import { promotionRouter } from "../modules/promotions/promotion.routes";
import { prisma } from "../config/prisma";
import { asyncHandler } from "../utils/async-handler";
import { ok } from "../utils/response";
import { mapRouter } from "../modules/maps/map.routes";

export const apiRouter = Router();
apiRouter.get("/vehicle-types", asyncHandler(async (_req, res) => {
  res.json(ok(await prisma.vehicleType.findMany({ where: { isActive: true }, orderBy: { capacity: "asc" } })));
}));

apiRouter.use("/auth", authRouter);
apiRouter.use("/customers", customerRouter);
apiRouter.use("/drivers", driverRouter);
apiRouter.use("/rides", rideRouter);
apiRouter.use("/maps", mapRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/admin/pricing-rules", pricingRouter);
apiRouter.use("/promotions", promotionRouter);
