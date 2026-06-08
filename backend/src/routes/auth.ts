import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { query } from "../db.js";
import { env } from "../env.js";
import { getDeviceId } from "../middleware/deviceBinding.js";
import { issueCode, verifyCode } from "../services/authCodeService.js";
import { sendPasswordResetCode, sendVerificationCode } from "../services/emailService.js";
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
const resetSchema = z.object({
  email: z.string().email().toLowerCase(),
  code: z.string().min(4).max(12),
  password: z.string().min(8).max(128),
});

type SessionUser = { id: string; role: string; email: string; full_name: string };
type PublicUser = SessionUser & { email_verified: boolean };

const googleClient = new OAuth2Client();

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

// Best-effort verification email (the flow is optional / skippable).
const emailVerification = async (req: FastifyRequest, email: string) => {
  try {
    const code = await issueCode("verify_email", email);
    await sendVerificationCode(email, code);
  } catch (err) {
    req.log.warn({ err }, "verification email failed");
  }
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
    const ins = await query<PublicUser>(
      `INSERT INTO users (full_name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, role, email, full_name, email_verified`,
      [full_name, email, phone ?? null, hash, role],
    );
    const u = ins.rows[0];
    await emailVerification(req, u.email);
    const session = await issueSession(reply, req, u);
    return reply.send({ ...session, user: u });
  });

  app.post("/auth/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad_input" });
    const { email, password } = parsed.data;

    const r = await query<PublicUser & { password_hash: string; status: string }>(
      `SELECT id, role, password_hash, email, full_name, status, email_verified FROM users WHERE email = $1`,
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
      user: { id: u.id, role: u.role, email: u.email, full_name: u.full_name, email_verified: u.email_verified },
    });
  });

  // Sign in / up with a Google account. The mobile app obtains a Google ID
  // token and posts it here; we verify it and find-or-create the user.
  app.post("/auth/google", async (req, reply) => {
    const idToken = (req.body as { id_token?: string } | null)?.id_token;
    if (!idToken) return reply.code(400).send({ error: "bad_input" });
    const audiences = env.GOOGLE_OAUTH_CLIENT_IDS.split(",").map((s) => s.trim()).filter(Boolean);
    if (audiences.length === 0) return reply.code(503).send({ error: "google_not_configured" });

    let email: string | undefined;
    let name: string | undefined;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken, audience: audiences });
      const payload = ticket.getPayload();
      email = payload?.email?.toLowerCase();
      name = payload?.name;
    } catch (err) {
      req.log.warn({ err }, "google id token verification failed");
      return reply.code(401).send({ error: "invalid_google_token" });
    }
    if (!email) return reply.code(401).send({ error: "invalid_google_token" });

    const found = await query<PublicUser & { status: string }>(
      `SELECT id, role, email, full_name, status, email_verified FROM users WHERE email = $1`,
      [email],
    );
    let u: PublicUser;
    if (found.rowCount && found.rowCount > 0) {
      if (found.rows[0].status === "suspended") return reply.code(403).send({ error: "account_suspended" });
      u = found.rows[0];
    } else {
      const hash = await bcrypt.hash(randomBytes(24).toString("hex"), 10);
      const ins = await query<PublicUser>(
        `INSERT INTO users (full_name, email, password_hash, role, email_verified)
         VALUES ($1, $2, $3, 'client', true)
         RETURNING id, role, email, full_name, email_verified`,
        [name ?? email.split("@")[0], email, hash],
      );
      u = ins.rows[0];
    }
    const session = await issueSession(reply, req, u);
    return reply.send({
      ...session,
      user: { id: u.id, role: u.role, email: u.email, full_name: u.full_name, email_verified: u.email_verified },
    });
  });

  // Verify the e-mail with the 6-digit code we sent.
  app.post("/auth/verify-email", { onRequest: [app.requireAuth] }, async (req, reply) => {
    const code = (req.body as { code?: string } | null)?.code;
    if (!code) return reply.code(400).send({ error: "bad_input" });
    const ok = await verifyCode("verify_email", req.user!.email, code);
    if (!ok) return reply.code(400).send({ error: "invalid_code" });
    await query(`UPDATE users SET email_verified = true WHERE id = $1`, [req.user!.sub]);
    return reply.send({ ok: true, email_verified: true });
  });

  app.post("/auth/resend-code", { onRequest: [app.requireAuth] }, async (req, reply) => {
    await emailVerification(req, req.user!.email);
    return reply.send({ ok: true });
  });

  // Step 1: request a reset code. Always returns ok (no account enumeration).
  app.post("/auth/forgot-password", async (req, reply) => {
    const email = (req.body as { email?: string } | null)?.email?.toLowerCase().trim();
    if (!email) return reply.code(400).send({ error: "bad_input" });
    const u = await query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email]);
    if (u.rowCount && u.rowCount > 0) {
      try {
        const code = await issueCode("reset_password", email);
        await sendPasswordResetCode(email, code);
      } catch (err) {
        req.log.warn({ err }, "reset email failed");
      }
    }
    return reply.send({ ok: true });
  });

  // Step 2: set a new password using the code.
  app.post("/auth/reset-password", async (req, reply) => {
    const parsed = resetSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad_input" });
    const { email, code, password } = parsed.data;
    const ok = await verifyCode("reset_password", email, code);
    if (!ok) return reply.code(400).send({ error: "invalid_code" });
    const hash = await bcrypt.hash(password, 10);
    const upd = await query(`UPDATE users SET password_hash = $2 WHERE email = $1`, [email, hash]);
    if (upd.rowCount === 0) return reply.code(404).send({ error: "not_found" });
    return reply.send({ ok: true });
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

    const u = await query<PublicUser & { status: string }>(
      `SELECT id, role, email, full_name, status, email_verified FROM users WHERE id = $1`,
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
      user: {
        id: user.id,
        role: user.role,
        email: user.email,
        full_name: user.full_name,
        email_verified: user.email_verified,
      },
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
    const r = await query<PublicUser>(
      `SELECT id, email, full_name, role, email_verified FROM users WHERE id = $1`,
      [req.user!.sub],
    );
    return r.rows[0];
  });
}
