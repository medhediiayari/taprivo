import { motion } from "motion/react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { Photo, picsum } from "../components/Photo";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { pageVariants, softSpring, spring } from "../lib/motion";

const HERO_PHOTO = picsum("taprivo-cafe-counter-warm-morning-tunis", 1400, 1800);

export const LoginPage = () => {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("karim@demo.com");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
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
      className="min-h-dvh flex flex-col md:flex-row bg-paper"
    >
      {/* === Photo hero — top on mobile, left on desktop === */}
      <section className="relative flex-1 md:basis-1/2 md:min-h-dvh min-h-[42dvh]">
        <Photo
          src={HERO_PHOTO}
          alt="Atmosphère café"
          aspect="aspect-auto"
          overlay="strong"
          rounded=""
          fallbackColor="var(--color-ink)"
          className="absolute inset-0 h-full"
        />

        <div className="relative h-full p-7 md:p-12 flex flex-col justify-between text-paper">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...softSpring, delay: 0.1 }}
            className="flex items-center gap-2.5"
          >
            <span
              className="h-9 w-9 rounded-full border-2 border-paper/80 flex items-center justify-center"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-terracotta)" }} />
            </span>
            <span className="font-display text-xl font-semibold tracking-tighter">
              Taprivo
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...softSpring, delay: 0.25 }}
            className="max-w-[18ch]"
          >
            <h1 className="font-display text-[48px] md:text-[72px] leading-[0.92] tracking-tighter font-semibold">
              Vos cartes,<br />
              <span style={{ color: "var(--color-soleil)" }}>tamponnées</span><br />
              comme avant.
            </h1>
            <p className="mt-6 text-paper/80 text-[14px] md:text-[15px] max-w-[34ch] leading-relaxed">
              La fidélité du quartier, en numérique. Cumulez, débloquez, savourez.
            </p>
          </motion.div>
        </div>
      </section>

      {/* === Form panel — slides up from bottom on mobile === */}
      <motion.section
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...spring, delay: 0.2 }}
        className="relative md:basis-1/2 px-7 py-10 md:py-12 md:px-14 flex flex-col justify-center paper-grain"
      >
        <div className="max-w-sm w-full mx-auto">
          <p className="text-[10px] uppercase tracking-[0.22em] font-mono text-muted">
            Bon retour
          </p>
          <h2 className="mt-2 font-display text-4xl tracking-tighter font-semibold leading-none">
            Se connecter.
          </h2>

          <form onSubmit={onSubmit} className="flex flex-col gap-4 mt-8">
            <Field label="Email" value={email} onChange={setEmail} type="email" />
            <Field label="Mot de passe" value={password} onChange={setPassword} type="password" />
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[13px] text-terracotta"
              >
                Identifiants incorrects.
              </motion.p>
            )}
            <Button type="submit" variant="terracotta" size="lg" full disabled={submitting}>
              {submitting ? "Connexion…" : "Entrer"}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t hairline flex items-center justify-between text-[13px]">
            <Link to="/signup" className="text-ink underline-offset-4 hover:underline font-medium">
              Créer un compte →
            </Link>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              demo · karim@demo.com
            </span>
          </div>
        </div>
      </motion.section>
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
      <span className="text-[10px] uppercase tracking-[0.22em] font-mono text-muted">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 px-4 rounded-[var(--radius-md)] bg-paper border hairline focus:border-ink focus:outline-none transition-colors text-[15px]"
        autoComplete={type === "password" ? "current-password" : "email"}
        required
      />
    </label>
  );
}
