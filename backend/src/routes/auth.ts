import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { query } from "../db.js";

const signupSchema = z.object({
  full_name: z.string().min(2).max(80),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128),
  phone: z.string().optional(),
  role: z.enum(["client", "merchant"]).default("client"),
});

// Note: admin accounts cannot be self-created via /auth/signup.
// They must be seeded or created by an existing admin via /admin/users.

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

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
    const ins = await query<{ id: string; role: string; email: string; full_name: string }>(
      `INSERT INTO users (full_name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, role, email, full_name`,
      [full_name, email, phone ?? null, hash, role],
    );
    const u = ins.rows[0];
    const token = await reply.jwtSign({ sub: u.id, role: u.role, email: u.email }, { expiresIn: "15m" });
    return reply.send({ token, user: u });
  });

  app.post("/auth/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad_input" });
    const { email, password } = parsed.data;

    const r = await query<{ id: string; role: string; password_hash: string; email: string; full_name: string }>(
      `SELECT id, role, password_hash, email, full_name FROM users WHERE email = $1`,
      [email],
    );
    if (r.rowCount === 0) return reply.code(401).send({ error: "invalid_credentials" });
    const u = r.rows[0];
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return reply.code(401).send({ error: "invalid_credentials" });

    const token = await reply.jwtSign({ sub: u.id, role: u.role, email: u.email }, { expiresIn: "15m" });
    return reply.send({
      token,
      user: { id: u.id, role: u.role, email: u.email, full_name: u.full_name },
    });
  });

  app.get("/auth/me", { onRequest: [app.requireAuth] }, async (req) => {
    const r = await query<{ id: string; email: string; full_name: string; role: string }>(
      `SELECT id, email, full_name, role FROM users WHERE id = $1`,
      [req.user!.sub],
    );
    return r.rows[0];
  });
}
