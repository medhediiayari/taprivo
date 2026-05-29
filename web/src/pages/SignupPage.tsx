import { motion } from "motion/react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { pageVariants } from "../lib/motion";

export const SignupPage = () => {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "client" as "client" | "merchant",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const upd = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signup(form);
      nav("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "erreur");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="min-h-dvh flex flex-col paper-grain"
    >
      <header className="px-6 pt-10 flex items-center justify-between">
        <motion.div layoutId="brand-mark" className="font-display text-xl font-medium tracking-tighter">
          Taprivo
        </motion.div>
        <Link to="/login" className="text-[13px] text-ink-3 underline-offset-4 hover:underline">
          Connexion
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-4xl tracking-tighter leading-[1.05] font-medium">
            Nouveau compte.
          </h1>
          <p className="text-ink-3 text-[15px] leading-relaxed mt-2">
            En quelques secondes, commencez à cumuler.
          </p>

          <form onSubmit={onSubmit} className="flex flex-col gap-4 mt-8">
            <div className="grid grid-cols-2 gap-2 p-1 rounded-full border hairline bg-paper-2">
              {(["client", "merchant"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => upd("role")(r)}
                  className={`relative h-9 rounded-full text-[12px] uppercase tracking-[0.18em] font-mono transition-colors ${
                    form.role === r ? "text-paper" : "text-ink-3"
                  }`}
                >
                  {form.role === r && (
                    <motion.span
                      layoutId="role-pill"
                      className="absolute inset-0 bg-ink rounded-full"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className="relative">{r === "client" ? "Client" : "Restaurant"}</span>
                </button>
              ))}
            </div>

            <Field label="Nom complet" value={form.full_name} onChange={upd("full_name")} />
            <Field label="Email" value={form.email} onChange={upd("email")} type="email" />
            <Field label="Mot de passe" value={form.password} onChange={upd("password")} type="password" />

            {error && <p className="text-[13px] text-terracotta">{error}</p>}

            <Button type="submit" size="lg" full disabled={submitting}>
              {submitting ? "Création…" : "Créer le compte"}
            </Button>
          </form>
        </div>
      </main>
    </motion.div>
  );
};

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-[0.18em] font-mono text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 px-4 rounded-[var(--radius-md)] bg-paper border hairline focus:border-ink focus:outline-none transition-colors text-[15px]"
        required
      />
    </label>
  );
}
