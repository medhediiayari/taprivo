const must = (name: string, fallback?: string): string => {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
};

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 3000),
  DATABASE_URL: must("DATABASE_URL"),
  REDIS_URL: must("REDIS_URL"),
  JWT_SECRET: must("JWT_SECRET"),
  JWT_REFRESH_SECRET: must("JWT_REFRESH_SECRET"),
  QR_HMAC_SECRET: must("QR_HMAC_SECRET"),
  NFC_HMAC_SECRET: must("NFC_HMAC_SECRET"),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "*",
  QR_TTL_SECONDS: Number(process.env.QR_TTL_SECONDS ?? 60),
  REWARD_TTL_HOURS: Number(process.env.REWARD_TTL_HOURS ?? 24 * 30),
  // Access token lifetime (any value accepted by jsonwebtoken `expiresIn`).
  ACCESS_TTL: process.env.ACCESS_TTL ?? "15m",
  // Refresh token lifetime in days.
  REFRESH_TTL_DAYS: Number(process.env.REFRESH_TTL_DAYS ?? 30),
  // When true, authenticated requests must carry an X-Device-Id header that
  // matches the device the access token was issued for.
  ENFORCE_DEVICE_BINDING: (process.env.ENFORCE_DEVICE_BINDING ?? "false") === "true",
};
