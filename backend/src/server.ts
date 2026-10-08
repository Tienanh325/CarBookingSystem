import http from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./config/prisma";
import { registerSocketServer } from "./realtime/socket";
import { startMatchingWorker } from "./modules/matching/matching.service";

async function bootstrap() {
  await prisma.$connect();
  const app = createApp();
  const server = http.createServer(app);

  registerSocketServer(server);
  const stopMatchingWorker = startMatchingWorker();

  server.listen(env.port, () => {
    console.log(`${env.appName} is running at http://localhost:${env.port}`);
  });

  const shutdown = async () => {
    stopMatchingWorker();
    await prisma.$disconnect();
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
