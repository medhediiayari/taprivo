import type { FastifyRequest } from "fastify";

// Resolve the caller's device identifier from the `X-Device-Id` header,
// falling back to a `device_id` field in the JSON body. Capped to a sane
// length so a hostile client can't store an unbounded value.
export const getDeviceId = (req: FastifyRequest): string | null => {
  const header = req.headers["x-device-id"];
  if (typeof header === "string" && header.trim()) return header.trim().slice(0, 200);
  const body = req.body as { device_id?: unknown } | undefined;
  if (body && typeof body.device_id === "string" && body.device_id.trim()) {
    return body.device_id.trim().slice(0, 200);
  }
  return null;
};

// True when the request's device matches the device the access token was
// issued for. Tokens minted without a device claim (legacy / web) pass through
// so existing sessions keep working; binding is only meaningful once a token
// carries a `did` claim.
export const deviceHeaderMatches = (req: FastifyRequest): boolean => {
  const did = req.user?.did;
  if (!did) return true;
  const provided = getDeviceId(req);
  if (!provided) return false;
  return provided === did;
};
