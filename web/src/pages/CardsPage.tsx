import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { CardTile, type CardSummary } from "../components/CardTile";
import { FeaturedCard } from "../components/FeaturedCard";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { pageVariants, staggerChild, staggerParent } from "../lib/motion";

export const CardsPage = () => {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["cards"],
    queryFn: () => api<{ cards: CardSummary[] }>("/cards"),
  });

  // The "featured" card = the one closest to a reward (smallest remaining)
  const cards = data?.cards ?? [];
  const featured = [...cards].sort((a, b) => {
    const ra = a.stamps_required - a.stamps_count;
    const rb = b.stamps_required - b.stamps_count;
    return ra - rb;
  })[0];
  const rest = featured ? cards.filter((c) => c.id !== featured.id) : cards;

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" exit="exit">
      {/* === Greeting block === */}
      <header className="px-6 pt-12 pb-6">
        <motion.p
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="text-[12px] text-muted"
        >
          Bonjour,
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="font-display text-[44px] md:text-6xl tracking-tighter font-semibold leading-[0.95] mt-1"
        >
          {user?.full_name.split(" ")[0]}.
        </motion.h1>
      </header>

      {/* === Featured "next reward" hero === */}
      {featured && (
        <section className="px-6">
          <FeaturedCard card={featured} />
        </section>
      )}

      {/* === Other cards — sans eyebrow inutile === */}
      <section className="px-6 mt-10 pb-4">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="font-display text-2xl tracking-tighter font-semibold">
            Vos autres cartes
          </h2>
          <Link
            to="/scan"
            className="text-[13px] underline-offset-4 hover:underline text-ink font-medium"
          >
            + Ajouter
          </Link>
        </div>

        {isLoading && <CardSkeletons />}

        <motion.ul
          variants={staggerParent}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-5"
        >
          {rest.map((card, i) => (
            <motion.li key={card.id} variants={staggerChild}>
              <CardTile card={card} index={i} />
            </motion.li>
          ))}
        </motion.ul>

        {!isLoading && cards.length === 0 && <EmptyState />}
      </section>
    </motion.div>
  );
};

const CardSkeletons = () => (
  <div className="flex flex-col gap-5">
    {[0, 1].map((i) => (
      <div
        key={i}
        className="h-72 rounded-[var(--radius-2xl)] bg-paper-2 relative overflow-hidden shimmer"
      />
    ))}
  </div>
);

const EmptyState = () => (
  <div className="mt-8 text-center py-16 rounded-[var(--radius-2xl)] bg-paper-2">
    <p className="font-display text-2xl tracking-tight font-semibold">Aucune carte pour l'instant.</p>
    <p className="text-ink-3 mt-2 text-[14px] max-w-[34ch] mx-auto">
      Approchez votre téléphone d'un gadget Taprivo pour en commencer une.
    </p>
  </div>
);
