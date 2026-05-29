import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { query } from "../db.js";
import { isInsideGeofence } from "../services/geoFenceService.js";
import { consumeQrToken, generateQrToken } from "../services/qrTokenService.js";
import { addStamp } from "../services/stampEngine.js";

const generateSchema = z.object({ merchant_id: z.string().uuid() });

const validateSchema = z.object({
  token: z.string().min(8),
  scan_lat: z.number(),
  scan_lng: z.number(),
});

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

    const payload = await consumeQrToken(token);
    if (!payload) return reply.code(410).send({ error: "token_expired_or_used" });

    const m = await query<{
      id: string;
      lat: number;
      lng: number;
      geofence_radius_m: number;
    }>(
      `SELECT id, lat, lng, geofence_radius_m FROM merchants WHERE id = $1`,
      [payload.merchantId],
    );
    if (m.rowCount === 0) return reply.code(404).send({ error: "merchant_not_found" });
    const merchant = m.rows[0];
    const geo = isInsideGeofence(scan_lat, scan_lng, merchant.lat, merchant.lng, merchant.geofence_radius_m);
    if (!geo.ok) {
      return reply.code(403).send({ error: "geofence_failed", distance: Math.round(geo.distance) });
    }

    const result = await addStamp({
      userId: payload.userId,
      merchantId: payload.merchantId,
      method: "qr",
      scanLat: scan_lat,
      scanLng: scan_lng,
      qrTokenUsed: token,
      geoVerified: true,
    });
    return reply.send(result);
  });
}
