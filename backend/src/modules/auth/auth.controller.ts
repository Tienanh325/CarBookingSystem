import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { created, ok } from "../../utils/response";
import * as authService from "./auth.service";
import { revokeSockets } from "../../realtime/socket";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.registerCustomer(req.body);
  res.status(201).json(created(result, "Dang ky thanh cong"));
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body);
  res.json(ok(result, "Dang nhap thanh cong"));
});

export const sendOtp = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.sendOtp(req.body.phone);
  res.json(ok(result, "Da gui OTP"));
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.verifyOtp(req.body.phone, req.body.otp);
  res.json(ok(result, "Xac thuc OTP thanh cong"));
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.refreshToken(req.body.refreshToken);
  res.json(ok(result, "Lam moi token thanh cong"));
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await authService.logout(req.auth!.sessionId);
  revokeSockets(req.auth!.sessionId);
  res.json(ok({ loggedOut: true }, "Dang xuat thanh cong"));
});
