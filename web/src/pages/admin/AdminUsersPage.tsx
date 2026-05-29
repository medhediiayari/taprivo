import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Button } from "../../components/Button";
import { api } from "../../lib/api";
import { fmtDate, initials } from "../../lib/format";
import { pageVariants, spring, staggerChild, staggerParent } from "../../lib/motion";
import { useAuth } from "../../lib/auth";

type Role = "client" | "merchant" | "admin";

type User = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  status: "active" | "suspended";
  created_at: string;
  cards_count: number;
  stamps_count: number;
};

export const AdminUsersPage = () => {
  const qc = useQueryClient();
  const { user: self } = useAuth();
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"" | Role>("");
  const [creating, setCreating] = useState(false);

  const { data } = useQuery({
    queryKey: ["admin-users", q, role],
    queryFn: () => {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      if (role) p.set("role", role);
      return api<{ users: User[] }>(`/admin/users${p.toString() ? `?${p.toString()}` : ""}`);
    },
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<User> }) =>
      api(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const del = useMutation({
    mutationFn: (id: string) => api(`/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const create = useMutation({
    mutationFn: (payload: any) =>
      api<{ id: string; generated_password?: string }>("/admin/users", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" exit="exit">
      <header className="px-6 pt-12 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] font-mono text-muted">Administration</p>
          <h1 className="font-display text-4xl tracking-tighter font-medium leading-none mt-2">
            Utilisateurs.
          </h1>
        </div>
        <Button onClick={() => setCreating(true)}>+ Inviter</Button>
      </header>

      <section className="px-6 mt-8">
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher nom ou email…"
            className="flex-1 h-11 px-4 rounded-[var(--radius-md)] bg-paper border hairline focus:border-ink focus:outline-none text-[14px]"
          />
          <div className="flex gap-1 p-1 rounded-full border hairline bg-paper-2 self-start sm:self-auto">
            {(["", "client", "merchant", "admin"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r as any)}
                className={`relative h-9 px-4 rounded-full text-[12px] uppercase tracking-[0.18em] font-mono transition-colors ${role === r ? "text-paper" : "text-ink-3"}`}
              >
                {role === r && (
                  <motion.span
                    layoutId="users-role-pill"
                    className="absolute inset-0 bg-ink rounded-full"
                    transition={spring}
                  />
                )}
                <span className="relative">{r === "" ? "tous" : r}</span>
              </button>
            ))}
          </div>
        </div>

        <motion.ul variants={staggerParent} initial="hidden" animate="visible" className="divide-y hairline">
          {data?.users.map((u) => (
            <motion.li
              key={u.id}
              variants={staggerChild}
              layout
              className={`py-4 flex items-center gap-4 ${u.status === "suspended" ? "opacity-60" : ""}`}
            >
              <div className="h-10 w-10 rounded-full bg-paper-2 flex items-center justify-center font-display font-medium text-xs shrink-0">
                {initials(u.full_name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-display text-[15px] tracking-tight font-medium leading-none">{u.full_name}</p>
                  <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-paper-2 text-ink-3">
                    {u.role}
                  </span>
                  {u.status === "suspended" && (
                    <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-terracotta text-paper">
                      suspendu
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-muted mt-1 truncate">{u.email}</p>
                <p className="text-[11px] text-ink-3 mt-1 font-mono">
                  {u.cards_count} carte{u.cards_count > 1 ? "s" : ""} · {u.stamps_count} tampon{u.stamps_count > 1 ? "s" : ""} · inscrit {fmtDate(u.created_at)}
                </p>
              </div>
              {self?.id !== u.id && (
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <button
                    onClick={() =>
                      update.mutate({
                        id: u.id,
                        payload: { status: u.status === "active" ? "suspended" : "active" },
                      })
                    }
                    className="text-[12px] text-ink-3 underline-offset-4 hover:underline"
                  >
                    {u.status === "active" ? "Suspendre" : "Réactiver"}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Supprimer ${u.full_name} ?`)) del.mutate(u.id);
                    }}
                    className="text-[12px] text-terracotta underline-offset-4 hover:underline"
                  >
                    Supprimer
                  </button>
                </div>
              )}
            </motion.li>
          ))}
        </motion.ul>

        {data?.users.length === 0 && (
          <p className="text-ink-3 text-center py-8 text-[14px]">Aucun utilisateur trouvé.</p>
        )}
      </section>

      <AnimatePresence>
        {creating && (
          <CreateUserSheet
            onClose={() => setCreating(false)}
            onSubmit={async (payload) => {
              const res = await create.mutateAsync(payload);
              setCreating(false);
              if (res.generated_password) {
                alert(`Compte créé.\nMot de passe : ${res.generated_password}`);
              }
            }}
            submitting={create.isPending}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

function CreateUserSheet({
  onClose,
  onSubmit,
  submitting,
}: {
  onClose: () => void;
  onSubmit: (payload: any) => void;
  submitting: boolean;
}) {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    role: "client" as Role,
    password: "",
  });
  const upd = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 py-8"
      style={{ background: "rgba(10,10,10,0.55)" }}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={spring}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-paper rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-xl)] p-6"
      >
        <p className="text-[11px] uppercase tracking-[0.22em] font-mono text-muted">Nouveau compte</p>
        <h2 className="font-display text-2xl tracking-tighter font-medium mt-2 leading-none">
          Inviter un utilisateur
        </h2>

        <div className="grid grid-cols-3 gap-1 p-1 rounded-full border hairline bg-paper-2 mt-6">
          {(["client", "merchant", "admin"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => upd("role", r)}
              className={`relative h-9 rounded-full text-[12px] uppercase tracking-[0.18em] font-mono transition-colors ${form.role === r ? "text-paper" : "text-ink-3"}`}
            >
              {form.role === r && (
                <motion.span
                  layoutId="create-user-role-pill"
                  className="absolute inset-0 bg-ink rounded-full"
                  transition={spring}
                />
              )}
              <span className="relative">{r}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-4 mt-5">
          <Field label="Nom complet" value={form.full_name} onChange={(v) => upd("full_name", v)} />
          <Field label="Email" value={form.email} onChange={(v) => upd("email", v)} type="email" />
          <Field
            label="Mot de passe"
            value={form.password}
            onChange={(v) => upd("password", v)}
            type="password"
            hint="Laissez vide pour générer automatiquement"
          />
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="secondary" full onClick={onClose}>Annuler</Button>
          <Button
            full
            disabled={submitting || !form.full_name || !form.email}
            onClick={() =>
              onSubmit({
                ...form,
                password: form.password || undefined,
              })
            }
          >
            {submitting ? "…" : "Créer"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-[0.18em] font-mono text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 px-4 rounded-[var(--radius-md)] bg-paper border hairline focus:border-ink focus:outline-none text-[14px]"
      />
      {hint && <span className="text-[11px] text-muted leading-snug">{hint}</span>}
    </label>
  );
}
