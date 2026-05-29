import bcrypt from "bcryptjs";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { query } from "../db.js";
import { env } from "../env.js";
import { getDeviceId } from "../middleware/deviceBinding.js";
import {
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
} from "../services/refreshTokenService.js";

const signupSchema = z.object({
  full_name: z.string().min(2).max(80),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128),
  phone: z.string().optional(),
  role: z.enum(["client", "merchant"]).default("client"),
  device_id: z.string().max(200).optional(),
});

// Note: admin accounts cannot be self-created via /auth/signup.
// They must be seeded or created by an existing admin via /admin/users.

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
  device_id: z.string().max(200).optional(),
});

const refreshSchema = z.object({ refresh_token: z.string().min(20) });
const logoutSchema = z.object({ refresh_token: z.string().min(20).optional() });

type SessionUser = { id: string; role: string; email: string; full_name: string };

// Mint an access token (carrying the device id) plus a rotating refresh token.
const issueSession = async (reply: FastifyReply, req: FastifyRequest, user: SessionUser) => {
  const deviceId = getDeviceId(req);
  const userAgent = req.headers["user-agent"] ?? null;
  const token = await reply.jwtSign(
    { sub: user.id, role: user.role, email: user.email, did: deviceId },
    { expiresIn: env.ACCESS_TTL },
  );
  const refresh = await issueRefreshToken(user.id, deviceId, userAgent);
  return {
    token,
    refresh_token: refresh.token,
    refresh_expires_at: refresh.expiresAt.toISOString(),
  };
};

export default async function authRoutes(app: FastifyInstance) {
  app.post("/auth/signup", async (req, reply) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad_input", issues: parsed.error.issues });
    const { full_name, email, password, phone, role } = parsed.data;

    const exists = await query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email]);
    if (exists.rowCount && exists.rowCount > 0) {
      return reply.code(409).send({ error: "email_taken" });
    }
    const hash = await bcrypt.hash(password, 10);
    const ins = await query<SessionUser>(
      `INSERT INTO users (full_name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, role, email, full_name`,
      [full_name, email, phone ?? null, hash, role],
    );
    const u = ins.rows[0];
    const session = await issueSession(reply, req, u);
    return reply.send({ ...session, user: u });
  });

  app.post("/auth/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad_input" });
    const { email, password } = parsed.data;

    const r = await query<SessionUser & { password_hash: string; status: string }>(
      `SELECT id, role, password_hash, email, full_name, status FROM users WHERE email = $1`,
      [email],
    );
    if (r.rowCount === 0) return reply.code(401).send({ error: "invalid_credentials" });
    const u = r.rows[0];
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return reply.code(401).send({ error: "invalid_credentials" });
    if (u.status === "suspended") return reply.code(403).send({ error: "account_suspended" });

    const session = await issueSession(reply, req, u);
    return reply.send({
      ...session,
      user: { id: u.id, role: u.role, email: u.email, full_name: u.full_name },
    });
  });

  // Exchange a refresh token for a new access token (and a rotated refresh
  // token). The old refresh token is invalidated on every successful call.
  app.post("/auth/refresh", async (req, reply) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad_input" });

    const deviceId = getDeviceId(req);
    const userAgent = req.headers["user-agent"] ?? null;
    const rot = await rotateRefreshToken(parsed.data.refresh_token, deviceId, userAgent);
    if (!rot.ok) {
      const code = rot.reason === "device_mismatch" ? 403 : 401;
      return reply.code(code).send({ error: `refresh_${rot.reason}` });
    }

    const u = await query<SessionUser & { status: string }>(
      `SELECT id, role, email, full_name, status FROM users WHERE id = $1`,
      [rot.userId],
    );
    if (u.rowCount === 0 || u.rows[0].status === "suspended") {
      await revokeRefreshToken(rot.token);
      return reply.code(401).send({ error: "user_unavailable" });
    }
    const user = u.rows[0];

    const token = await reply.jwtSign(
      { sub: user.id, role: user.role, email: user.email, did: rot.deviceId },
      { expiresIn: env.ACCESS_TTL },
    );
    return reply.send({
      token,
      refresh_token: rot.token,
      refresh_expires_at: rot.expiresAt.toISOString(),
      user: { id: user.id, role: user.role, email: user.email, full_name: user.full_name },
    });
  });

  app.post("/auth/logout", async (req, reply) => {
    const parsed = logoutSchema.safeParse(req.body ?? {});
    if (parsed.success && parsed.data.refresh_token) {
      await revokeRefreshToken(parsed.data.refresh_token);
    }
    return reply.send({ ok: true });
  });

  app.get("/auth/me", { onRequest: [app.requireAuth] }, async (req) => {
    const r = await query<{ id: string; email: string; full_name: string; role: string }>(
      `SELECT id, email, full_name, role FROM users WHERE id = $1`,
      [req.user!.sub],
    );
    return r.rows[0];
  });
}
