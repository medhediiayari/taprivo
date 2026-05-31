import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useState } from "react";
import { api } from "../../lib/api";
import { fmtRelative, initials } from "../../lib/format";
import { pageVariants, staggerChild, staggerParent } from "../../lib/motion";

type Customer = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  visits: number;
  current_stamps: number;
  last_visit_at: string | null;
  rewards_used: number;
};

type Sort = "visits" | "recent" | "name";

export const MerchantCustomersPage = () => {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("visits");

  const { data, isFetching } = useQuery({
    queryKey: ["merchant-customers", q, sort],
    queryFn: () =>
      api<{ customers: Customer[] }>(
        `/merchants/me/customers?q=${encodeURIComponent(q)}&sort=${sort}`,
      ),
  });
  const customers = data?.customers ?? [];

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" exit="exit" className="pb-8">
      <header className="px-6 pt-12">
        <p className="text-[11px] uppercase tracking-[0.22em] font-mono text-muted">Fidélité</p>
        <h1 className="font-display text-4xl md:text-5xl tracking-tighter font-medium leading-none mt-2">
          Clients
        </h1>
        <p className="text-[13px] text-ink-3 mt-2">
          {customers.length} client{customers.length > 1 ? "s" : ""} de votre établissement.
        </p>
      </header>

      <section className="px-5 mt-6 space-y-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher : nom, email, téléphone…"
          className="w-full rounded-full bg-paper border hairline px-5 py-3 text-[14px] outline-none focus:border-ink/30"
        />
        <div className="flex gap-2">
          {(
            [
              ["visits", "Visites"],
              ["recent", "Récents"],
              ["name", "Nom"],
            ] as [Sort, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={`text-[12px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full transition-colors ${
                sort === key ? "bg-ink text-paper" : "bg-paper-2 text-ink-3"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="px-5 mt-5">
        {customers.length === 0 ? (
          <div className="mx-1 py-16 text-center rounded-[var(--radius-2xl)] bg-paper-2">
            <p className="font-display text-2xl tracking-tight font-semibold">
              {isFetching ? "…" : "Aucun client"}
            </p>
            <p className="text-ink-3 mt-2 text-[13px]">
              {q ? "Aucun résultat pour cette recherche." : "Vos clients apparaîtront ici."}
            </p>
          </div>
        ) : (
          <motion.ul variants={staggerParent} initial="hidden" animate="visible" className="flex flex-col gap-2">
            {customers.map((c) => (
              <motion.li
                key={c.id}
                variants={staggerChild}
                className="rounded-[var(--radius-lg)] bg-paper border hairline px-4 py-3 flex items-center gap-3"
              >
                <span className="h-10 w-10 rounded-full bg-paper-2 flex items-center justify-center text-[12px] font-medium text-ink-3 shrink-0">
                  {c.full_name ? initials(c.full_name) : "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium truncate">{c.full_name ?? "Client"}</p>
                  <p className="text-[12px] text-muted truncate">{c.email ?? "—"}</p>
                  {c.phone && <p className="text-[12px] text-muted truncate">{c.phone}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display text-2xl tracking-tight font-semibold leading-none">
                    {c.visits}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.18em] font-mono text-muted mt-1">
                    visites
                  </p>
                  {c.last_visit_at && (
                    <p className="text-[10px] text-muted mt-1">{fmtRelative(c.last_visit_at)}</p>
                  )}
                </div>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </section>
    </motion.div>
  );
};
