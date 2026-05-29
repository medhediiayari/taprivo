import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { Photo } from "../components/Photo";
import { api } from "../lib/api";
import { pageVariants, staggerChild, staggerParent } from "../lib/motion";

type Merchant = {
  id: string;
  name: string;
  address: string;
  reward_description: string;
  brand_accent: string;
  logo_url: string | null;
};

export const ScanPage = () => {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["merchants-public"],
    queryFn: () => api<{ merchants: Merchant[] }>("/merchants"),
  });

  const join = useMutation({
    mutationFn: (merchant_id: string) =>
      api<{ card_id: string }>("/cards/join", {
        method: "POST",
        body: JSON.stringify({ merchant_id }),
      }),
    onSuccess: (out) => {
      qc.invalidateQueries({ queryKey: ["cards"] });
      nav(`/card/${out.card_id}`);
    },
  });

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" exit="exit">
      <header className="px-6 pt-12 pb-6">
        <p className="text-[12px] text-muted">Trouvez votre prochain café préféré</p>
        <h1 className="mt-1 font-display text-[44px] md:text-6xl tracking-tighter font-semibold leading-[0.95]">
          Rejoindre.
        </h1>
      </header>

      <section className="px-5 mt-6">
        <motion.ul
          variants={staggerParent}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-4"
        >
          {data?.merchants.map((m) => (
            <motion.li key={m.id} variants={staggerChild}>
              <article
                className="relative overflow-hidden rounded-[var(--radius-2xl)] bg-paper"
                style={{ boxShadow: "var(--shadow-soft)" }}
              >
                <div className="grid grid-cols-[140px_1fr] gap-0 items-stretch">
                  <Photo
                    src={m.logo_url}
                    alt={m.name}
                    aspect="aspect-auto"
                    rounded=""
                    fallbackColor={m.brand_accent}
                    className="h-full"
                  />
                  <div className="p-5 flex flex-col justify-between gap-3">
                    <div>
                      <p
                        className="text-[10px] uppercase tracking-[0.22em] font-mono"
                        style={{ color: m.brand_accent }}
                      >
                        {m.reward_description}
                      </p>
                      <p className="font-display text-xl tracking-tighter font-semibold leading-none mt-2">
                        {m.name}
                      </p>
                      <p className="text-[12px] text-muted mt-2 line-clamp-2">{m.address}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => join.mutate(m.id)}
                      disabled={join.isPending}
                      className="self-start"
                    >
                      Rejoindre →
                    </Button>
                  </div>
                </div>
              </article>
            </motion.li>
          ))}
        </motion.ul>
      </section>

      <section className="px-6 mt-10 pb-4">
        <div className="rounded-[var(--radius-2xl)] p-6 bg-ink text-paper">
          <p className="text-[10px] uppercase tracking-[0.22em] font-mono text-paper/60">
            Le saviez-vous
          </p>
          <p className="mt-2 font-display text-xl tracking-tighter font-semibold leading-tight">
            Approchez simplement votre téléphone du gadget posé sur le comptoir — un tampon apparaît instantanément.
          </p>
        </div>
      </section>
    </motion.div>
  );
};
