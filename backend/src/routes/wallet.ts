import type { FastifyInstance } from "fastify";
import { query } from "../db.js";
import { renderStampGrid } from "../services/stampGridImage.js";
import { WalletNotConfigured, createSaveUrlForCard, walletConfigured } from "../services/walletService.js";

export default async function walletRoutes(app: FastifyInstance) {
  // Returns an "Add to Google Wallet" URL for one of the caller's cards.
  app.post("/wallet/google/:cardId", { onRequest: [app.requireAuth] }, async (req, reply) => {
    if (!walletConfigured()) return reply.code(503).send({ error: "wallet_not_configured" });
    const { cardId } = req.params as { cardId: string };
    try {
      const saveUrl = await createSaveUrlForCard(cardId, req.user!.sub);
      return reply.send({ saveUrl });
    } catch (err) {
      if (err instanceof WalletNotConfigured) {
        return reply.code(503).send({ error: "wallet_not_configured" });
      }
      const msg = err instanceof Error ? err.message : "wallet_error";
      if (msg === "card_not_found") return reply.code(404).send({ error: msg });
      req.log.error({ err }, "google wallet save failed");
      // Surface Google's reason (status + body) so the failure is diagnosable.
      return reply.code(502).send({ error: "wallet_error", detail: msg });
    }
  });

  // Public stamp-grid banner used as the wallet pass hero image. No auth: Google
  // fetches it server-side, unauthenticated. The card id is a UUID, so this only
  // exposes a stamp count to whoever already holds the (opaque) id.
  app.get("/wallet/grid/:cardId", async (req, reply) => {
    const { cardId } = req.params as { cardId: string };
    const r = await query<{ stamps_count: number; stamps_required: number; brand_color_bg: string }>(
      `SELECT lc.stamps_count, m.stamps_required, m.brand_color_bg
       FROM loyalty_cards lc JOIN merchants m ON m.id = lc.merchant_id
       WHERE lc.id = $1`,
      [cardId],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "card_not_found" });
    const { stamps_count, stamps_required, brand_color_bg } = r.rows[0];
    const png = renderStampGrid(stamps_count, stamps_required, brand_color_bg);
    return reply
      .header("Content-Type", "image/png")
      .header("Cache-Control", "public, max-age=3600")
      .send(png);
  });
}
