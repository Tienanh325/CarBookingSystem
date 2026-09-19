import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { created, ok } from "../../utils/response";
import * as service from "./promotion.service";

export const validatePromotion = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.validatePromotionForFare(req.body.code, req.body.fare, req.auth?.userId);
  res.json(
    ok({
      promotionId: result.promotion.id,
      code: result.promotion.code,
      discount: result.discount,
      finalFare: result.finalFare
    })
  );
});

export const listPromotions = asyncHandler(async (_req: Request, res: Response) => {
  res.json(ok(await service.listPromotions()));
});

export const createPromotion = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(created(await service.createPromotion(req.body), "Tao khuyen mai thanh cong"));
});

export const updatePromotion = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.updatePromotion(req.params.id as string, req.body), "Cap nhat khuyen mai thanh cong"));
});
