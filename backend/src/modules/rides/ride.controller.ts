import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { created, ok } from "../../utils/response";
import * as service from "./ride.service";

export const estimateRide = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.estimateRideForCustomer(req.auth!.userId, req.body);
  res.json(ok(data));
});

export const createRide = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.createRide(req.auth!.userId, req.body);
  res.status(201).json(created(data, "Tao yeu cau dat xe thanh cong"));
});

export const getCurrentRide = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getCurrentRide(
    req.auth!.userId,
    req.auth!.roles,
    req.query.as as "customer" | "driver" | undefined
  );
  res.json(ok(data));
});

export const listRides = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.listRides(
    req.auth!.userId,
    req.auth!.roles,
    req.query.as as "customer" | "driver" | undefined
  );
  res.json(ok(data));
});

export const getRideById = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getRideById(req.params.id as string, req.auth!.userId, req.auth!.roles);
  res.json(ok(data));
});

export const getRideInvoice = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getRideInvoice(req.params.id as string, req.auth!.userId, req.auth!.roles);
  res.json(ok(data));
});

export const cancelRide = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.cancelRideByCustomer(req.params.id as string, req.auth!.userId, req.body.reason);
  res.json(ok(data, "Huy chuyen thanh cong"));
});

export const rateRide = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.rateRide(req.params.id as string, req.auth!.userId, req.body);
  res.status(201).json(created(data, "Danh gia thanh cong"));
});
