import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { ok } from "../../utils/response";
import * as service from "./payment.service";
import * as reconciliation from "./reconciliation.service";
import { requestRideRefund } from "../wallets/wallet.service";

export const getRidePayment = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.getRidePayment(req.auth!.userId, req.params.id as string, req.auth!.roles)));
});

export const vietQrWebhook = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.processVietQrWebhook(req.body), "IPN processed"));
});

export const createRefund = asyncHandler(async (req: Request, res: Response) => {
  res
    .status(201)
    .json(
      ok(
        await requestRideRefund(req.auth!.userId, req.params.id as string, req.body),
        "Yeu cau hoan tien da duoc tao"
      )
    );
});

export const runReconciliation = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await reconciliation.runReconciliation(req.auth!.userId), "Doi soat hoan tat"));
});

export const listReconciliationRuns = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await reconciliation.listReconciliationRuns(req.query as never)));
});

export const listReconciliationItems = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await reconciliation.listReconciliationItems(req.query as never)));
});

export const resolveReconciliationItem = asyncHandler(async (req: Request, res: Response) => {
  res.json(
    ok(
      await reconciliation.resolveReconciliationItem(req.params.id as string, req.auth!.userId, req.body),
      "Da xu ly ngoai le doi soat"
    )
  );
});
