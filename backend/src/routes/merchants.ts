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
});

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
    const uid = randomBytes(6).toString("hex").toUpperCase();
    const r = await query(
      `INSERT INTO nfc_devices (merchant_id, uid, device_type, label)
       VALUES ($1, $2, $3, $4)
       RETURNING id, uid, device_type, label, status, provisioned_at, last_used_at`,
      [merchantId, uid, parsed.data.device_type, parsed.data.label ?? null],
    );
    return reply.send(r.rows[0]);
  });

  app.post("/merchants/me/nfc/:id/revoke", { onRequest: [app.requireMerchant] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const merchantId = await getMyMerchant(req.user!.sub);
    if (!merchantId) return reply.code(404).send({ error: "no_merchant_account" });
    await query(`UPDATE nfc_devices SET status = 'revoked' WHERE id = $1 AND merchant_id = $2`, [id, merchantId]);
    return reply.send({ ok: true });
  });
}
