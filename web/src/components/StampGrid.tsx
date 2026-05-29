import { motion } from "motion/react";

type Props = {
  filled: number;
  total: number;
  accent: string;
  /** "sm" 28px, "md" 40px, "lg" 56px */
  size?: "sm" | "md" | "lg";
  /** Inverts the look for use on dark backgrounds */
  onDark?: boolean;
};

const sizes = {
  sm: { box: "h-7 w-7", num: "text-[10px]", icon: "h-3 w-3" },
  md: { box: "h-10 w-10", num: "text-[11px]", icon: "h-[18px] w-[18px]" },
  lg: { box: "h-14 w-14", num: "text-[12px]", icon: "h-6 w-6" },
};

/**
 * Tampons — chaque cellule a un léger angle aléatoire et un "press" animation
 * quand un nouveau tampon arrive, façon vrai tampon d'encre sur papier.
 *
 * - Filled: pleine, encre olive-nuit (ou sable si onDark), légère rotation
 * - Empty: outline papier avec numéro discret
 * - Reward (dernière cellule): terracotta toujours, gift glyph
 */
export const StampGrid = ({ filled, total, accent, size = "md", onDark = false }: Props) => {
  const cfg = sizes[size];
  const slots = Array.from({ length: total }, (_, i) => i);
  const cols = total > 10 ? 5 : total > 5 ? Math.ceil(total / 2) : total;

  return (
    <div
      className="grid gap-2.5"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {slots.map((i) => {
        const isReward = i === total - 1;
        const isFilled = i < filled;
        const isRewardReached = isReward && filled >= total;
        // Légère rotation déterministe pour effet "stamp"
        const rot = isFilled ? ((i * 7) % 5) - 2 : 0;

        return (
          <motion.div
            key={i}
            initial={false}
            animate={{
              scale: isFilled ? 1 : 0.94,
              opacity: isFilled ? 1 : onDark ? 0.45 : 0.6,
              rotate: rot,
            }}
            transition={{
              type: "spring",
              stiffness: 280,
              damping: 18,
              delay: isFilled ? i * 0.035 : 0,
            }}
            whileTap={{ scale: 0.92 }}
            className={[
              "relative flex items-center justify-center rounded-full",
              "font-mono uppercase tracking-tight",
              cfg.box,
              isFilled || isRewardReached ? "stamp-ink" : "",
              isFilled || isRewardReached
                ? "border-0"
                : onDark
                  ? "border border-paper/25"
                  : "border border-hairline-2",
            ].join(" ")}
            style={{
              background: isRewardReached
                ? accent
                : isFilled
                  ? onDark
                    ? "var(--color-paper)"
                    : "var(--color-ink)"
                  : "transparent",
              color: isFilled || isRewardReached
                ? onDark
                  ? "var(--color-ink)"
                  : "var(--color-paper)"
                : onDark
                  ? "rgba(244,235,217,0.5)"
                  : "var(--color-muted)",
            }}
          >
            {isReward ? (
              <RewardGlyph filled={isRewardReached} className={cfg.icon} />
            ) : isFilled ? (
              <CheckGlyph className={cfg.icon} />
            ) : (
              <span className={cfg.num}>{i + 1}</span>
            )}

            {/* Halo soleil sur la récompense atteinte */}
            {isRewardReached && (
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle, rgba(239,159,39,0.6) 0%, rgba(239,159,39,0) 70%)",
                }}
                animate={{ scale: [1, 1.6], opacity: [0.7, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

const CheckGlyph = ({ className }: { className: string }) => (
  <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const RewardGlyph = ({ filled, className }: { filled: boolean; className: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="3" y="8" width="18" height="13" rx="1.5" />
    <path d="M3 12h18" />
    <path d="M12 8v13" />
    <path d="M8 8a3 3 0 0 1 4-3 3 3 0 0 1 4 3" strokeLinecap="round" />
    {filled && <circle cx="12" cy="14.5" r="0.8" fill="currentColor" />}
  </svg>
);
