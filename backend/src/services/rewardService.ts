import { query } from "../db.js";
import { patchLoyaltyPoints, walletConfigured } from "./walletService.js";

/**
 * Marks a reward redeemed and resets its card to zero (the loyalty cycle
 * restarts only here, not when the card first fills up). Best-effort syncs the
 * Google Wallet pass back to 0. Shared by the merchant scan-redeem, the NFC
 * tap-to-redeem, and the legacy client endpoint.
 */
export async function settleRedemption(row: {
  id: string;
  card_id: string;
  google_object_id: string | null;
  stamps_required: number;
}): Promise<void> {
  await query(`UPDATE rewards SET redeemed = true, redeemed_at = now() WHERE id = $1`, [row.id]);
  await query(`UPDATE loyalty_cards SET stamps_count = 0 WHERE id = $1`, [row.card_id]);
  if (walletConfigured() && row.google_object_id) {
    void patchLoyaltyPoints(row.google_object_id, row.card_id, 0, row.stamps_required).catch(() => {});
  }
}
