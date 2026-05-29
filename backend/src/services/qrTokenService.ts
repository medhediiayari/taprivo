import { createHmac, randomBytes } from "node:crypto";
import { env } from "../env.js";
import { redis } from "../redis.js";

const KEY = (token: string) => `qr:${token}`;

export type QrPayload = {
  userId: string;
  merchantId: string;
  issuedAt: number;
};

export const generateQrToken = async (
  userId: string,
  merchantId: string,
): Promise<{ token: string; expiresAt: number }> => {
  const nonce = randomBytes(12).toString("hex");
  const issuedAt = Date.now();
  const base = `${userId}.${merchantId}.${issuedAt}.${nonce}`;
  const sig = createHmac("sha256", env.QR_HMAC_SECRET).update(base).digest("hex").slice(0, 24);
  const token = `${nonce}.${sig}`;

  const payload: QrPayload = { userId, merchantId, issuedAt };
  await redis.set(KEY(token), JSON.stringify(payload), "EX", env.QR_TTL_SECONDS);

  return { token, expiresAt: issuedAt + env.QR_TTL_SECONDS * 1000 };
};

export const consumeQrToken = async (token: string): Promise<QrPayload | null> => {
  const raw = await redis.get(KEY(token));
  if (!raw) return null;
  const deleted = await redis.del(KEY(token));
  if (deleted === 0) return null;
  return JSON.parse(raw) as QrPayload;
};
