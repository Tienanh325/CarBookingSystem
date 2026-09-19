import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { ok } from "../../utils/response";
import * as service from "./admin.service";

export const dashboard = asyncHandler(async (_req: Request, res: Response) => {
  res.json(ok(await service.dashboard()));
});

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.listUsers(req.query as never)));
});

export const updateUserStatus = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.updateUserStatus(req.params.id as string, req.body.status, req.auth!.userId), "Cap nhat trang thai user thanh cong"));
});

export const listDrivers = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.listDrivers(req.query as never)));
});

export const getDriver = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.getDriver(req.params.id as string)));
});

export const approveDriver = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.approveDriver(req.params.id as string, req.auth!.userId), "Duyet tai xe thanh cong"));
});

export const rejectDriver = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.rejectDriver(req.params.id as string, req.body.reason, req.auth!.userId), "Tu choi ho so tai xe thanh cong"));
});

export const listRides = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.listRides(req.query as never)));
});

export const getRide = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.getRide(req.params.id as string)));
});

export const cancelRide = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.cancelRide(req.params.id as string, req.body.reason, req.auth!.userId), "Admin da huy chuyen"));
});

export const listPayments = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.listPayments(req.query as never)));
});

export const revenueReport = asyncHandler(async (_req: Request, res: Response) => {
  res.json(ok(await service.revenueReport()));
});
