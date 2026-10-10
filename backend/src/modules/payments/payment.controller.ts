import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { ok } from "../../utils/response";
import * as service from "./payment.service";

export const getRidePayment = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.getRidePayment(req.auth!.userId, req.params.id as string)));
});

export const vietQrWebhook = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.processVietQrWebhook(req.body), "IPN processed"));
});
