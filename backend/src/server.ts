import { mkdirSync } from "node:fs";
import fastifyCors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import fastifyMultipart from "@fastify/multipart";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { env } from "./env.js";
import { requireAdmin, requireAuth, requireMerchant } from "./middleware/auth.js";
import adminRoutes from "./routes/admin.js";
import authRoutes from "./routes/auth.js";
import cardsRoutes from "./routes/cards.js";
import merchantsRoutes from "./routes/merchants.js";
import nfcRoutes from "./routes/nfc.js";
import qrRoutes from "./routes/qr.js";
import rewardsRoutes from "./routes/rewards.js";
import walletRoutes from "./routes/wallet.js";
import { ensureSchema } from "./migrate.js";
import { seedIfEmpty } from "./seed.js";

declare module "fastify" {
  interface FastifyInstance {
    requireAuth: typeof requireAuth;
    requireMerchant: typeof requireMerchant;
    requireAdmin: typeof requireAdmin;
  }
}

const app = Fastify({
  logger: { level: env.NODE_ENV === "development" ? "info" : "warn" },
  trustProxy: true,
});

// Tolerate empty-bodied JSON POSTs (some clients always send
// `Content-Type: application/json`, even for bodyless actions). Without this,
// Fastify rejects them with FST_ERR_CTP_EMPTY_JSON_BODY (400).
app.addContentTypeParser(
  "application/json",
  { parseAs: "string" },
  (_req, body, done) => {
    if (body === "" || body == null) return done(null, {});
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      (err as { statusCode?: number }).statusCode = 400;
      done(err as Error, undefined);
    }
  },
);

await app.register(fastifyCors, {
  origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(","),
  credentials: true,
});

await app.register(fastifyJwt, { secret: env.JWT_SECRET });

await app.register(fastifyRateLimit, {
  max: 120,
  timeWindow: "1 minute",
});

// Merchant logo uploads: accept a single small image, then serve the stored
// files statically at /uploads/*. The directory is created if missing so the
// static plugin doesn't throw on a fresh volume.
await app.register(fastifyMultipart, {
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1, fields: 10 },
});
mkdirSync(env.UPLOAD_DIR, { recursive: true });
await app.register(fastifyStatic, {
  root: env.UPLOAD_DIR,
  prefix: "/uploads/",
  decorateReply: false,
});

app.decorate("requireAuth", requireAuth);
app.decorate("requireMerchant", requireMerchant);
app.decorate("requireAdmin", requireAdmin);

app.get("/health", async () => ({ status: "ok", uptime: process.uptime() }));

await app.register(authRoutes);
await app.register(cardsRoutes);
await app.register(qrRoutes);
await app.register(nfcRoutes);
await app.register(rewardsRoutes);
await app.register(merchantsRoutes);
await app.register(walletRoutes);
await app.register(adminRoutes);

const start = async () => {
  try {
    await ensureSchema();
    await seedIfEmpty();
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    app.log.info(`taprivo backend listening on :${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
