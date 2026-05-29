import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { api } from "../../lib/api";
import { fmtRelative, initials } from "../../lib/format";
import { pageVariants, staggerChild, staggerParent } from "../../lib/motion";

type Event = {
  id: string;
  method: "nfc" | "qr";
  geo_verified: boolean;
  scanned_at: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  merchant_id: string;
  merchant_name: string;
  brand_accent: string;
};

export const AdminActivityPage = () => {
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["admin-activity"],
    queryFn: () => api<{ events: Event[] }>("/admin/activity"),
    refetchInterval: 15_000,
  });

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" exit="exit">
      <header className="px-6 pt-12 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] font-mono text-muted">Administration</p>
          <h1 className="font-display text-4xl tracking-tighter font-medium leading-none mt-2">
            Activité.
          </h1>
          <p className="text-ink-3 text-[13px] mt-2">
            Flux temps réel des 50 derniers tampons (rafraîchi toutes les 15 s).
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="text-[12px] text-ink-3 underline-offset-4 hover:underline"
          disabled={isFetching}
        >
          {isFetching ? "…" : "Rafraîchir"}
        </button>
      </header>

      <section className="px-6 mt-8">
        <motion.ul variants={staggerParent} initial="hidden" animate="visible" className="divide-y hairline">
          {data?.events.map((e) => (
            <motion.li key={e.id} variants={staggerChild} layout className="py-4 flex items-center gap-4">
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center text-paper font-display font-medium text-xs shrink-0"
                style={{ background: e.brand_accent }}
              >
                {initials(e.merchant_name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display text-[14px] tracking-tight font-medium leading-none">
                    {e.user_name ?? "Anonyme"}
                  </span>
                  <span className="text-[12px] text-muted">→</span>
                  <span className="text-[14px] text-ink-3">{e.merchant_name}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span
                    className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-paper-2 text-ink-3"
                  >
                    {e.method}
                  </span>
                  <span
                    className={`text-[10px] font-mono uppercase tracking-wider ${e.geo_verified ? "text-olive" : "text-terracotta"}`}
                  >
                    {e.geo_verified ? "GPS ok" : "Hors zone"}
                  </span>
                </div>
              </div>
              <span className="text-[11px] text-muted font-mono uppercase tracking-wider shrink-0">
                {fmtRelative(e.scanned_at)}
              </span>
            </motion.li>
          ))}
        </motion.ul>

        {data?.events.length === 0 && (
          <p className="text-ink-3 text-center py-12 text-[14px]">
            Aucune activité pour l'instant. Les tampons apparaîtront ici en temps réel.
          </p>
        )}
      </section>
    </motion.div>
  );
};
