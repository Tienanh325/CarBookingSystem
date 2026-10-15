import pino from "pino";
import { env } from "./env";
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (env.nodeEnv === "test" ? "silent" : "info"),
  base: { service: env.appName, environment: env.nodeEnv },
  redact: ["req.headers.authorization", "password", "token", "refreshToken"]
});
export async function alertOps(title: string, details: Record<string, unknown>) {
  logger.error({ ...details }, title);
  if (!env.alertWebhookUrl) return;
  await fetch(env.alertWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, details, at: new Date().toISOString() }),
    signal: AbortSignal.timeout(5000)
  }).catch(() => undefined);
}
