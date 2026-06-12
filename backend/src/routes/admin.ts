import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { query, tx } from "../db.js";

const createUserSchema = z.object({
  full_name: z.string().min(2).max(80),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128).optional(),
  role: z.enum(["client", "merchant", "admin"]),
});

const updateUserSchema = z.object({
  full_name: z.string().min(2).max(80).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  role: z.enum(["client", "merchant", "admin"]).optional(),
});

const createMerchantSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
  address: z.string().max(200).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  stamps_required: z.number().int().min(3).max(50).default(10),
  reward_description: z.string().max(200).default("1 boisson offerte"),
  geofence_radius_m: z.number().int().min(20).max(2000).default(100),
  brand_accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#D85A30"),
  owner_email: z.string().email().toLowerCase().optional(),
  create_owner: z.boolean().default(false),
});

const updateMerchantSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  address: z.string().max(200).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  stamps_required: z.number().int().min(3).max(50).optional(),
  reward_description: z.string().max(200).optional(),
  geofence_radius_m: z.number().int().min(20).max(2000).optional(),
  brand_accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  brand_color_bg: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  brand_color_fg: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  nfc_enabled: z.boolean().optional(),
  status: z.enum(["active", "suspended"]).optional(),
});

export default async function adminRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async () => {});

  // ============ GLOBAL STATS ============
  app.get("/admin/stats", { onRequest: [app.requireAdmin] }, async () => {
    const totals = await query<{
      users: string;
      clients: string;
      merchants_users: string;
      merchants: string;
      cards: string;
      stamps: string;
      rewards_minted: string;
      rewards_redeemed: string;
      suspended_merchants: string;
      suspended_users: string;
    }>(
      `
      SELECT
        (SELECT count(*)::text FROM users) AS users,
        (SELECT count(*)::text FROM users WHERE role = 'client') AS clients,
        (SELECT count(*)::text FROM users WHERE role = 'merchant') AS merchants_users,
        (SELECT count(*)::text FROM merchants) AS merchants,
        (SELECT count(*)::text FROM loyalty_cards) AS cards,
        (SELECT count(*)::text FROM stamp_events) AS stamps,
        (SELECT count(*)::text FROM rewards) AS rewards_minted,
        (SELECT count(*)::text FROM rewards WHERE redeemed = true) AS rewards_redeemed,
        (SELECT count(*)::text FROM merchants WHERE status = 'suspended') AS suspended_merchants,
        (SELECT count(*)::text FROM users WHERE status = 'suspended') AS suspended_users
      `,
    );

    const topMerchants = await query(
      `
      SELECT m.id, m.name, m.slug, m.brand_accent, m.status,
             coalesce(count(s.id), 0)::int AS stamps_count,
             (SELECT count(*) FROM loyalty_cards lc WHERE lc.merchant_id = m.id)::int AS cards_count
      FROM merchants m
      LEFT JOIN stamp_events s ON s.merchant_id = m.id AND s.scanned_at > now() - interval '30 days'
      GROUP BY m.id
      ORDER BY stamps_count DESC
      LIMIT 8
      `,
    );

    const week = await query<{ day: string; count: string }>(
      `
      SELECT to_char(d::date, 'YYYY-MM-DD') AS day,
             coalesce(count(s.id), 0)::text AS count
      FROM generate_series(current_date - interval '6 days', current_date, interval '1 day') d
      LEFT JOIN stamp_events s ON s.scanned_at::date = d::date
      GROUP BY d
      ORDER BY d
      `,
    );

    const recentSignups = await query(
      `
      SELECT id, full_name, email, role, status, created_at
      FROM users ORDER BY created_at DESC LIMIT 6
      `,
    );

    return {
      totals: totals.rows[0],
      top_merchants: topMerchants.rows,
      week: week.rows,
      recent_signups: recentSignups.rows,
    };
  });

  // ============ USERS ============
  app.get("/admin/users", { onRequest: [app.requireAdmin] }, async (req) => {
    const q = (req.query as { q?: string; role?: string }).q?.trim() ?? "";
    const role = (req.query as { role?: string }).role;
    const where: string[] = [];
    const params: unknown[] = [];
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      where.push(`(lower(full_name) LIKE $${params.length} OR lower(email) LIKE $${params.length})`);
    }
    if (role && ["client", "merchant", "admin"].includes(role)) {
      params.push(role);
      where.push(`role = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const r = await query(
      `
      SELECT u.id, u.full_name, u.email, u.role, u.status, u.created_at,
             (SELECT count(*) FROM loyalty_cards lc WHERE lc.user_id = u.id)::int AS cards_count,
             (SELECT count(*) FROM stamp_events se WHERE se.user_id = u.id)::int AS stamps_count
      FROM users u
      ${whereSql}
      ORDER BY u.created_at DESC
      LIMIT 100
      `,
      params,
    );
    return { users: r.rows };
  });

  app.post("/admin/users", { onRequest: [app.requireAdmin] }, async (req, reply) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad_input", issues: parsed.error.issues });
    const { full_name, email, role } = parsed.data;
    const password = parsed.data.password ?? randomBytes(6).toString("hex");
    const exists = await query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email]);
    if (exists.rowCount) return reply.code(409).send({ error: "email_taken" });
    const hash = await bcrypt.hash(password, 10);
    const r = await query<{ id: string }>(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [full_name, email, hash, role],
    );
    return reply.send({ id: r.rows[0].id, email, role, generated_password: parsed.data.password ? undefined : password });
  });

  app.patch("/admin/users/:id", { onRequest: [app.requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad_input" });
    const fields = parsed.data;
    const keys = Object.keys(fields) as (keyof typeof fields)[];
    if (keys.length === 0) return reply.send({ ok: true });
    const set = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
    const values = keys.map((k) => (fields as Record<string, unknown>)[k]);
    await query(`UPDATE users SET ${set} WHERE id = $1`, [id, ...values]);
    return reply.send({ ok: true });
  });

  app.delete("/admin/users/:id", { onRequest: [app.requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (id === req.user!.sub) return reply.code(400).send({ error: "cannot_delete_self" });
    await query(`DELETE FROM users WHERE id = $1`, [id]);
    return reply.send({ ok: true });
  });

  // ============ MERCHANTS ============
  app.get("/admin/merchants", { onRequest: [app.requireAdmin] }, async () => {
    const r = await query(
      `
      SELECT m.id, m.name, m.slug, m.address, m.lat, m.lng,
             m.stamps_required, m.reward_description, m.geofence_radius_m,
             m.brand_accent, m.nfc_enabled, m.status, m.created_at,
             u.email AS owner_email, u.full_name AS owner_name,
             (SELECT count(*) FROM loyalty_cards lc WHERE lc.merchant_id = m.id)::int AS cards_count,
             (SELECT count(*) FROM stamp_events s WHERE s.merchant_id = m.id)::int AS stamps_count,
             (SELECT count(*) FROM nfc_devices d WHERE d.merchant_id = m.id AND d.status = 'active')::int AS active_devices
      FROM merchants m
      LEFT JOIN users u ON u.id = m.owner_user_id
      ORDER BY m.created_at DESC
      `,
    );
    return { merchants: r.rows };
  });

  app.post("/admin/merchants", { onRequest: [app.requireAdmin] }, async (req, reply) => {
    const parsed = createMerchantSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad_input", issues: parsed.error.issues });
    const data = parsed.data;

    return tx(async (c) => {
      let ownerUserId: string | null = null;
      let generatedPassword: string | undefined;

      if (data.owner_email) {
        const existing = await c.query<{ id: string; role: string }>(
          `SELECT id, role FROM users WHERE email = $1`,
          [data.owner_email],
        );
        if (existing.rowCount && existing.rowCount > 0) {
          if (existing.rows[0].role !== "merchant") {
            return reply.code(400).send({ error: "owner_not_merchant_role" });
          }
          ownerUserId = existing.rows[0].id;
        } else if (data.create_owner) {
          generatedPassword = randomBytes(6).toString("hex");
          const hash = await bcrypt.hash(generatedPassword, 10);
          const u = await c.query<{ id: string }>(
            `INSERT INTO users (full_name, email, password_hash, role)
             VALUES ($1, $2, $3, 'merchant') RETURNING id`,
            [data.name, data.owner_email, hash],
          );
          ownerUserId = u.rows[0].id;
        } else {
          return reply.code(404).send({ error: "owner_not_found" });
        }
      }

      const ins = await c.query<{ id: string }>(
        `INSERT INTO merchants
         (owner_user_id, name, slug, address, lat, lng, stamps_required, reward_description,
          geofence_radius_m, brand_accent, nfc_secret_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          ownerUserId,
          data.name,
          data.slug,
          data.address ?? null,
          data.lat,
          data.lng,
          data.stamps_required,
          data.reward_description,
          data.geofence_radius_m,
          data.brand_accent,
          randomBytes(32).toString("hex"),
        ],
      );

      return reply.send({
        id: ins.rows[0].id,
        owner_user_id: ownerUserId,
        generated_password: generatedPassword,
      });
    });
  });

  app.patch("/admin/merchants/:id", { onRequest: [app.requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateMerchantSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad_input" });
    const keys = Object.keys(parsed.data) as (keyof typeof parsed.data)[];
    if (keys.length === 0) return reply.send({ ok: true });
    const set = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
    const values = keys.map((k) => (parsed.data as Record<string, unknown>)[k]);
    await query(`UPDATE merchants SET ${set} WHERE id = $1`, [id, ...values]);
    return reply.send({ ok: true });
  });

  app.delete("/admin/merchants/:id", { onRequest: [app.requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await query(`DELETE FROM merchants WHERE id = $1`, [id]);
    return reply.send({ ok: true });
  });

  app.get("/admin/merchants/:id/nfc", { onRequest: [app.requireAdmin] }, async (req) => {
    const { id } = req.params as { id: string };
    const r = await query(
      `SELECT id, uid, device_type, label, status, provisioned_at, last_used_at
       FROM nfc_devices WHERE merchant_id = $1 ORDER BY provisioned_at DESC`,
      [id],
    );
    return { devices: r.rows };
  });

  // Provision a device. `uid` is optional: when the admin has physically read
  // a tag (Web NFC), its real serial is stored so customer scans match it;
  // otherwise a random UID is generated (legacy behaviour).
  app.post("/admin/merchants/:id/nfc/provision", { onRequest: [app.requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = z
      .object({
        device_type: z.enum(["sticker", "totem", "card", "bracelet"]),
        label: z.string().max(80).optional(),
        uid: z.string().min(3).max(64).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad_input" });
    const uid = (parsed.data.uid ?? randomBytes(6).toString("hex"))
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();
    try {
      const r = await query(
        `INSERT INTO nfc_devices (merchant_id, uid, device_type, label)
         VALUES ($1, $2, $3, $4)
         RETURNING id, uid, device_type, label, status, provisioned_at, last_used_at`,
        [id, uid, parsed.data.device_type, parsed.data.label ?? null],
      );
      return reply.send(r.rows[0]);
    } catch (err) {
      if ((err as { code?: string }).code === "23505") {
        return reply.code(409).send({ error: "uid_taken" });
      }
      throw err;
    }
  });

  // Update a device: re-assign its UID (after reading the physical tag),
  // rename it, or flip its status.
  app.patch("/admin/nfc/:deviceId", { onRequest: [app.requireAdmin] }, async (req, reply) => {
    const { deviceId } = req.params as { deviceId: string };
    const parsed = z
      .object({
        uid: z.string().min(3).max(64).optional(),
        label: z.string().max(80).nullable().optional(),
        status: z.enum(["active", "revoked"]).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad_input" });
    const sets: string[] = [];
    const values: unknown[] = [deviceId];
    if (parsed.data.uid !== undefined) {
      values.push(parsed.data.uid.replace(/[^a-zA-Z0-9]/g, "").toUpperCase());
      sets.push(`uid = $${values.length}`);
    }
    if (parsed.data.label !== undefined) {
      values.push(parsed.data.label);
      sets.push(`label = $${values.length}`);
    }
    if (parsed.data.status !== undefined) {
      values.push(parsed.data.status);
      sets.push(`status = $${values.length}`);
    }
    if (sets.length === 0) return reply.code(400).send({ error: "bad_input" });
    try {
      const r = await query(
        `UPDATE nfc_devices SET ${sets.join(", ")} WHERE id = $1
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

  // ============ ACTIVITY FEED ============
  app.get("/admin/activity", { onRequest: [app.requireAdmin] }, async () => {
    const r = await query(
      `
      SELECT s.id, s.method, s.geo_verified, s.scanned_at,
             u.id AS user_id, u.full_name AS user_name, u.email AS user_email,
             m.id AS merchant_id, m.name AS merchant_name, m.brand_accent
      FROM stamp_events s
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN merchants m ON m.id = s.merchant_id
      ORDER BY s.scanned_at DESC
      LIMIT 50
      `,
    );
    return { events: r.rows };
  });
}
