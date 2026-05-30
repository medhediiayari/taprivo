import type { FastifyInstance } from "fastify";
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
      return reply.code(502).send({ error: "wallet_error" });
    }
  });
}
