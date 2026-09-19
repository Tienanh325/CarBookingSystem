import "dotenv/config";

function readNumber(name: string, fallback: number) {
  const value = process.env[name];
  if (!value) return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:3000";

export const env = {
  nodeEnv,
  appName: process.env.APP_NAME ?? "Ride Booking Backend",
  port: readNumber("PORT", 4000),
  appOrigin,
  appOrigins: appOrigin.split(",").map((origin) => origin.trim()).filter(Boolean),
  apiRateLimit: readNumber("API_RATE_LIMIT", 600),
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? "dev-access-secret-change-me",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-me",
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
  otpExpiresMinutes: readNumber("OTP_EXPIRES_MINUTES", 5)
};

export const isProduction = env.nodeEnv === "production";

if (isProduction) {
  if (!env.databaseUrl) throw new Error("DATABASE_URL is required in production");
  if (env.jwtAccessSecret.length < 32 || env.jwtAccessSecret.includes("change-me")) {
    throw new Error("JWT_ACCESS_SECRET must be a strong production secret");
  }
  if (!env.appOrigins.length || env.appOrigins.includes("*")) {
    throw new Error("APP_ORIGIN must contain explicit production origins");
  }
}
