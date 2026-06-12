import type { FastifyInstance } from "fastify";
import { query } from "../db.js";
import { settleRedemption } from "../services/rewardService.js";

export default async function rewardsRoutes(app: FastifyInstance) {
  app.get("/rewards", { onRequest: [app.requireAuth] }, async (req) => {
    const r = await query(
      `
      SELECT r.id, r.coupon_code, r.redeemed, r.redeemed_at, r.expires_at, r.created_at, r.card_id,
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
}
