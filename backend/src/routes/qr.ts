import type { FastifyInstance } from "fastify";
import { z } from "zod";
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

    const result = await addStamp({
      userId: payload.userId,
      merchantId: payload.merchantId,
      method: "qr",
      scanLat: scan_lat ?? null,
      scanLng: scan_lng ?? null,
      qrTokenUsed: token,
      geoVerified: true,
    });
    return reply.send(result);
  });
}
