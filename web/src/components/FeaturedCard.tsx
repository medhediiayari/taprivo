import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { assetUrl } from "../lib/api";
import { spring } from "../lib/motion";
import type { CardSummary } from "./CardTile";
import { Photo } from "./Photo";

type Props = {
  card: CardSummary;
};

/**
 * "Next reward" hero card. Loud, terracotta-backed, photo on the right.
 * Shown at the top of the Cards page for the card closest to completion.
 */
export const FeaturedCard = ({ card }: Props) => {
  const remaining = Math.max(0, card.stamps_required - card.stamps_count);
  const progress = card.stamps_count / card.stamps_required;

  return (
    <Link to={`/card/${card.id}`} className="block focus:outline-none">
      <motion.article
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.99 }}
        className="relative overflow-hidden rounded-[var(--radius-2xl)] text-paper"
        style={{
          background: "var(--color-ink)",
          boxShadow: "var(--shadow-hero)",
        }}
      >
        {/* Soleil halo top-right */}
        <div
          aria-hidden
          className="absolute -top-12 -right-12 h-48 w-48 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(239,159,39,0.35) 0%, rgba(239,159,39,0) 70%)",
          }}
        />

        <div className="relative grid grid-cols-[1fr_auto] gap-4 p-6 md:p-7 items-start">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.22em] font-mono text-paper/65">
              Prochaine récompense
            </p>
            <h2 className="mt-2 font-display text-[40px] leading-[0.95] md:text-5xl font-semibold tracking-tighter">
              {remaining === 0 ? (
                <>
                  Carte<br />complète.
                </>
              ) : (
                <>
                  Plus que <span style={{ color: "var(--color-soleil)" }}>{remaining}</span><br />
                  <span className="text-paper/85">tampon{remaining > 1 ? "s" : ""}.</span>
                </>
              )}
            </h2>
            <p className="mt-3 text-paper/75 text-[13px] max-w-[28ch]">
              Chez <span className="text-paper font-medium">{card.merchant_name}</span> · {card.reward_description}.
            </p>

            {/* Progress bar */}
            <div className="mt-5 h-1.5 w-full rounded-full bg-paper/15 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                className="h-full rounded-full"
                style={{ background: "var(--color-soleil)" }}
              />
            </div>
          </div>

          <div className="w-24 sm:w-32 md:w-40 shrink-0">
            <Photo
              src={assetUrl(card.logo_url)}
              alt={card.merchant_name}
              aspect="aspect-[3/4]"
              rounded="rounded-[var(--radius-lg)]"
              fallbackColor={card.brand_accent}
            />
          </div>
        </div>
      </motion.article>
    </Link>
  );
};
