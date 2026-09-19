import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { created, ok } from "../../utils/response";
import * as service from "./customer.service";

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getMe(req.auth!.userId);
  res.json(ok(data));
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.updateMe(req.auth!.userId, req.body);
  res.json(ok(data, "Cap nhat ho so thanh cong"));
});

export const listAddresses = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.listAddresses(req.auth!.userId);
  res.json(ok(data));
});

export const createAddress = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.createAddress(req.auth!.userId, req.body);
  res.status(201).json(created(data, "Them dia chi thanh cong"));
});

export const deleteAddress = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.deleteAddress(req.auth!.userId, req.params.id as string);
  res.json(ok(data, "Xoa dia chi thanh cong"));
});
