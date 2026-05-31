import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { AnimatedNumber } from "../../components/AnimatedNumber";
import { api } from "../../lib/api";
import { fmtRelative, initials } from "../../lib/format";
import { pageVariants, staggerChild, staggerParent } from "../../lib/motion";

type Stats = {
  today: { visits: string; nfc: string; qr: string; rewards: string };
  week: { day: string; count: string }[];
  recent: {
    id: string;
    method: "nfc" | "qr";
    geo_verified: boolean;
    scanned_at: string;
    full_name: string | null;
    email: string | null;
  }[];
};

type Merchant = {
  id: string;
  name: string;
  address: string;
  brand_accent: string;
};

export const DashboardPage = () => {
  const { data: m } = useQuery({
    queryKey: ["merchant-me"],
    queryFn: () => api<Merchant>("/merchants/me"),
  });
  const { data } = useQuery({
    queryKey: ["merchant-stats"],
    queryFn: () => api<Stats>("/merchants/me/stats"),
  });

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" exit="exit">
      <header className="px-6 pt-12">
        <motion.div
          variants={staggerParent}
          initial="hidden"
          animate="visible"
          className="flex items-start justify-between gap-4"
        >
          <motion.div variants={staggerChild}>
            <p className="text-[11px] uppercase tracking-[0.22em] font-mono text-muted">
              Tableau de bord
            </p>
            <h1 className="font-display text-4xl md:text-5xl tracking-tighter font-medium leading-none mt-2">
              {m?.name ?? "—"}
            </h1>
            <p className="text-[13px] text-ink-3 mt-2">{m?.address}</p>
          </motion.div>
          {m && (
            <motion.div
              variants={staggerChild}
              className="h-14 w-14 rounded-full flex items-center justify-center text-paper font-display font-medium"
              style={{ background: m.brand_accent }}
            >
              {initials(m.name)}
            </motion.div>
          )}
        </motion.div>
      </header>

      <section className="px-6 mt-10">
        <h2 className="text-[11px] uppercase tracking-[0.22em] font-mono text-muted mb-4">
          Aujourd'hui
        </h2>
        <motion.div
          variants={staggerParent}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          <Kpi label="Visites" value={Number(data?.today.visits ?? 0)} accent />
          <Kpi label="NFC" value={Number(data?.today.nfc ?? 0)} />
          <Kpi label="QR" value={Number(data?.today.qr ?? 0)} />
          <Kpi label="Récomp." value={Number(data?.today.rewards ?? 0)} />
        </motion.div>
      </section>

      <section className="px-6 mt-6 flex flex-wrap gap-2">
        <Link
          to="/merchant/config"
          className="text-[12px] font-mono uppercase tracking-wider px-4 py-2 rounded-full bg-paper-2 text-ink-3 hover:bg-paper-3"
        >
          Configuration
        </Link>
        <Link
          to="/merchant/nfc"
          className="text-[12px] font-mono uppercase tracking-wider px-4 py-2 rounded-full bg-paper-2 text-ink-3 hover:bg-paper-3"
        >
          Badges NFC
        </Link>
      </section>

      <section className="px-6 mt-10">
        <h2 className="text-[11px] uppercase tracking-[0.22em] font-mono text-muted mb-4">
          7 derniers jours
        </h2>
        <WeekChart week={data?.week ?? []} />
      </section>

      <section className="px-6 mt-10">
        <h2 className="text-[11px] uppercase tracking-[0.22em] font-mono text-muted mb-4">
          Derniers tampons
        </h2>
        {data?.recent.length === 0 ? (
          <p className="text-ink-3 text-[14px]">Aucun scan encore aujourd'hui.</p>
        ) : (
          <ul className="divide-y hairline">
            {data?.recent.map((r) => (
              <motion.li
                key={r.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="py-3 flex items-center justify-between text-[13px]"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span
                    className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded-full shrink-0"
                    style={{ background: "var(--color-paper-2)", color: "var(--color-ink-3)" }}
                  >
                    {r.method}
                  </span>
                  <span className="truncate text-ink">{r.full_name ?? "Anonyme"}</span>
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className={`text-[11px] font-mono uppercase tracking-wider ${r.geo_verified ? "text-olive" : "text-terracotta"}`}>
                    {r.geo_verified ? "GPS ok" : "Hors zone"}
                  </span>
                  <span className="text-muted text-[12px]">{fmtRelative(r.scanned_at)}</span>
                </span>
              </motion.li>
            ))}
          </ul>
        )}
      </section>
    </motion.div>
  );
};

function Kpi({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <motion.div
      variants={staggerChild}
      className={`rounded-[var(--radius-lg)] p-5 border hairline ${accent ? "bg-ink text-paper border-transparent" : "bg-paper"}`}
    >
      <p
        className={`text-[10px] uppercase tracking-[0.22em] font-mono ${accent ? "text-paper/60" : "text-muted"}`}
      >
        {label}
      </p>
      <p
        className={`font-display text-3xl font-medium tracking-tighter mt-2 leading-none ${accent ? "text-paper" : "text-ink"}`}
      >
        <AnimatedNumber value={value} />
      </p>
    </motion.div>
  );
}

function WeekChart({ week }: { week: { day: string; count: string }[] }) {
  const values = week.map((d) => Number(d.count));
  const max = Math.max(1, ...values);
  const labels = ["L", "M", "M", "J", "V", "S", "D"];
  return (
    <div className="rounded-[var(--radius-lg)] p-5 border hairline bg-paper">
      <div className="flex items-end justify-between gap-2 h-32">
        {week.map((d, i) => {
          const h = (Number(d.count) / max) * 100;
          return (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full h-full flex items-end">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(6, h)}%` }}
                  transition={{
                    type: "spring",
                    stiffness: 140,
                    damping: 18,
                    delay: i * 0.05,
                  }}
                  className="w-full rounded-t-md bg-ink"
                />
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted">
                {labels[i]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
