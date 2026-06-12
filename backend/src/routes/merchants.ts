import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { query } from "../db.js";
import { env } from "../env.js";

const MERCHANT_FIELDS = `id, name, slug, address, lat, lng, geofence_radius_m, stamps_required,
              reward_description, nfc_enabled, logo_url, brand_color_bg, brand_color_fg, brand_accent`;

const HEX = /^#[0-9A-Fa-f]{6}$/;
const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const configSchema = z.object({
  stamps_required: z.number().int().min(3).max(50).optional(),
  reward_description: z.string().min(1).max(200).optional(),
  geofence_radius_m: z.number().int().min(20).max(2000).optional(),
  brand_color_bg: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  brand_color_fg: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  brand_accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  nfc_enabled: z.boolean().optional(),
});

const provisionSchema = z.object({
  device_type: z.enum(["sticker", "totem", "card", "bracelet"]),
  label: z.string().max(60).optional(),
  // Real hardware serial read from the physical tag. Optional: when omitted a
  // random UID is generated (which won't match a customer scan), so the UI is
  // expected to supply the tag's actual UID.
  uid: z.string().min(3).max(64).optional(),
});

const normalizeUid = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

const getMyMerchant = async (userId: string) => {
  const r = await query<{ id: string }>(
    `SELECT id FROM merchants WHERE owner_user_id = $1`,
    [userId],
  );
  return r.rows[0]?.id ?? null;
};

export default async function merchantsRoutes(app: FastifyInstance) {
  app.get("/merchants/me", { onRequest: [app.requireMerchant] }, async (req, reply) => {
    const r = await query(
      `SELECT ${MERCHANT_FIELDS} FROM merchants WHERE owner_user_id = $1`,
      [req.user!.sub],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "no_merchant_account" });
    return r.rows[0];
  });

  app.patch("/merchants/me", { onRequest: [app.requireMerchant] }, async (req, reply) => {
    const parsed = configSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad_input" });
    const merchantId = await getMyMerchant(req.user!.sub);
    if (!merchantId) return reply.code(404).send({ error: "no_merchant_account" });

    const fields = parsed.data;
    const keys = Object.keys(fields) as (keyof typeof fields)[];
    if (keys.length === 0) return reply.send({ ok: true });
    const set = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
    const values = keys.map((k) => (fields as Record<string, unknown>)[k]);
    await query(`UPDATE merchants SET ${set} WHERE id = $1`, [merchantId, ...values]);
    return reply.send({ ok: true });
  });

  // Upload a logo image (multipart) and, in the same request, persist the brand
  // colours the web client derived from that logo. Returns the updated merchant.
  app.post("/merchants/me/logo", { onRequest: [app.requireMerchant] }, async (req, reply) => {
    const merchantId = await getMyMerchant(req.user!.sub);
    if (!merchantId) return reply.code(404).send({ error: "no_merchant_account" });

    let logoUrl: string | null = null;
    const colors: Record<string, string> = {};

    try {
      for await (const part of req.parts()) {
        if (part.type === "file") {
          if (part.fieldname !== "logo") {
            await part.toBuffer(); // drain unexpected files
            continue;
          }
          const ext = EXT_BY_MIME[part.mimetype];
          if (!ext) return reply.code(415).send({ error: "unsupported_type" });
          const buf = await part.toBuffer();
          const filename = `${merchantId}-${Date.now()}.${ext}`;
          await writeFile(join(env.UPLOAD_DIR, filename), buf);
          logoUrl = `/uploads/${filename}`;
        } else if (
          ["brand_color_bg", "brand_color_fg", "brand_accent"].includes(part.fieldname)
        ) {
          const v = String(part.value);
          if (HEX.test(v)) colors[part.fieldname] = v;
        }
      }
    } catch (err) {
      // @fastify/multipart throws when fileSize is exceeded.
      req.log.warn({ err }, "logo upload failed");
      return reply.code(413).send({ error: "file_too_large" });
    }

    if (!logoUrl) return reply.code(400).send({ error: "no_file" });

    const values: unknown[] = [merchantId, logoUrl];
    const sets = ["logo_url = $2"];
    for (const [k, v] of Object.entries(colors)) {
      values.push(v);
      sets.push(`${k} = $${values.length}`);
    }
    await query(`UPDATE merchants SET ${sets.join(", ")} WHERE id = $1`, values);

    const r = await query(`SELECT ${MERCHANT_FIELDS} FROM merchants WHERE id = $1`, [merchantId]);
    return reply.send(r.rows[0]);
  });

  app.get("/merchants/me/stats", { onRequest: [app.requireMerchant] }, async (req, reply) => {
    const merchantId = await getMyMerchant(req.user!.sub);
    if (!merchantId) return reply.code(404).send({ error: "no_merchant_account" });

    const today = await query<{ visits: string; nfc: string; qr: string; rewards: string }>(
      `
      SELECT
        (SELECT count(*)::text FROM stamp_events WHERE merchant_id = $1 AND scanned_at::date = current_date) AS visits,
        (SELECT count(*)::text FROM stamp_events WHERE merchant_id = $1 AND method = 'nfc' AND scanned_at::date = current_date) AS nfc,
        (SELECT count(*)::text FROM stamp_events WHERE merchant_id = $1 AND method = 'qr' AND scanned_at::date = current_date) AS qr,
        (SELECT count(*)::text FROM rewards WHERE merchant_id = $1 AND created_at::date = current_date) AS rewards
      `,
      [merchantId],
    );

    const week = await query<{ day: string; count: string }>(
      `
      SELECT to_char(d::date, 'YYYY-MM-DD') AS day,
             coalesce(count(s.id), 0)::text AS count
      FROM generate_series(current_date - interval '6 days', current_date, interval '1 day') d
      LEFT JOIN stamp_events s ON s.merchant_id = $1 AND s.scanned_at::date = d::date
      GROUP BY d
      ORDER BY d
      `,
      [merchantId],
    );

    const recent = await query(
      `
      SELECT s.id, s.method, s.geo_verified, s.scanned_at, s.scan_lat, s.scan_lng,
             u.full_name, u.email
      FROM stamp_events s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.merchant_id = $1
      ORDER BY s.scanned_at DESC
      LIMIT 12
      `,
      [merchantId],
    );

    return reply.send({
      today: today.rows[0],
      week: week.rows,
      recent: recent.rows,
    });
  });

  // Combined activity feed: stamps given + rewards redeemed, most recent first.
  app.get("/merchants/me/history", { onRequest: [app.requireMerchant] }, async (req, reply) => {
    const merchantId = await getMyMerchant(req.user!.sub);
    if (!merchantId) return reply.code(404).send({ error: "no_merchant_account" });
    const r = await query(
      `
      SELECT 'stamp' AS type, s.scanned_at AS at, s.method, u.full_name, u.email
      FROM stamp_events s LEFT JOIN users u ON u.id = s.user_id
      WHERE s.merchant_id = $1
      UNION ALL
      SELECT 'reward' AS type, r.redeemed_at AS at, NULL AS method, u.full_name, u.email
      FROM rewards r LEFT JOIN users u ON u.id = r.user_id
      WHERE r.merchant_id = $1 AND r.redeemed = true AND r.redeemed_at IS NOT NULL
      ORDER BY at DESC
      LIMIT 60
      `,
      [merchantId],
    );
    return reply.send({ events: r.rows });
  });

  // Customers of THIS merchant only (scoped by ownership), with visit counts.
  // Supports ?q= (search name/email/phone) and ?sort=visits|recent|name.
  app.get("/merchants/me/customers", { onRequest: [app.requireMerchant] }, async (req, reply) => {
    const merchantId = await getMyMerchant(req.user!.sub);
    if (!merchantId) return reply.code(404).send({ error: "no_merchant_account" });

    const { q, sort } = req.query as { q?: string; sort?: string };
    const term = (q ?? "").trim();
    const like = `%${term}%`;
    const order =
      sort === "recent"
        ? "lc.last_visit_at DESC NULLS LAST"
        : sort === "name"
          ? "u.full_name ASC"
          : "lc.total_stamps_earned DESC";

    const r = await query(
      `
      SELECT u.id, u.full_name, u.email, u.phone,
             lc.total_stamps_earned AS visits,
             lc.stamps_count, lc.stamps_count AS current_stamps, lc.last_visit_at,
             (SELECT count(*)::int FROM rewards rr WHERE rr.card_id = lc.id AND rr.redeemed) AS rewards_used
      FROM loyalty_cards lc
      JOIN users u ON u.id = lc.user_id
      WHERE lc.merchant_id = $1
        AND ($2 = '' OR u.full_name ILIKE $3 OR u.email ILIKE $3 OR coalesce(u.phone, '') ILIKE $3)
      ORDER BY ${order}
      LIMIT 300
      `,
      [merchantId, term, like],
    );
    return reply.send({ customers: r.rows });
  });

  app.get("/merchants/me/nfc", { onRequest: [app.requireMerchant] }, async (req, reply) => {
    const merchantId = await getMyMerchant(req.user!.sub);
    if (!merchantId) return reply.code(404).send({ error: "no_merchant_account" });
    const r = await query(
      `SELECT id, uid, device_type, label, status, provisioned_at, last_used_at
       FROM nfc_devices WHERE merchant_id = $1 ORDER BY provisioned_at DESC`,
      [merchantId],
    );
    return reply.send({ devices: r.rows });
  });

  app.post("/merchants/me/nfc/provision", { onRequest: [app.requireMerchant] }, async (req, reply) => {
    const parsed = provisionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad_input" });
    const merchantId = await getMyMerchant(req.user!.sub);
    if (!merchantId) return reply.code(404).send({ error: "no_merchant_account" });
    const uid = parsed.data.uid
      ? normalizeUid(parsed.data.uid)
      : randomBytes(6).toString("hex").toUpperCase();
    try {
      const r = await query(
        `INSERT INTO nfc_devices (merchant_id, uid, device_type, label)
         VALUES ($1, $2, $3, $4)
         RETURNING id, uid, device_type, label, status, provisioned_at, last_used_at`,
        [merchantId, uid, parsed.data.device_type, parsed.data.label ?? null],
      );
      return reply.send(r.rows[0]);
    } catch (err) {
      if ((err as { code?: string }).code === "23505") {
        return reply.code(409).send({ error: "uid_taken" });
      }
      throw err;
    }
  });

  // Re-bind a device to the real tag serial (or rename it). Used when a tag was
  // first provisioned with a placeholder UID and then read from the customer's
  // phone — the merchant pastes that UID here so future scans match.
  app.patch("/merchants/me/nfc/:id", { onRequest: [app.requireMerchant] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = z
      .object({ uid: z.string().min(3).max(64).optional(), label: z.string().max(60).nullable().optional() })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad_input" });
    const merchantId = await getMyMerchant(req.user!.sub);
    if (!merchantId) return reply.code(404).send({ error: "no_merchant_account" });
    const sets: string[] = [];
    const values: unknown[] = [id, merchantId];
    if (parsed.data.uid !== undefined) {
      values.push(normalizeUid(parsed.data.uid));
      sets.push(`uid = $${values.length}`);
    }
    if (parsed.data.label !== undefined) {
      values.push(parsed.data.label);
      sets.push(`label = $${values.length}`);
    }
    if (sets.length === 0) return reply.code(400).send({ error: "bad_input" });
    try {
      const r = await query(
        `UPDATE nfc_devices SET ${sets.join(", ")} WHERE id = $1 AND merchant_id = $2
         RETURNING id, uid, device_type, label, status, provisioned_at, last_used_at`,
        values,
      );
      if (r.rowCount === 0) return reply.code(404).send({ error: "not_found" });
      return reply.send(r.rows[0]);
    } catch (err) {
      if ((err as { code?: string }).code === "23505") {
        return reply.code(409).send({ error: "uid_taken" });
      }
      throw err;
    }
  });

  app.post("/merchants/me/nfc/:id/revoke", { onRequest: [app.requireMerchant] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const merchantId = await getMyMerchant(req.user!.sub);
    if (!merchantId) return reply.code(404).send({ error: "no_merchant_account" });
    await query(`UPDATE nfc_devices SET status = 'revoked' WHERE id = $1 AND merchant_id = $2`, [id, merchantId]);
    return reply.send({ ok: true });
  });
}
