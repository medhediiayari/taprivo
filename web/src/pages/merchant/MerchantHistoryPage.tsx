import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { api } from "../../lib/api";
import { fmtRelative, initials } from "../../lib/format";
import { pageVariants, staggerChild, staggerParent } from "../../lib/motion";

type Event = {
  type: "stamp" | "reward";
  at: string;
  method: "nfc" | "qr" | null;
  full_name: string | null;
  email: string | null;
};

export const MerchantHistoryPage = () => {
  const { data } = useQuery({
    queryKey: ["merchant-history"],
    queryFn: () => api<{ events: Event[] }>("/merchants/me/history"),
    refetchInterval: 8000,
  });
  const events = data?.events ?? [];

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" exit="exit" className="pb-8">
      <header className="px-6 pt-12">
        <p className="text-[11px] uppercase tracking-[0.22em] font-mono text-muted">Activité</p>
        <h1 className="font-display text-4xl md:text-5xl tracking-tighter font-medium leading-none mt-2">
          Historique
        </h1>
        <p className="text-[13px] text-ink-3 mt-2">Tampons donnés et cadeaux remis.</p>
      </header>

      <section className="px-5 mt-8">
        {events.length === 0 ? (
          <div className="mx-1 py-16 text-center rounded-[var(--radius-2xl)] bg-paper-2">
            <p className="font-display text-2xl tracking-tight font-semibold">Rien pour l'instant.</p>
            <p className="text-ink-3 mt-2 text-[13px]">Vos scans apparaîtront ici.</p>
          </div>
        ) : (
          <motion.ul variants={staggerParent} initial="hidden" animate="visible" className="flex flex-col gap-2">
            {events.map((e, i) => (
              <motion.li
                key={`${e.type}-${e.at}-${i}`}
                variants={staggerChild}
                className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-paper border hairline px-4 py-3"
              >
                <span
                  className="h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-medium shrink-0"
                  style={
                    e.type === "reward"
                      ? { background: "var(--color-soleil)", color: "var(--color-ink)" }
                      : { background: "var(--color-paper-2)", color: "var(--color-ink-3)" }
                  }
                >
                  {e.full_name ? initials(e.full_name) : "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium truncate">{e.full_name ?? "Client"}</p>
                  <p className="text-[12px] text-muted">
                    {e.type === "reward"
                      ? "Cadeau remis"
                      : `Tampon ${e.method ? `· ${e.method.toUpperCase()}` : ""}`}
                  </p>
                </div>
                <span className="text-[11px] text-muted font-mono uppercase tracking-wider whitespace-nowrap">
                  {fmtRelative(e.at)}
                </span>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </section>
    </motion.div>
  );
};
