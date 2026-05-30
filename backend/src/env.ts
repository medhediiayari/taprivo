const must = (name: string, fallback?: string): string => {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
};

// Some Docker Compose versions pass a `KEY=value # comment` line through with
// the inline comment still attached. Strip it (and surrounding whitespace) so a
// stray comment in .env can't corrupt an id/URL.
const clean = (v: string | undefined): string => (v ?? "").replace(/\s+#.*$/, "").trim();

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
  // Directory where merchant logo uploads are stored and served from
  // (`/uploads/*`). In Docker this is a mounted volume so files survive restarts.
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? `${process.cwd()}/uploads`,
  // Max accepted logo size, in bytes.
  MAX_UPLOAD_BYTES: Number(process.env.MAX_UPLOAD_BYTES ?? 2_000_000),
  // Public HTTPS base URL of this backend, used to build absolute asset URLs
  // (e.g. logos) that external services like Google Wallet must fetch. Leave
  // empty in local dev — relative/non-public logos are then simply omitted.
  // A literal "https://..." placeholder counts as unset (no public host).
  PUBLIC_BASE_URL: clean(process.env.PUBLIC_BASE_URL) === "https://..." ? "" : clean(process.env.PUBLIC_BASE_URL),
  // --- Google Wallet (loyalty passes). All optional; the /wallet routes return
  // 503 until an issuer id + a service-account key are provided. ---
  GOOGLE_WALLET_ISSUER_ID: clean(process.env.GOOGLE_WALLET_ISSUER_ID),
  // Service-account credentials: either inline JSON, or a path to the JSON file.
  GOOGLE_WALLET_SA_JSON: process.env.GOOGLE_WALLET_SA_JSON ?? "",
  GOOGLE_WALLET_SA_FILE: clean(process.env.GOOGLE_WALLET_SA_FILE),
};
