import { randomBytes } from "node:crypto";
import type { DbClient } from "../db.js";
import { tx } from "../db.js";
import { env } from "../env.js";
import { patchLoyaltyPoints, walletConfigured } from "./walletService.js";

export type StampResult = {
  card: {
    id: string;
    stamps_count: number;
    stamps_required: number;
    total_stamps_earned: number;
  };
  reward?: { id: string; coupon_code: string; expires_at: string };
  unlocked: boolean;
};

type StampInput = {
  userId: string;
  merchantId: string;
  method: "nfc" | "qr";
  scanLat?: number | null;
  scanLng?: number | null;
  qrTokenUsed?: string | null;
  geoVerified: boolean;
};

export const addStamp = async (input: StampInput): Promise<StampResult> => {
  const { result, walletObjectId, walletCardId, walletPoints, walletRequired } = await tx(
    async (c: DbClient) => {
    const m = await c.query<{ stamps_required: number }>(
      `SELECT stamps_required FROM merchants WHERE id = $1`,
      [input.merchantId],
    );
    if (m.rowCount === 0) throw new Error("merchant_not_found");
    const stampsRequired = m.rows[0].stamps_required;

    const upsert = await c.query<{
      id: string;
      stamps_count: number;
      total_stamps_earned: number;
      google_object_id: string | null;
    }>(
      `
      INSERT INTO loyalty_cards (user_id, merchant_id, stamps_count, total_stamps_earned, last_visit_at)
      VALUES ($1, $2, 1, 1, now())
      ON CONFLICT (user_id, merchant_id) DO UPDATE
        SET stamps_count = loyalty_cards.stamps_count + 1,
            total_stamps_earned = loyalty_cards.total_stamps_earned + 1,
            last_visit_at = now()
      RETURNING id, stamps_count, total_stamps_earned, google_object_id
      `,
      [input.userId, input.merchantId],
    );
    const card = upsert.rows[0];

    await c.query(
      `INSERT INTO stamp_events (card_id, merchant_id, user_id, method, scan_lat, scan_lng, qr_token_used, geo_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        card.id,
        input.merchantId,
        input.userId,
        input.method,
        input.scanLat ?? null,
        input.scanLng ?? null,
        input.qrTokenUsed ?? null,
        input.geoVerified,
      ],
    );

    let unlocked = false;
    let reward;
    if (card.stamps_count >= stampsRequired) {
      const coupon = randomBytes(6).toString("hex").toUpperCase();
      const expiresAt = new Date(Date.now() + env.REWARD_TTL_HOURS * 3600 * 1000);
      const r = await c.query<{ id: string; coupon_code: string; expires_at: Date }>(
        `INSERT INTO rewards (card_id, user_id, merchant_id, coupon_code, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, coupon_code, expires_at`,
        [card.id, input.userId, input.merchantId, coupon, expiresAt],
      );
      reward = {
        id: r.rows[0].id,
        coupon_code: r.rows[0].coupon_code,
        expires_at: r.rows[0].expires_at.toISOString(),
      };
      await c.query(`UPDATE loyalty_cards SET stamps_count = 0 WHERE id = $1`, [card.id]);
      card.stamps_count = 0;
      unlocked = true;
    }

    const { google_object_id, ...cardPublic } = card;
    return {
      result: {
        card: { ...cardPublic, stamps_required: stampsRequired },
        reward,
        unlocked,
      } as StampResult,
      walletObjectId: google_object_id,
      walletCardId: card.id,
      walletPoints: card.stamps_count,
      walletRequired: stampsRequired,
    };
  });

  // Best-effort: reflect the new stamp count on the Google Wallet pass (if the
  // card was ever added to a wallet). Never blocks or fails the stamp.
  if (walletConfigured() && walletObjectId) {
    void patchLoyaltyPoints(walletObjectId, walletCardId, walletPoints, walletRequired).catch(() => {});
  }

  return result;
};
