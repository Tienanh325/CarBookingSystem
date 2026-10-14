import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { created, ok } from "../../utils/response";
import * as service from "./safety.service";

export const contacts = asyncHandler(async (req: Request, res: Response) =>
  res.json(ok(await service.listEmergencyContacts(req.auth!.userId)))
);
export const createContact = asyncHandler(async (req: Request, res: Response) =>
  res.status(201).json(created(await service.createEmergencyContact(req.auth!.userId, req.body)))
);
export const deleteContact = asyncHandler(async (req: Request, res: Response) =>
  res.json(ok(await service.deleteEmergencyContact(req.auth!.userId, req.params.id as string)))
);
export const createSos = asyncHandler(async (req: Request, res: Response) =>
  res.status(201).json(created(await service.createSos(req.auth!.userId, req.auth!.roles, req.body)))
);
export const listSos = asyncHandler(async (req: Request, res: Response) =>
  res.json(ok(await service.listSos(req.query as never)))
);
export const updateSos = asyncHandler(async (req: Request, res: Response) =>
  res.json(ok(await service.updateSosStatus(req.params.id as string, req.body.status, req.auth!.userId)))
);
export const shareRide = asyncHandler(async (req: Request, res: Response) =>
  res
    .status(201)
    .json(
      created(
        await service.createRideShare(
          req.params.id as string,
          req.auth!.userId,
          req.auth!.roles,
          req.body.expiresInHours
        )
      )
    )
);
export const sharedRide = asyncHandler(async (req: Request, res: Response) =>
  res.json(ok(await service.getSharedRide(req.params.token as string)))
);
export const messages = asyncHandler(async (req: Request, res: Response) =>
  res.json(ok(await service.listRideMessages(req.params.id as string, req.auth!.userId, req.auth!.roles)))
);
export const sendMessage = asyncHandler(async (req: Request, res: Response) =>
  res
    .status(201)
    .json(
      created(
        await service.sendRideMessage(
          req.params.id as string,
          req.auth!.userId,
          req.auth!.roles,
          req.body.body
        )
      )
    )
);
export const contact = asyncHandler(async (req: Request, res: Response) =>
  res.json(ok(await service.rideContact(req.params.id as string, req.auth!.userId, req.auth!.roles)))
);
