import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../env.js";
import { deviceHeaderMatches } from "./deviceBinding.js";

export type AuthedUser = {
  sub: string;
  role: "client" | "merchant" | "admin";
  email: string;
  // Device the access token was issued for (device binding). Optional so
  // tokens minted before binding existed still validate.
  did?: string | null;
};

// Tell @fastify/jwt the shape of our tokens so `request.user`, `jwtVerify`,
// `jwtDecode` and `jwtSign` are all typed instead of `string | object | Buffer`.
declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; role: string; email: string; did?: string | null };
    user: AuthedUser;
  }
}

export const requireAuth = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    await req.jwtVerify();
    req.user = req.user ?? (await req.jwtDecode<AuthedUser>());
  } catch {
    return reply.code(401).send({ error: "unauthorized" });
  }
  if (env.ENFORCE_DEVICE_BINDING && !deviceHeaderMatches(req)) {
    return reply.code(401).send({ error: "device_mismatch" });
  }
};

export const requireMerchant = async (req: FastifyRequest, reply: FastifyReply) => {
  await requireAuth(req, reply);
  if (reply.sent) return;
  if (req.user?.role !== "merchant") {
    return reply.code(403).send({ error: "forbidden_merchant_only" });
  }
};

export const requireAdmin = async (req: FastifyRequest, reply: FastifyReply) => {
  await requireAuth(req, reply);
  if (reply.sent) return;
  if (req.user?.role !== "admin") {
    return reply.code(403).send({ error: "forbidden_admin_only" });
  }
};
