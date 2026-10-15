import http from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./config/prisma";
import { registerSocketServer } from "./realtime/socket";
import { startMatchingWorker } from "./modules/matching/matching.service";
import { startReconciliationWorker } from "./modules/payments/reconciliation.service";
import { startOperationsWorker } from "./workers/operations.worker";
import { logger } from "./config/logger";

async function bootstrap() {
  await prisma.$connect();
  const app = createApp();
  const server = http.createServer(app);

  await registerSocketServer(server);
  const stopMatchingWorker = startMatchingWorker();
  const stopReconciliationWorker = startReconciliationWorker();
  const stopOperationsWorker = await startOperationsWorker();

  server.listen(env.port, () => {
    logger.info({ port: env.port }, `${env.appName} started`);
  });

  const shutdown = async () => {
    stopMatchingWorker();
    stopReconciliationWorker();
    await stopOperationsWorker();
    await prisma.$disconnect();
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((error) => {
  logger.fatal({ error }, "Application bootstrap failed");
  process.exit(1);
});
