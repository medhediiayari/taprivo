import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { query } from "../db.js";
import { isInsideGeofence } from "../services/geoFenceService.js";
import { verifyNfcChallenge } from "../services/nfcService.js";
import { settleRedemption } from "../services/rewardService.js";
import { addStamp } from "../services/stampEngine.js";

const redeemSchema = z.object({
  device_uid: z.string().min(3),
  reward_id: z.string().uuid().optional(),
});

// Passive tags (stickers, cards) can't compute a challenge-response, so v1
// trusts the provisioned UID (architecture §5.6). `challenge`/`hmac` stay
// optional for future active devices and are verified whenever provided.
// Coordinates are optional too: when present the geofence is enforced, when
// absent the stamp is recorded with geo_verified=false.
const validateSchema = z.object({
  device_uid: z.string().min(3),
  challenge: z.string().min(8).optional(),
  hmac: z.string().min(16).optional(),
  scan_lat: z.number().optional(),
  scan_lng: z.number().optional(),
});

export default async function nfcRoutes(app: FastifyInstance) {
  app.post("/nfc/validate", { onRequest: [app.requireAuth] }, async (req, reply) => {
    const parsed = validateSchema.safeParse(req.body);
    if (!parsed.success) {
      // Surface which field failed so client/server version mismatches are
      // obvious instead of an opaque 400.
      req.log.warn({ body: req.body, issues: parsed.error.issues }, "nfc/validate bad_input");
      return reply.code(400).send({ error: "bad_input", issues: parsed.error.issues });
    }
    const { device_uid, challenge, hmac, scan_lat, scan_lng } = parsed.data;

    const r = await query<{
      merchant_id: string;
      nfc_secret_key: string;
      lat: number;
      lng: number;
      geofence_radius_m: number;
      nfc_enabled: boolean;
      device_id: string;
    }>(
      `
      SELECT nd.id AS device_id, nd.merchant_id, m.nfc_secret_key, m.lat, m.lng, m.geofence_radius_m, m.nfc_enabled
      FROM nfc_devices nd
      JOIN merchants m ON m.id = nd.merchant_id
      WHERE nd.uid = $1 AND nd.status = 'active'
      `,
      [device_uid],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "device_unknown" });
    const row = r.rows[0];
    if (!row.nfc_enabled) return reply.code(403).send({ error: "nfc_disabled" });

    if (challenge && hmac && !verifyNfcChallenge(challenge, hmac, row.nfc_secret_key)) {
      return reply.code(401).send({ error: "challenge_invalid" });
    }

    const hasCoords = scan_lat !== undefined && scan_lng !== undefined;
    if (hasCoords) {
      const geo = isInsideGeofence(scan_lat, scan_lng, row.lat, row.lng, row.geofence_radius_m);
      if (!geo.ok) {
        return reply.code(403).send({ error: "geofence_failed", distance: Math.round(geo.distance) });
      }
    }

    const result = await addStamp({
      userId: req.user!.sub,
      merchantId: row.merchant_id,
      method: "nfc",
      scanLat: scan_lat ?? null,
      scanLng: scan_lng ?? null,
      geoVerified: hasCoords,
    });

    await query(`UPDATE nfc_devices SET last_used_at = now() WHERE id = $1`, [row.device_id]);
    return reply.send(result);
  });

  // Tap-to-redeem: the customer (logged in) taps the merchant's NFC badge while
  // the reward sheet is open. We resolve the merchant from the tapped device,
  // find this customer's pending reward there, and settle it — the NFC twin of
  // the merchant scanning the customer's QR.
  app.post("/nfc/redeem", { onRequest: [app.requireAuth] }, async (req, reply) => {
    const parsed = redeemSchema.safeParse(req.body);
    if (!parsed.success) {
      req.log.warn({ body: req.body, issues: parsed.error.issues }, "nfc/redeem bad_input");
      return reply.code(400).send({ error: "bad_input", issues: parsed.error.issues });
    }
    const { device_uid, reward_id } = parsed.data;

    const d = await query<{ merchant_id: string; nfc_enabled: boolean; device_id: string }>(
      `SELECT nd.id AS device_id, nd.merchant_id, m.nfc_enabled
       FROM nfc_devices nd JOIN merchants m ON m.id = nd.merchant_id
       WHERE nd.uid = $1 AND nd.status = 'active'`,
      [device_uid],
    );
    if (d.rowCount === 0) return reply.code(404).send({ error: "device_unknown" });
    if (!d.rows[0].nfc_enabled) return reply.code(403).send({ error: "nfc_disabled" });
    const merchantId = d.rows[0].merchant_id;

    // The customer's oldest still-valid reward at this merchant (or the one the
    // sheet asked for, scoped to this customer + merchant).
    const params: unknown[] = [req.user!.sub, merchantId];
    let extra = "";
    if (reward_id) {
      params.push(reward_id);
      extra = `AND r.id = $${params.length}`;
    }
    const r = await query<{
      id: string;
      card_id: string;
      stamps_required: number;
      reward_description: string;
      merchant_name: string;
      google_object_id: string | null;
    }>(
      `SELECT r.id, r.card_id, m.stamps_required, m.reward_description, m.name AS merchant_name,
              lc.google_object_id
       FROM rewards r
       JOIN merchants m ON m.id = r.merchant_id
       JOIN loyalty_cards lc ON lc.id = r.card_id
       WHERE r.user_id = $1 AND r.merchant_id = $2 AND r.redeemed = false AND r.expires_at > now()
       ${extra}
       ORDER BY r.created_at ASC
       LIMIT 1`,
      params,
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "no_pending_reward" });
    const row = r.rows[0];

    await settleRedemption(row);
    await query(`UPDATE nfc_devices SET last_used_at = now() WHERE id = $1`, [d.rows[0].device_id]);
    return reply.send({
      ok: true,
      reward_id: row.id,
      reward_description: row.reward_description,
      merchant_name: row.merchant_name,
    });
  });

  app.post("/nfc/simulate", { onRequest: [app.requireAuth] }, async (req, reply) => {
    const body = (req.body ?? {}) as { merchant_id?: string };
    if (!body.merchant_id) return reply.code(400).send({ error: "merchant_id_required" });
    const m = await query<{ lat: number; lng: number }>(
      `SELECT lat, lng FROM merchants WHERE id = $1`,
      [body.merchant_id],
    );
    if (m.rowCount === 0) return reply.code(404).send({ error: "merchant_not_found" });
    const result = await addStamp({
      userId: req.user!.sub,
      merchantId: body.merchant_id,
      method: "nfc",
      scanLat: m.rows[0].lat,
      scanLng: m.rows[0].lng,
      geoVerified: true,
    });
    return reply.send(result);
  });
}
