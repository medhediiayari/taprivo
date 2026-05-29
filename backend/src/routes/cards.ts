import type { FastifyInstance } from "fastify";
import { query } from "../db.js";

export default async function cardsRoutes(app: FastifyInstance) {
  app.get("/cards", { onRequest: [app.requireAuth] }, async (req) => {
    const r = await query(
      `
      SELECT
        lc.id, lc.stamps_count, lc.total_stamps_earned, lc.last_visit_at, lc.created_at,
        m.id AS merchant_id, m.name AS merchant_name, m.slug AS merchant_slug,
        m.address, m.lat, m.lng,
        m.stamps_required, m.reward_description, m.logo_url,
        m.brand_color_bg, m.brand_color_fg, m.brand_accent,
        (SELECT count(*) FROM rewards r WHERE r.card_id = lc.id AND r.redeemed = false) AS pending_rewards
      FROM loyalty_cards lc
      JOIN merchants m ON m.id = lc.merchant_id
      WHERE lc.user_id = $1
      ORDER BY lc.last_visit_at DESC NULLS LAST, lc.created_at DESC
      `,
      [req.user!.sub],
    );
    return { cards: r.rows };
  });

  app.get("/cards/:id", { onRequest: [app.requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = await query(
      `
      SELECT
        lc.id, lc.stamps_count, lc.total_stamps_earned, lc.last_visit_at, lc.created_at,
        m.id AS merchant_id, m.name AS merchant_name, m.slug AS merchant_slug,
        m.address, m.lat, m.lng,
        m.stamps_required, m.reward_description, m.logo_url, m.geofence_radius_m,
        m.brand_color_bg, m.brand_color_fg, m.brand_accent
      FROM loyalty_cards lc
      JOIN merchants m ON m.id = lc.merchant_id
      WHERE lc.id = $1 AND lc.user_id = $2
      `,
      [id, req.user!.sub],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "not_found" });

    const events = await query(
      `SELECT id, method, geo_verified, scanned_at FROM stamp_events
       WHERE card_id = $1 ORDER BY scanned_at DESC LIMIT 20`,
      [id],
    );
    return { card: r.rows[0], recent_stamps: events.rows };
  });

  app.get("/merchants", async () => {
    const r = await query(
      `SELECT id, name, slug, address, lat, lng, stamps_required, reward_description,
              logo_url, brand_color_bg, brand_color_fg, brand_accent
       FROM merchants ORDER BY name`,
    );
    return { merchants: r.rows };
  });

  app.post("/cards/join", { onRequest: [app.requireAuth] }, async (req, reply) => {
    const { merchant_id } = (req.body ?? {}) as { merchant_id?: string };
    if (!merchant_id) return reply.code(400).send({ error: "merchant_id_required" });
    const r = await query<{ id: string }>(
      `INSERT INTO loyalty_cards (user_id, merchant_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, merchant_id) DO UPDATE SET last_visit_at = loyalty_cards.last_visit_at
       RETURNING id`,
      [req.user!.sub, merchant_id],
    );
    return reply.send({ card_id: r.rows[0].id });
  });
}
