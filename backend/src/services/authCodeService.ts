import { randomInt } from "node:crypto";
import { redis } from "../redis.js";

// Short-lived numeric codes (email verification, password reset) kept in Redis.

const TTL_SECONDS = 15 * 60;
const key = (purpose: string, email: string) => `authcode:${purpose}:${email.toLowerCase()}`;

export type CodePurpose = "verify_email" | "reset_password";

export async function issueCode(purpose: CodePurpose, email: string): Promise<string> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await redis.set(key(purpose, email), code, "EX", TTL_SECONDS);
  return code;
}

/** Verifies and consumes the code (single use). */
export async function verifyCode(purpose: CodePurpose, email: string, code: string): Promise<boolean> {
  const stored = await redis.get(key(purpose, email));
  if (!stored || stored !== code.trim()) return false;
  await redis.del(key(purpose, email));
  return true;
}
