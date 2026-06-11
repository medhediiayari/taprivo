import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { AnimatedNumber } from "../../components/AnimatedNumber";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { fmtRelative } from "../../lib/format";
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

type Merchant = { id: string; name: string; address: string; brand_accent: string };

const SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const LONG = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const weekday = (iso: string, long = false) =>
  (long ? LONG : SHORT)[new Date(`${iso}T00:00:00`).getDay()];

const pct = (today: number, prev: number): number | null =>
  prev > 0 ? Math.round(((today - prev) / prev) * 100) : null;

export const DashboardPage = () => {
  const { user } = useAuth();
  const { data: m } = useQuery({ queryKey: ["merchant-me"], queryFn: () => api<Merchant>("/merchants/me") });
  const { data } = useQuery({ queryKey: ["merchant-stats"], queryFn: () => api<Stats>("/merchants/me/stats") });

  const t = data?.today;
  const counts = (data?.week ?? []).map((d) => Number(d.count));
  const weekTotal = counts.reduce((a, b) => a + b, 0);
  const scans = Number(t?.qr ?? 0) + Number(t?.nfc ?? 0);
  const scansDelta = pct(counts[6] ?? 0, counts[5] ?? 0);
  const maxIdx = counts.length ? counts.indexOf(Math.max(...counts)) : -1;
  const bestDay = maxIdx >= 0 && counts[maxIdx] > 0 ? weekday(data!.week[maxIdx].day, true) : "—";
  const firstName = (user?.full_name ?? "").split(" ")[0] || "là";
  const last = data?.recent?.[0];

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="px-6 lg:px-10 pt-10 lg:pt-12 max-w-6xl"
    >
      {/* Greeting */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl lg:text-4xl tracking-tighter font-medium leading-none">
            Bonjour {firstName} <span className="align-middle">👋</span>
          </h1>
          <p className="text-[14px] text-ink-3 mt-2">
            Voici l'activité de {m?.name ?? "votre établissement"} aujourd'hui.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-3 bg-paper border hairline rounded-full px-4 py-2">
          <CalendarIcon />
          Aujourd'hui
        </span>
      </header>

      {/* KPI cards */}
      <motion.div
        variants={staggerParent}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8"
      >
        <Kpi label="Scans du jour" value={scans} delta={scansDelta} accent="ink" />
        <Kpi label="NFC" value={Number(t?.nfc ?? 0)} accent="olive" />
        <Kpi label="QR" value={Number(t?.qr ?? 0)} accent="terracotta" />
        <Kpi label="Récompenses" value={Number(t?.rewards ?? 0)} accent="soleil" />
      </motion.div>

      {/* Secondary metrics (derived from real data) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
        <MetricCard label="Total cette semaine" value={`${weekTotal}`} sub="scans sur 7 jours" />
        <MetricCard label="Jour le plus actif" value={bestDay} sub="cette semaine" />
        <MetricCard
          label="Dernier scan"
          value={last ? last.full_name ?? "Client" : "—"}
          sub={last ? fmtRelative(last.scanned_at) : "aucun pour l'instant"}
        />
      </div>

      {/* Chart + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
        <div className="lg:col-span-2 rounded-[var(--radius-lg)] p-5 border hairline bg-paper">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-lg tracking-tight font-medium">Activité de la semaine</h2>
            <span className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-muted">
              <span className="h-2 w-2 rounded-full bg-ink inline-block" /> Scans
            </span>
          </div>
          <WeekChart week={data?.week ?? []} />
        </div>

        <div className="rounded-[var(--radius-lg)] p-5 border hairline bg-paper">
          <h2 className="font-display text-lg tracking-tight font-medium mb-4">Actions rapides</h2>
          <div className="flex flex-col gap-2.5">
            <Action to="/merchant/scan" label="Scanner un client" icon={<ScanIcon />} primary />
            <Action to="/merchant/config" label="Configuration" icon={<ConfigIcon />} />
            <Action to="/merchant/customers" label="Voir mes clients" icon={<UsersIcon />} />
            <Action to="/merchant/history" label="Historique" icon={<ActivityIcon />} />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

function Kpi({
  label,
  value,
  delta,
  accent,
}: {
  label: string;
  value: number;
  delta?: number | null;
  accent: "ink" | "olive" | "terracotta" | "soleil";
}) {
  const color = {
    ink: "text-ink",
    olive: "text-olive",
    terracotta: "text-terracotta",
    soleil: "text-soleil-2",
  }[accent];
  return (
    <motion.div variants={staggerChild} className="rounded-[var(--radius-lg)] p-5 border hairline bg-paper">
      <p className="text-[10px] uppercase tracking-[0.22em] font-mono text-muted">{label}</p>
      <div className="flex items-end justify-between mt-3">
        <p className={`font-display text-4xl font-medium tracking-tighter leading-none ${color}`}>
          <AnimatedNumber value={value} />
        </p>
        {delta != null && (
          <span className={`text-[11px] font-mono ${delta >= 0 ? "text-olive" : "text-terracotta"}`}>
            {delta >= 0 ? "+" : ""}
            {delta}% <span className="text-muted">vs hier</span>
          </span>
        )}
      </div>
    </motion.div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] p-5 border hairline bg-paper">
      <p className="text-[10px] uppercase tracking-[0.22em] font-mono text-muted">{label}</p>
      <p className="font-display text-2xl font-medium tracking-tight mt-2 leading-none text-ink truncate">{value}</p>
      <p className="text-[12px] text-muted mt-1.5">{sub}</p>
    </div>
  );
}

function Action({
  to,
  label,
  icon,
  primary,
}: {
  to: string;
  label: string;
  icon: JSX.Element;
  primary?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex items-center justify-between gap-3 rounded-[var(--radius-md)] px-4 py-3 text-[14px] font-medium transition-colors ${
        primary ? "bg-ink text-paper hover:bg-ink-2" : "border hairline text-ink hover:bg-paper-2"
      }`}
    >
      <span>{label}</span>
      <span className={primary ? "text-paper/80" : "text-ink-3"}>{icon}</span>
    </Link>
  );
}

function WeekChart({ week }: { week: { day: string; count: string }[] }) {
  const max = Math.max(1, ...week.map((d) => Number(d.count)));
  return (
    <div className="flex items-end justify-between gap-3 h-44">
      {week.map((d, i) => {
        const h = (Number(d.count) / max) * 100;
        return (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-2 h-full">
            <div className="w-full flex-1 flex items-end">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(4, h)}%` }}
                transition={{ type: "spring", stiffness: 140, damping: 18, delay: i * 0.05 }}
                className="w-full rounded-t-md bg-ink"
                title={`${d.count} scans`}
              />
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted">{weekday(d.day)}</span>
          </div>
        );
      })}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function ScanIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10" />
    </svg>
  );
}
function ConfigIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5M16 4.5a3 3 0 0 1 0 6M21 20c0-2-1-3.6-3-4.4" />
    </svg>
  );
}
function ActivityIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </svg>
  );
}
