import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { query } from "../db.js";
import { consumeQrToken, generateQrToken } from "../services/qrTokenService.js";
import { addStamp } from "../services/stampEngine.js";

const generateSchema = z.object({ merchant_id: z.string().uuid() });

// scan_lat/scan_lng are optional and kept only for analytics — no geofence is
// enforced here: the customer presents the QR in person at the counter, so the
// merchant's presence is implied.
const validateSchema = z.object({
  token: z.string().min(8),
  scan_lat: z.number().optional(),
  scan_lng: z.number().optional(),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function qrRoutes(app: FastifyInstance) {
  app.post("/qr/generate", { onRequest: [app.requireAuth] }, async (req, reply) => {
    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad_input" });
    const out = await generateQrToken(req.user!.sub, parsed.data.merchant_id);
    return reply.send(out);
  });

  app.post("/qr/validate", { onRequest: [app.requireMerchant] }, async (req, reply) => {
    const parsed = validateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad_input" });
    const { token, scan_lat, scan_lng } = parsed.data;

    // Resolve the customer + merchant from either a one-time token (legacy
    // dynamic QR) or a stable loyalty-card id — the value encoded in the app
    // and Google Wallet barcodes, which never expires.
    let userId: string;
    let merchantId: string;
    const payload = await consumeQrToken(token);
    if (payload) {
      userId = payload.userId;
      merchantId = payload.merchantId;
    } else if (UUID_RE.test(token)) {
      const c = await query<{ user_id: string; merchant_id: string }>(
        `SELECT user_id, merchant_id FROM loyalty_cards WHERE id = $1`,
        [token],
      );
      if (c.rowCount === 0) return reply.code(410).send({ error: "token_expired_or_used" });
      userId = c.rows[0].user_id;
      merchantId = c.rows[0].merchant_id;
    } else {
      return reply.code(410).send({ error: "token_expired_or_used" });
    }

    // A merchant may only act on cards belonging to a merchant they own.
    const owns = await query(
      `SELECT 1 FROM merchants WHERE id = $1 AND owner_user_id = $2`,
      [merchantId, req.user!.sub],
    );
    if (owns.rowCount === 0) return reply.code(403).send({ error: "not_your_merchant" });

    // If this customer already has an unredeemed reward here, surface it instead
    // of stamping. The cashier then redeems it (POST /rewards/redeem), which is
    // what resets the card to zero.
    const pending = await query<{
      id: string;
      coupon_code: string;
      expires_at: Date;
      reward_description: string;
      full_name: string | null;
      stamps_count: number;
      stamps_required: number;
    }>(
      `SELECT r.id, r.coupon_code, r.expires_at, m.reward_description, u.full_name,
              lc.stamps_count, m.stamps_required
       FROM rewards r
       JOIN merchants m ON m.id = r.merchant_id
       JOIN loyalty_cards lc ON lc.id = r.card_id
       JOIN users u ON u.id = r.user_id
       WHERE r.user_id = $1 AND r.merchant_id = $2 AND r.redeemed = false AND r.expires_at > now()
       ORDER BY r.created_at DESC LIMIT 1`,
      [userId, merchantId],
    );
    if (pending.rowCount && pending.rowCount > 0) {
      const p = pending.rows[0];
      return reply.send({
        reward_available: true,
        reward: {
          id: p.id,
          coupon_code: p.coupon_code,
          expires_at: p.expires_at.toISOString(),
          reward_description: p.reward_description,
        },
        customer_name: p.full_name,
        card: { stamps_count: p.stamps_count, stamps_required: p.stamps_required },
      });
    }

    const result = await addStamp({
      userId,
      merchantId,
      method: "qr",
      scanLat: scan_lat ?? null,
      scanLng: scan_lng ?? null,
      qrTokenUsed: token,
      geoVerified: true,
    });
    return reply.send({ reward_available: false, ...result });
  });
}

