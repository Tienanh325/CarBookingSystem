import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import { env } from "./env";
export const redis = env.redisUrl
  ? new Redis(env.redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: true, lazyConnect: true })
  : null;
export async function connectRedis() {
  if (redis && redis.status === "wait") await redis.connect();
  return redis;
}
export async function withDistributedLock<T>(key: string, ttlMs: number, task: () => Promise<T>) {
  if (!redis) return task();
  await connectRedis();
  const token = randomUUID();
  const acquired = await redis.set(`lock:${key}`, token, "PX", ttlMs, "NX");
  if (!acquired) return null;
  try {
    return await task();
  } finally {
    await redis.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      1,
      `lock:${key}`,
      token
    );
  }
}
