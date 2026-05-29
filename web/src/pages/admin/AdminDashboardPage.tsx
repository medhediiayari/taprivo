import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { AnimatedNumber } from "../../components/AnimatedNumber";
import { api } from "../../lib/api";
import { fmtRelative, initials } from "../../lib/format";
import { pageVariants, staggerChild, staggerParent } from "../../lib/motion";

type Stats = {
  totals: {
    users: string;
    clients: string;
    merchants_users: string;
    merchants: string;
    cards: string;
    stamps: string;
    rewards_minted: string;
    rewards_redeemed: string;
    suspended_merchants: string;
    suspended_users: string;
  };
  top_merchants: {
    id: string;
    name: string;
    slug: string;
    brand_accent: string;
    status: string;
    stamps_count: number;
    cards_count: number;
  }[];
  week: { day: string; count: string }[];
  recent_signups: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    status: string;
    created_at: string;
  }[];
};

export const AdminDashboardPage = () => {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api<Stats>("/admin/stats"),
  });

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" exit="exit">
      <header className="px-6 pt-12">
        <p className="text-[11px] uppercase tracking-[0.22em] font-mono text-muted">Administration</p>
        <h1 className="font-display text-4xl md:text-5xl tracking-tighter font-medium leading-none mt-2">
          Vue globale.
        </h1>
        <p className="text-ink-3 mt-3 text-[14px] max-w-[44ch] leading-relaxed">
          Toute la plateforme — utilisateurs, restaurants, tampons et récompenses.
        </p>
      </header>

      <section className="px-6 mt-10">
        <motion.div
          variants={staggerParent}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          <Kpi label="Utilisateurs" value={Number(data?.totals.users ?? 0)} accent />
          <Kpi label="Restaurants" value={Number(data?.totals.merchants ?? 0)} />
          <Kpi label="Cartes" value={Number(data?.totals.cards ?? 0)} />
          <Kpi label="Tampons" value={Number(data?.totals.stamps ?? 0)} />
          <Kpi label="Récomp. émises" value={Number(data?.totals.rewards_minted ?? 0)} />
          <Kpi label="Récomp. utilisées" value={Number(data?.totals.rewards_redeemed ?? 0)} />
          <Kpi
            label="Restos suspendus"
            value={Number(data?.totals.suspended_merchants ?? 0)}
            tone={Number(data?.totals.suspended_merchants ?? 0) > 0 ? "warn" : undefined}
          />
          <Kpi
            label="Users suspendus"
            value={Number(data?.totals.suspended_users ?? 0)}
            tone={Number(data?.totals.suspended_users ?? 0) > 0 ? "warn" : undefined}
          />
        </motion.div>
      </section>

      <section className="px-6 mt-10">
        <h2 className="text-[11px] uppercase tracking-[0.22em] font-mono text-muted mb-4">
          Tampons — 7 derniers jours
        </h2>
        <WeekChart week={data?.week ?? []} />
      </section>

      <section className="px-6 mt-10">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-[11px] uppercase tracking-[0.22em] font-mono text-muted">
            Top restaurants — 30 derniers jours
          </h2>
          <Link to="/admin/merchants" className="text-[12px] underline-offset-4 hover:underline text-ink">
            Voir tous
          </Link>
        </div>
        <motion.ul variants={staggerParent} initial="hidden" animate="visible" className="flex flex-col gap-2">
          {data?.top_merchants.map((m) => (
            <motion.li key={m.id} variants={staggerChild}>
              <Link
                to={`/admin/merchants?focus=${m.id}`}
                className="flex items-center gap-4 p-4 rounded-[var(--radius-lg)] border hairline bg-paper hover:bg-paper-2 transition-colors"
              >
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-paper font-display font-medium text-xs"
                  style={{ background: m.brand_accent }}
                >
                  {initials(m.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-[15px] tracking-tight font-medium leading-none">{m.name}</p>
                  <p className="text-[11px] text-muted font-mono uppercase tracking-wider mt-1.5">
                    {m.cards_count} cartes
                    {m.status === "suspended" && <span className="text-terracotta"> · suspendu</span>}
                  </p>
                </div>
                <p className="font-display text-2xl font-medium font-tabular">
                  <AnimatedNumber value={m.stamps_count} />
                </p>
              </Link>
            </motion.li>
          ))}
        </motion.ul>
      </section>

      <section className="px-6 mt-10">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-[11px] uppercase tracking-[0.22em] font-mono text-muted">
            Inscriptions récentes
          </h2>
          <Link to="/admin/users" className="text-[12px] underline-offset-4 hover:underline text-ink">
            Voir tous
          </Link>
        </div>
        <ul className="divide-y hairline">
          {data?.recent_signups.map((u) => (
            <motion.li
              key={u.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="py-3 flex items-center justify-between text-[13px]"
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="h-8 w-8 rounded-full bg-paper-2 flex items-center justify-center font-display text-xs font-medium shrink-0">
                  {initials(u.full_name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-ink">{u.full_name}</span>
                  <span className="text-[11px] text-muted block truncate">{u.email}</span>
                </span>
              </span>
              <span className="flex items-center gap-3 shrink-0">
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-full bg-paper-2 text-ink-3">
                  {u.role}
                </span>
                <span className="text-muted text-[11px]">{fmtRelative(u.created_at)}</span>
              </span>
            </motion.li>
          ))}
        </ul>
      </section>
    </motion.div>
  );
};

function Kpi({
  label,
  value,
  accent,
  tone,
}: {
  label: string;
  value: number;
  accent?: boolean;
  tone?: "warn";
}) {
  const cls = accent
    ? "bg-ink text-paper border-transparent"
    : tone === "warn"
      ? "bg-terracotta-soft text-terracotta-2 border-transparent"
      : "bg-paper";
  return (
    <motion.div variants={staggerChild} className={`rounded-[var(--radius-lg)] p-5 border hairline ${cls}`}>
      <p
        className={`text-[10px] uppercase tracking-[0.22em] font-mono ${accent ? "text-paper/60" : tone === "warn" ? "text-terracotta-2/70" : "text-muted"}`}
      >
        {label}
      </p>
      <p className="font-display text-3xl font-medium tracking-tighter mt-2 leading-none">
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
                  transition={{ type: "spring", stiffness: 140, damping: 18, delay: i * 0.05 }}
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
