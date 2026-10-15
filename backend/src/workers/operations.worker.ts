import { Worker, type Job } from "bullmq";
import { env } from "../config/env";
import { logger, alertOps } from "../config/logger";
import { enqueueOperation, operationsQueue } from "../config/queue";
import { prisma } from "../config/prisma";
import { createNotification } from "../modules/notifications/notification.service";

const queueName = "goride-operations";

async function expireDriverDocuments() {
  const expired = await prisma.driverDocument.findMany({
    where: { expiresAt: { lt: new Date() }, status: "APPROVED" },
    include: { driver: { select: { userId: true } } }
  });
  if (!expired.length) return { expired: 0 };

  await prisma.driverDocument.updateMany({
    where: { id: { in: expired.map((document) => document.id) }, status: "APPROVED" },
    data: { status: "EXPIRED" }
  });
  await Promise.all(
    expired.map((document) =>
      createNotification({
        userId: document.driver.userId,
        title: "Giấy tờ tài xế đã hết hạn",
        body: `${document.type} đã hết hạn. Vui lòng tải giấy tờ mới.`,
        push: true
      })
    )
  );
  return { expired: expired.length };
}

async function processOperation(job: Job) {
  switch (job.name) {
    case "documents.expire":
      return expireDriverDocuments();
    default:
      throw new Error(`Unsupported operations job: ${job.name}`);
  }
}

export async function startOperationsWorker() {
  if (!env.redisUrl || !operationsQueue) return async () => undefined;
  const queue = operationsQueue;

  const worker = new Worker(queueName, processOperation, {
    connection: { url: env.redisUrl },
    concurrency: 2
  });
  worker.on("completed", (job, result) =>
    logger.info({ jobId: job.id, job: job.name, result }, "Operations job completed")
  );
  worker.on("failed", (job, error) => {
    void alertOps("Operations job failed", {
      jobId: job?.id,
      job: job?.name,
      attempt: job?.attemptsMade,
      error: error.message
    });
  });

  const scheduleExpiryScan = () =>
    enqueueOperation("documents.expire", {}, `documents-expire-${Math.floor(Date.now() / 3_600_000)}`);
  await scheduleExpiryScan();
  const timer = setInterval(() => void scheduleExpiryScan(), 60 * 60_000);
  timer.unref();

  return async () => {
    clearInterval(timer);
    await worker.close();
    await queue.close();
  };
}
