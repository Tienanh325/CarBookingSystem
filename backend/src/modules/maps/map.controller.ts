import type { Request, Response } from "express";
import { reverseAddress, searchAddress } from "../../integrations/geocoding.service";
import { asyncHandler } from "../../utils/async-handler";
import { ok } from "../../utils/response";

export const search = asyncHandler(async (req: Request, res: Response) => {
  const { q, lat, lng } = req.query as unknown as { q: string; lat?: number; lng?: number };
  res.json(ok(await searchAddress(q, lat != null && lng != null ? { lat, lng } : undefined)));
});

export const reverse = asyncHandler(async (req: Request, res: Response) => {
  const { lat, lng } = req.query as unknown as { lat: number; lng: number };
  res.json(ok(await reverseAddress(lat, lng)));
});
