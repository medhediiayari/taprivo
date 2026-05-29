import type { FastifyReply, FastifyRequest } from "fastify";

export type AuthedUser = {
  sub: string;
  role: "client" | "merchant" | "admin";
  email: string;
};

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthedUser;
  }
}

export const requireAuth = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    await req.jwtVerify();
    req.user = req.user ?? (await req.jwtDecode<AuthedUser>());
  } catch {
    return reply.code(401).send({ error: "unauthorized" });
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
