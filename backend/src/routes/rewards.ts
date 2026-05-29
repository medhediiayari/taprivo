import type { FastifyInstance } from "fastify";
import { query } from "../db.js";

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

  app.post("/rewards/:id/redeem", { onRequest: [app.requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = await query<{ id: string; redeemed: boolean; expires_at: Date }>(
      `SELECT id, redeemed, expires_at FROM rewards WHERE id = $1 AND user_id = $2`,
      [id, req.user!.sub],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "not_found" });
    const row = r.rows[0];
    if (row.redeemed) return reply.code(409).send({ error: "already_redeemed" });
    if (row.expires_at.getTime() < Date.now()) return reply.code(410).send({ error: "expired" });

    await query(`UPDATE rewards SET redeemed = true, redeemed_at = now() WHERE id = $1`, [id]);
    return reply.send({ ok: true });
  });
}
