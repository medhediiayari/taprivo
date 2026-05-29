import { createHash, randomBytes } from "node:crypto";
import type { DbClient } from "../db.js";
import { query, tx } from "../db.js";
import { env } from "../env.js";

const hashToken = (raw: string): string => createHash("sha256").update(raw).digest("hex");

const newRawToken = (): string => randomBytes(48).toString("base64url");

const expiry = (): Date => new Date(Date.now() + env.REFRESH_TTL_DAYS * 86_400 * 1000);

const insertToken = async (
  c: DbClient,
  userId: string,
  deviceId: string | null,
  userAgent: string | null,
): Promise<{ id: string; token: string; expiresAt: Date }> => {
  const raw = newRawToken();
  const expiresAt = expiry();
  const r = await c.query<{ id: string }>(
    `INSERT INTO refresh_tokens (user_id, token_hash, device_id, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, hashToken(raw), deviceId, userAgent, expiresAt],
  );
  return { id: r.rows[0].id, token: raw, expiresAt };
};

export const issueRefreshToken = (
  userId: string,
  deviceId: string | null,
  userAgent: string | null,
): Promise<{ token: string; expiresAt: Date }> =>
  tx(async (c) => {
    const { token, expiresAt } = await insertToken(c, userId, deviceId, userAgent);
    return { token, expiresAt };
  });

export type RotateResult =
  | { ok: true; userId: string; deviceId: string | null; token: string; expiresAt: Date }
  | { ok: false; reason: "invalid" | "expired" | "revoked" | "device_mismatch" };

// Verify a refresh token and, if valid, rotate it: the presented token is
// revoked and a fresh one is issued bound to the same device. Re-use of an
// already-revoked token revokes every active session for that user, which
// neutralises a stolen-then-rotated token.
export const rotateRefreshToken = (
  raw: string,
  requestDeviceId: string | null,
  userAgent: string | null,
): Promise<RotateResult> =>
  tx(async (c) => {
    const r = await c.query<{
      id: string;
      user_id: string;
      device_id: string | null;
      expires_at: Date;
      revoked_at: Date | null;
    }>(
      `SELECT id, user_id, device_id, expires_at, revoked_at
       FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE`,
      [hashToken(raw)],
    );
    if (r.rowCount === 0) return { ok: false, reason: "invalid" };
    const row = r.rows[0];

    if (row.revoked_at) {
      await c.query(
        `UPDATE refresh_tokens SET revoked_at = now()
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [row.user_id],
      );
      return { ok: false, reason: "revoked" };
    }
    if (row.expires_at.getTime() < Date.now()) return { ok: false, reason: "expired" };
    if (row.device_id && requestDeviceId && row.device_id !== requestDeviceId) {
      return { ok: false, reason: "device_mismatch" };
    }

    const deviceId = row.device_id ?? requestDeviceId;
    const next = await insertToken(c, row.user_id, deviceId, userAgent);
    await c.query(
      `UPDATE refresh_tokens SET revoked_at = now(), replaced_by = $2 WHERE id = $1`,
      [row.id, next.id],
    );
    return { ok: true, userId: row.user_id, deviceId, token: next.token, expiresAt: next.expiresAt };
  });

export const revokeRefreshToken = async (raw: string): Promise<void> => {
  await query(
    `UPDATE refresh_tokens SET revoked_at = now()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [hashToken(raw)],
  );
};

export const revokeAllForUser = async (userId: string): Promise<void> => {
  await query(
    `UPDATE refresh_tokens SET revoked_at = now()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
};
