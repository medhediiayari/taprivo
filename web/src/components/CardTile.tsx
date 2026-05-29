import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { assetUrl } from "../lib/api";
import { spring } from "../lib/motion";
import { Photo } from "./Photo";
import { StampGrid } from "./StampGrid";

export type CardSummary = {
  id: string;
  stamps_count: number;
  merchant_id: string;
  merchant_name: string;
  merchant_slug: string;
  address: string;
  stamps_required: number;
  reward_description: string;
  brand_accent: string;
  logo_url?: string | null;
  pending_rewards?: number | string;
};

type Props = { card: CardSummary; index?: number };

/**
 * Card tile redesigned:
 *  - Top half: real photo (16/10 ratio) with merchant name overlaid in the bottom-left
 *  - Bottom half: huge stamp count number + StampGrid + reward strip
 *
 * The whole tile shares layoutIds with CardDetailPage for a morph transition.
 */
export const CardTile = ({ card, index = 0 }: Props) => {
  const remaining = Math.max(0, card.stamps_required - card.stamps_count);
  const hasReward = Number(card.pending_rewards ?? 0) > 0;
  return (
    <Link to={`/card/${card.id}`} className="block focus:outline-none">
      <motion.article
        layoutId={`card-${card.id}`}
        initial={{ opacity: 0, y: 36 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: index * 0.07 }}
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.985 }}
        className="group relative overflow-hidden rounded-[var(--radius-2xl)] bg-paper"
        style={{ boxShadow: "var(--shadow-lift)" }}
      >
        {/* === PHOTO HERO === */}
        <motion.div layoutId={`card-photo-${card.id}`} className="relative">
          <Photo
            src={assetUrl(card.logo_url)}
            alt={card.merchant_name}
            aspect="aspect-[16/10]"
            overlay="strong"
            rounded=""
            fallbackColor={card.brand_accent}
          />
          {/* Brand accent corner ribbon */}
          <div
            className="absolute top-4 left-4 px-3 py-1 rounded-full text-[10px] uppercase tracking-[0.22em] font-mono"
            style={{ background: card.brand_accent, color: "var(--color-paper)" }}
          >
            {remaining === 0 ? "complète" : `${remaining} restant${remaining > 1 ? "s" : ""}`}
          </div>
          {hasReward && (
            <motion.div
              initial={{ scale: 0, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ ...spring, delay: 0.2 }}
              className="absolute top-4 right-4 h-10 w-10 rounded-full flex items-center justify-center"
              style={{ background: "var(--color-soleil)", color: "var(--color-ink)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="8" width="18" height="13" rx="1.5" />
                <path d="M3 12h18" />
                <path d="M12 8v13" />
                <path d="M8 8a3 3 0 0 1 4-3 3 3 0 0 1 4 3" />
              </svg>
            </motion.div>
          )}
          <motion.div
            layoutId={`card-name-${card.id}`}
            className="absolute left-5 right-5 bottom-4"
          >
            <h3 className="font-display text-2xl md:text-3xl font-semibold tracking-tighter text-paper leading-[0.95]">
              {card.merchant_name}
            </h3>
            <p className="text-paper/75 text-[12px] mt-1.5 font-mono uppercase tracking-wider truncate">
              {card.address.split(",")[0]}
            </p>
          </motion.div>
        </motion.div>

        {/* === STAMPS + REWARD === */}
        <div className="p-5 md:p-6 flex flex-col gap-5">
          <div className="flex items-end justify-between gap-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] font-mono text-muted">Tampons</p>
              <p className="mt-1 font-display text-5xl font-semibold tracking-tighter leading-none">
                <span className="font-tabular">{card.stamps_count}</span>
                <span className="text-muted text-3xl">/{card.stamps_required}</span>
              </p>
            </div>
            <div className="flex-1 max-w-[60%]">
              <StampGrid
                filled={card.stamps_count}
                total={card.stamps_required}
                accent={card.brand_accent}
                size="sm"
              />
            </div>
          </div>

          <div
            className="flex items-center justify-between gap-3 border-t hairline pt-4 text-[13px]"
          >
            <span className="flex items-center gap-2 min-w-0">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ background: card.brand_accent }}
              />
              <span className="text-ink-3 truncate">{card.reward_description}</span>
            </span>
            <ArrowRight />
          </div>
        </div>
      </motion.article>
    </Link>
  );
};

const ArrowRight = () => (
  <motion.svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    initial={{ x: 0 }}
    whileHover={{ x: 4 }}
    className="text-muted shrink-0"
  >
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </motion.svg>
);
