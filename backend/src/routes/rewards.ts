import type { FastifyInstance } from "fastify";
import { query } from "../db.js";
import { patchLoyaltyPoints, walletConfigured } from "../services/walletService.js";

// Marks a reward redeemed and resets its card to zero (the loyalty cycle
// restarts only here, not when the card first fills up). Best-effort syncs the
// Google Wallet pass back to 0. Shared by the merchant scan-redeem and the
// legacy client endpoint.
async function settleRedemption(row: {
  id: string;
  card_id: string;
  google_object_id: string | null;
  stamps_required: number;
}) {
  await query(`UPDATE rewards SET redeemed = true, redeemed_at = now() WHERE id = $1`, [row.id]);
  await query(`UPDATE loyalty_cards SET stamps_count = 0 WHERE id = $1`, [row.card_id]);
  if (walletConfigured() && row.google_object_id) {
    void patchLoyaltyPoints(row.google_object_id, row.card_id, 0, row.stamps_required).catch(() => {});
  }
}

export default async function rewardsRoutes(app: FastifyInstance) {
  app.get("/rewards", { onRequest: [app.requireAuth] }, async (req) => {
    const r = await query(
      `
      SELECT r.id, r.coupon_code, r.redeemed, r.redeemed_at, r.expires_at, r.created_at,
             m.id AS merchant_id, m.name AS merchant_name, m.reward_description,
             m.brand_color_bg, m.brand_accent, m.logo_url
      FROM rewards r
      JOIN merchants m ON m.id = r.merchant_id
      WHERE r.user_id = $1
      ORDER BY r.redeemed ASC, r.created_at DESC
      `,
      [req.user!.sub],
    );
    return { rewards: r.rows };
  });

  // Merchant-side redemption: the cashier scans the customer's card, sees the
  // pending reward, and validates it here. Resets the card to zero.
  app.post("/rewards/redeem", { onRequest: [app.requireMerchant] }, async (req, reply) => {
    const rewardId = (req.body as { reward_id?: string } | null)?.reward_id;
    if (!rewardId || typeof rewardId !== "string") {
      return reply.code(400).send({ error: "bad_input" });
    }
    const r = await query<{
      id: string;
      redeemed: boolean;
      expires_at: Date;
      card_id: string;
      owner_user_id: string | null;
      reward_description: string;
      merchant_name: string;
      stamps_required: number;
      full_name: string | null;
      google_object_id: string | null;
    }>(
      `SELECT r.id, r.redeemed, r.expires_at, r.card_id,
              m.owner_user_id, m.reward_description, m.name AS merchant_name, m.stamps_required,
              u.full_name, lc.google_object_id
       FROM rewards r
       JOIN merchants m ON m.id = r.merchant_id
       JOIN users u ON u.id = r.user_id
       JOIN loyalty_cards lc ON lc.id = r.card_id
       WHERE r.id = $1`,
      [rewardId],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "not_found" });
    const row = r.rows[0];
    if (row.owner_user_id !== req.user!.sub) {
      return reply.code(403).send({ error: "not_your_merchant" });
    }
    if (row.redeemed) return reply.code(409).send({ error: "already_redeemed" });
    if (row.expires_at.getTime() < Date.now()) return reply.code(410).send({ error: "expired" });

    await settleRedemption(row);
    return reply.send({
      ok: true,
      reward_description: row.reward_description,
      merchant_name: row.merchant_name,
      customer_name: row.full_name,
    });
  });

  // Legacy client-side "mark used" — kept for compatibility; also resets the card.
  app.post("/rewards/:id/redeem", { onRequest: [app.requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = await query<{
      id: string;
      redeemed: boolean;
      expires_at: Date;
      card_id: string;
      google_object_id: string | null;
      stamps_required: number;
    }>(
      `SELECT r.id, r.redeemed, r.expires_at, r.card_id, lc.google_object_id, m.stamps_required
       FROM rewards r
       JOIN loyalty_cards lc ON lc.id = r.card_id
       JOIN merchants m ON m.id = r.merchant_id
       WHERE r.id = $1 AND r.user_id = $2`,
      [id, req.user!.sub],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "not_found" });
    const row = r.rows[0];
    if (row.redeemed) return reply.code(409).send({ error: "already_redeemed" });
    if (row.expires_at.getTime() < Date.now()) return reply.code(410).send({ error: "expired" });

    await settleRedemption(row);
    return reply.send({ ok: true });
  });
}
