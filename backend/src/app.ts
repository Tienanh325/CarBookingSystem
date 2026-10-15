import cors from "cors";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { apiRouter } from "./routes";
import { errorMiddleware } from "./middlewares/error.middleware";
import { notFoundMiddleware } from "./middlewares/not-found.middleware";
import { prisma } from "./config/prisma";
import swaggerUi from "swagger-ui-express";
import { openApiDocument } from "./openapi";
import { logger } from "./config/logger";
import { metricsMiddleware, metricsRegistry } from "./middlewares/metrics.middleware";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.appOrigins, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(pinoHttp({ logger }));
  app.use(metricsMiddleware);
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: env.apiRateLimit,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, res) =>
        res.status(429).json({
          success: false,
          error: { code: "RATE_LIMITED", message: "Qua nhieu yeu cau. Vui long thu lai sau." }
        })
    })
  );

  app.get("/health", (_req, res) => {
    res.json({
      success: true,
      data: {
        name: env.appName,
        status: "healthy"
      }
    });
  });

  app.get("/openapi.json", (_req, res) => res.json(openApiDocument));
  app.get("/metrics", async (req, res) => {
    if (env.metricsToken && req.get("authorization") !== `Bearer ${env.metricsToken}`)
      return res.status(401).end();
    res.type(metricsRegistry.contentType).send(await metricsRegistry.metrics());
  });
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument, { explorer: true }));

  app.use("/api", apiRouter);
  app.get("/ready", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ success: true, data: { database: "ready" } });
    } catch {
      res.status(503).json({ success: false, error: { message: "Database unavailable" } });
    }
  });
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
