import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { created, ok } from "../../utils/response";
import * as service from "./driver.service";

export const registerDriver = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.registerDriver(req.auth!.userId, req.body);
  res.status(201).json(created(data, "Dang ky tai xe thanh cong, vui long cho admin duyet"));
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.getMe(req.auth!.userId)));
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.updateMe(req.auth!.userId, req.body), "Cap nhat ho so tai xe thanh cong"));
});

export const goOnline = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.setOnline(req.auth!.userId, true), "Tai xe da online"));
});

export const goOffline = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.setOnline(req.auth!.userId, false), "Tai xe da offline"));
});

export const updateLocation = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.updateLocation(req.auth!.userId, req.body), "Cap nhat vi tri thanh cong"));
});

export const listRideRequests = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.listRideRequests(req.auth!.userId)));
});

export const acceptRide = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.acceptRide(req.auth!.userId, req.params.id as string), "Nhan chuyen thanh cong"));
});

export const rejectRide = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.rejectRide(req.auth!.userId, req.params.id as string), "Da tu choi chuyen"));
});

export const markArrived = asyncHandler(async (req: Request, res: Response) => {
  res.json(
    ok(await service.markArrived(req.auth!.userId, req.params.id as string), "Da cap nhat den diem don")
  );
});

export const markHeadingToPickup = asyncHandler(async (req: Request, res: Response) => {
  res.json(
    ok(
      await service.markHeadingToPickup(req.auth!.userId, req.params.id as string),
      "Tai xe dang den diem don"
    )
  );
});

export const startRide = asyncHandler(async (req: Request, res: Response) => {
  res.json(
    ok(
      await service.startRide(req.auth!.userId, req.params.id as string, req.body.pin),
      "Bat dau chuyen thanh cong"
    )
  );
});

export const completeRide = asyncHandler(async (req: Request, res: Response) => {
  res.json(
    ok(await service.completeRide(req.auth!.userId, req.params.id as string), "Hoan thanh chuyen thanh cong")
  );
});

export const cancelRide = asyncHandler(async (req: Request, res: Response) => {
  res.json(
    ok(
      await service.cancelRide(req.auth!.userId, req.params.id as string, req.body.reason),
      "Da chuyen cuoc sang tim tai xe khac"
    )
  );
});

export const getEarnings = asyncHandler(async (req: Request, res: Response) => {
  res.json(ok(await service.getEarnings(req.auth!.userId)));
});
