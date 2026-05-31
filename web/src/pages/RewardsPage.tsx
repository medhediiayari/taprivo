import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Button } from "../components/Button";
import { Photo } from "../components/Photo";
import { api, assetUrl } from "../lib/api";
import { fmtDate } from "../lib/format";
import { pageVariants, spring, staggerChild, staggerParent } from "../lib/motion";

type Reward = {
  id: string;
  coupon_code: string;
  redeemed: boolean;
  redeemed_at?: string;
  expires_at: string;
  created_at: string;
  merchant_id: string;
  merchant_name: string;
  reward_description: string;
  brand_accent: string;
  brand_color_bg?: string;
  logo_url?: string | null;
};

export const RewardsPage = () => {
  const [active, setActive] = useState<Reward | null>(null);
  const { data } = useQuery({
    queryKey: ["rewards"],
    queryFn: () => api<{ rewards: Reward[] }>("/rewards"),
    // Reflect redemption (done by the merchant on scan) within a few seconds.
    refetchInterval: 5000,
  });

  const pending = data?.rewards.filter((r) => !r.redeemed) ?? [];
  const used = data?.rewards.filter((r) => r.redeemed) ?? [];

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" exit="exit">
      <header className="px-6 pt-12 pb-6">
        <p className="text-[12px] text-muted">
          {pending.length === 0
            ? "Cumulez des tampons pour en débloquer"
            : `${pending.length} coupon${pending.length > 1 ? "s" : ""} à utiliser`}
        </p>
        <h1 className="mt-1 font-display text-[44px] md:text-6xl tracking-tighter font-semibold leading-[0.95]">
          Récompenses.
        </h1>
      </header>

      {/* === Pending — gros cards photo + accent === */}
      <section className="px-5 mt-4">
        {pending.length === 0 ? (
          <div className="mx-1 py-16 text-center rounded-[var(--radius-2xl)] bg-paper-2">
            <p className="font-display text-2xl tracking-tight font-semibold">Pas encore de coupon.</p>
            <p className="text-ink-3 mt-2 text-[13px] max-w-[30ch] mx-auto">
              Continuez à tamponner — votre première récompense arrive bientôt.
            </p>
          </div>
        ) : (
          <motion.ul
            variants={staggerParent}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-4"
          >
            {pending.map((r) => (
              <motion.li key={r.id} variants={staggerChild}>
                <motion.button
                  onClick={() => setActive(r)}
                  layoutId={`reward-${r.id}`}
                  className="w-full text-left rounded-[var(--radius-2xl)] overflow-hidden relative"
                  style={{ boxShadow: "var(--shadow-lift)" }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div className="relative">
                    <Photo
                      src={assetUrl(r.logo_url)}
                      alt={r.merchant_name}
                      aspect="aspect-[16/8]"
                      overlay="strong"
                      rounded=""
                      fallbackColor={r.brand_accent}
                    />
                    {/* Soleil ribbon */}
                    <div
                      className="absolute top-4 right-4 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-[0.22em] font-mono"
                      style={{ background: "var(--color-soleil)", color: "var(--color-ink)" }}
                    >
                      à utiliser
                    </div>
                    <div className="absolute bottom-5 left-5 right-5 text-paper">
                      <p className="text-[11px] uppercase tracking-[0.22em] font-mono text-paper/70">
                        {r.merchant_name}
                      </p>
                      <p className="mt-2 font-display text-2xl tracking-tighter font-semibold leading-tight">
                        {r.reward_description}
                      </p>
                    </div>
                  </div>
                  <div
                    className="flex items-center justify-between px-5 py-3 text-[12px]"
                    style={{ background: r.brand_accent, color: "var(--color-paper)" }}
                  >
                    <span className="font-mono uppercase tracking-wider">Code prêt</span>
                    <span className="font-mono uppercase tracking-wider opacity-70">
                      exp. {fmtDate(r.expires_at)}
                    </span>
                  </div>
                </motion.button>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </section>

      {used.length > 0 && (
        <section className="px-6 mt-10 pb-4">
          <h2 className="font-display text-xl tracking-tight font-semibold mb-4">
            Déjà utilisées
          </h2>
          <ul className="divide-y hairline">
            {used.map((r) => (
              <li key={r.id} className="py-3 flex items-center justify-between text-[13px]">
                <span className="text-ink-3">{r.merchant_name}</span>
                <span className="text-muted text-[11px] font-mono uppercase tracking-wider">
                  {r.redeemed_at ? fmtDate(r.redeemed_at) : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AnimatePresence>
        {active && (
          <RewardCouponModal reward={active} onClose={() => setActive(null)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

function RewardCouponModal({
  reward,
  onClose,
}: {
  reward: Reward;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "rgba(4,52,44,0.65)" }}
      onClick={onClose}
    >
      <motion.div
        layoutId={`reward-${reward.id}`}
        onClick={(e) => e.stopPropagation()}
        transition={spring}
        className="w-full sm:max-w-sm rounded-t-[var(--radius-2xl)] sm:rounded-[var(--radius-2xl)] overflow-hidden bg-paper"
      >
        <div className="relative">
          <Photo
            src={assetUrl(reward.logo_url)}
            alt={reward.merchant_name}
            aspect="aspect-[16/10]"
            overlay="strong"
            rounded=""
            fallbackColor={reward.brand_accent}
          />
          <div className="absolute bottom-5 left-5 right-5 text-paper text-center">
            <p className="text-[10px] uppercase tracking-[0.22em] font-mono text-paper/70">
              Coupon
            </p>
            <p className="font-display text-3xl tracking-tighter font-semibold mt-1 leading-none">
              {reward.merchant_name}
            </p>
          </div>
        </div>

        <div className="p-7 flex flex-col items-center gap-5 text-center">
          <p className="text-[14px] text-ink-3">{reward.reward_description}</p>
          <div
            className="rounded-[var(--radius-md)] bg-paper-2 px-6 py-4 font-mono text-2xl tracking-[0.3em] font-medium"
          >
            {reward.coupon_code}
          </div>
          <p className="text-[12px] text-muted max-w-[28ch]">
            Présentez votre carte (QR) au comptoir. Le commerçant la scanne et
            valide le cadeau — vos tampons repartent alors de zéro.
          </p>
          <Button variant="secondary" full onClick={onClose}>
            Fermer
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
