import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { ApiError } from "../utils/api-error";
import { isProduction } from "../config/env";
import { alertOps, logger } from "../config/logger";

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(422).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Du lieu gui len khong hop le",
        details: error.flatten()
      }
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    res.status(400).json({
      success: false,
      error: {
        code: `PRISMA_${error.code}`,
        message: "Loi du lieu",
        details: isProduction ? undefined : error.meta
      }
    });
    return;
  }

  logger.error({ err: error, method: _req.method, path: _req.path }, "unhandled request error");
  void alertOps("GoRide unhandled request error", {
    method: _req.method,
    path: _req.path,
    error: String(error)
  });
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "He thong dang gap loi",
      details: isProduction ? undefined : String(error)
    }
  });
};
