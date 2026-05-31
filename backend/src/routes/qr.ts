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

    // A merchant may only stamp cards belonging to a merchant they own.
    const owns = await query(
      `SELECT 1 FROM merchants WHERE id = $1 AND owner_user_id = $2`,
      [merchantId, req.user!.sub],
    );
    if (owns.rowCount === 0) return reply.code(403).send({ error: "not_your_merchant" });

    const result = await addStamp({
      userId,
      merchantId,
      method: "qr",
      scanLat: scan_lat ?? null,
      scanLng: scan_lng ?? null,
      qrTokenUsed: token,
      geoVerified: true,
    });
    return reply.send(result);
  });
}

