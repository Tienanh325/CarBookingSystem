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
  appOrigins: appOrigin
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  apiRateLimit: readNumber("API_RATE_LIMIT", 600),
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? "dev-access-secret-change-me",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-me",
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
  otpExpiresMinutes: readNumber("OTP_EXPIRES_MINUTES", 5),
  passwordResetTtlMinutes: readNumber("PASSWORD_RESET_TTL_MINUTES", 15),
  passwordResetWebhookUrl: process.env.PASSWORD_RESET_WEBHOOK_URL,
  passwordResetWebhookToken: process.env.PASSWORD_RESET_WEBHOOK_TOKEN,
  webPushPublicKey: process.env.WEB_PUSH_PUBLIC_KEY,
  webPushPrivateKey: process.env.WEB_PUSH_PRIVATE_KEY,
  webPushSubject: process.env.WEB_PUSH_SUBJECT ?? "mailto:admin@goride.local",
  routingBaseUrl: process.env.ROUTING_BASE_URL ?? "https://router.project-osrm.org",
  mapboxAccessToken: process.env.MAPBOX_ACCESS_TOKEN,
  geocodingBaseUrl: process.env.GEOCODING_BASE_URL ?? "https://photon.komoot.io",
  matchingOfferSeconds: readNumber("MATCHING_OFFER_SECONDS", 20),
  matchingLeadMinutes: readNumber("SCHEDULE_MATCH_LEAD_MINUTES", 30),
  matchingMaxWaitSeconds: readNumber("MATCHING_MAX_WAIT_SECONDS", 180),
  driverLocationMaxAgeSeconds: readNumber("DRIVER_LOCATION_MAX_AGE_SECONDS", 120),
  waitingGraceMinutes: readNumber("WAITING_GRACE_MINUTES", 5),
  cancelFeeAfterAccept: readNumber("CANCEL_FEE_AFTER_ACCEPT", 10_000),
  cancelFeeAfterArrived: readNumber("CANCEL_FEE_AFTER_ARRIVED", 20_000),
  rideStartPinSecret: process.env.RIDE_START_PIN_SECRET ?? "dev-ride-pin-secret-change-me",
  platformCommissionRate: readNumber("PLATFORM_COMMISSION_RATE", 0.2),
  vietQrBankBin: process.env.VIETQR_BANK_BIN ?? "970422",
  vietQrAccountNumber: process.env.VIETQR_ACCOUNT_NUMBER ?? "0000000000",
  vietQrAccountName: process.env.VIETQR_ACCOUNT_NAME ?? "GORIDE",
  vietQrTemplate: process.env.VIETQR_TEMPLATE ?? "compact2",
  vietQrWebhookSecret: process.env.VIETQR_WEBHOOK_SECRET ?? "dev-vietqr-secret-change-me",
  vietQrPaymentTtlMinutes: readNumber("VIETQR_PAYMENT_TTL_MINUTES", 15),
  vietQrReconciliationUrl: process.env.VIETQR_RECONCILIATION_URL,
  vietQrReconciliationToken: process.env.VIETQR_RECONCILIATION_TOKEN,
  reconciliationIntervalMinutes: readNumber("RECONCILIATION_INTERVAL_MINUTES", 15),
  reconciliationLookbackHours: readNumber("RECONCILIATION_LOOKBACK_HOURS", 48)
};

export const isProduction = env.nodeEnv === "production";

if (env.platformCommissionRate < 0 || env.platformCommissionRate >= 1) {
  throw new Error("PLATFORM_COMMISSION_RATE must be between 0 and 1");
}

if (env.driverLocationMaxAgeSeconds <= 0) {
  throw new Error("DRIVER_LOCATION_MAX_AGE_SECONDS must be greater than 0");
}

if (env.passwordResetTtlMinutes <= 0) {
  throw new Error("PASSWORD_RESET_TTL_MINUTES must be greater than 0");
}

if (Boolean(env.webPushPublicKey) !== Boolean(env.webPushPrivateKey)) {
  throw new Error("WEB_PUSH_PUBLIC_KEY and WEB_PUSH_PRIVATE_KEY must be configured together");
}

if (isProduction) {
  if (!env.databaseUrl) throw new Error("DATABASE_URL is required in production");
  if (env.jwtAccessSecret.length < 32 || env.jwtAccessSecret.includes("change-me")) {
    throw new Error("JWT_ACCESS_SECRET must be a strong production secret");
  }
  if (!env.appOrigins.length || env.appOrigins.includes("*")) {
    throw new Error("APP_ORIGIN must contain explicit production origins");
  }
  if (env.vietQrWebhookSecret.length < 32 || env.vietQrWebhookSecret.includes("change-me")) {
    throw new Error("VIETQR_WEBHOOK_SECRET must be a strong production secret");
  }
  if (env.rideStartPinSecret.length < 32 || env.rideStartPinSecret.includes("change-me")) {
    throw new Error("RIDE_START_PIN_SECRET must be a strong production secret");
  }
}
