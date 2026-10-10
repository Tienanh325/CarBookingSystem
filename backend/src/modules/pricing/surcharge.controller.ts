import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { created, ok } from "../../utils/response";
import * as service from "./pricing.service";

export const listRules = asyncHandler(async (_req: Request, res: Response) => {
  res.json(ok(await service.listSurchargeRules()));
});
export const createRule = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(created(await service.createSurchargeRule(req.body), "Tao phu phi thanh cong"));
});
export const updateRule = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.updateSurchargeRule(req.params.id as string, req.body), "Cap nhat phu phi thanh cong"));
});
export const getContext = asyncHandler(async (_req: Request, res: Response) => {
  res.json(ok(await service.getPricingContext()));
});
export const updateWeather = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.updateWeatherCondition(req.body.weatherCondition), "Cap nhat thoi tiet thanh cong"));
});
