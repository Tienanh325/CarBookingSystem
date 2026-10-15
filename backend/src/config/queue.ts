import { Queue } from "bullmq";
import { env } from "./env";
export const operationsQueue = env.redisUrl
  ? new Queue("goride-operations", { connection: { url: env.redisUrl } })
  : null;
export async function enqueueOperation(name: string, data: Record<string, unknown>, jobId?: string) {
  if (!operationsQueue) return null;
  return operationsQueue.add(name, data, {
    jobId,
    attempts: 5,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 1000,
    removeOnFail: 5000
  });
}
