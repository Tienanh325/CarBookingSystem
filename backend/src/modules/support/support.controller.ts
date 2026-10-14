import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { created, ok } from "../../utils/response";
import * as service from "./support.service";

export const create = asyncHandler(async (req: Request, res: Response) =>
  res.status(201).json(created(await service.createTicket(req.auth!.userId, req.auth!.roles, req.body)))
);
export const listOwn = asyncHandler(async (req: Request, res: Response) =>
  res.json(ok(await service.listOwnTickets(req.auth!.userId, req.auth!.roles, req.query as never)))
);
export const detail = asyncHandler(async (req: Request, res: Response) =>
  res.json(ok(await service.getTicket(req.params.id as string, req.auth!.userId, req.auth!.roles)))
);
export const message = asyncHandler(async (req: Request, res: Response) =>
  res
    .status(201)
    .json(
      created(
        await service.addTicketMessage(
          req.params.id as string,
          req.auth!.userId,
          req.auth!.roles,
          req.body.body
        )
      )
    )
);
export const listAll = asyncHandler(async (req: Request, res: Response) =>
  res.json(ok(await service.listAllTickets(req.query as never)))
);
export const update = asyncHandler(async (req: Request, res: Response) =>
  res.json(ok(await service.updateTicket(req.params.id as string, req.auth!.userId, req.body)))
);
