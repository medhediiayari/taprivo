import { createHmac, timingSafeEqual } from "node:crypto";

export const computeNfcChallenge = (
  challenge: string,
  secretKey: string,
): string => createHmac("sha256", secretKey).update(challenge).digest("hex");

export const verifyNfcChallenge = (
  challenge: string,
  expectedHmac: string,
  secretKey: string,
): boolean => {
  const computed = computeNfcChallenge(challenge, secretKey);
  if (computed.length !== expectedHmac.length) return false;
  try {
    return timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(expectedHmac, "hex"));
  } catch {
    return false;
  }
};
