import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { created, ok } from "../../utils/response";
import * as service from "./wallet.service";

export const getCustomerWallet = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.getCustomerWallet(req.auth!.userId)));
});

export const createTopUp = asyncHandler(async (req: Request, res: Response) => {
  res
    .status(201)
    .json(
      created(await service.createTopUp(req.auth!.userId, req.body.amount), "Tao ma nap tien thanh cong")
    );
});

export const getDriverWallet = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.getDriverWallet(req.auth!.userId)));
});

export const createWithdrawal = asyncHandler(async (req: Request, res: Response) => {
  res
    .status(201)
    .json(
      created(await service.createWithdrawal(req.auth!.userId, req.body), "Tao yeu cau rut tien thanh cong")
    );
});

export const listWithdrawals = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.listWithdrawals(req.query as never)));
});

export const approveWithdrawal = asyncHandler(async (req: Request, res: Response) => {
  res.json(
    ok(
      await service.reviewWithdrawal(req.params.id as string, req.auth!.userId, true),
      "Duyet rut tien thanh cong"
    )
  );
});

export const rejectWithdrawal = asyncHandler(async (req: Request, res: Response) => {
  res.json(
    ok(
      await service.reviewWithdrawal(req.params.id as string, req.auth!.userId, false, req.body.reason),
      "Tu choi rut tien thanh cong"
    )
  );
});

export const listRefunds = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.listRefunds(req.query as never)));
});

export const approveRefund = asyncHandler(async (req: Request, res: Response) => {
  res.json(
    ok(
      await service.reviewRefund(req.params.id as string, req.auth!.userId, true),
      "Duyet hoan tien thanh cong"
    )
  );
});

export const rejectRefund = asyncHandler(async (req: Request, res: Response) => {
  res.json(
    ok(
      await service.reviewRefund(req.params.id as string, req.auth!.userId, false, req.body.reason),
      "Tu choi hoan tien thanh cong"
    )
  );
});
