import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { created, ok } from "../../utils/response";
import * as service from "./pricing.service";

export const estimateRide = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.estimateRide(req.body, req.auth?.userId);
  res.json(ok(data));
});

export const listPricingRules = asyncHandler(async (_req: Request, res: Response) => {
  res.json(ok(await service.listPricingRules()));
});

export const createPricingRule = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(created(await service.createPricingRule(req.body), "Tao cau hinh gia thanh cong"));
});

export const updatePricingRule = asyncHandler(async (req: Request, res: Response) => {
  res.json(
    ok(await service.updatePricingRule(req.params.id as string, req.body), "Cap nhat cau hinh gia thanh cong")
  );
});
