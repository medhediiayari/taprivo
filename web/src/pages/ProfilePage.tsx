import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { useAuth } from "../lib/auth";
import { initials } from "../lib/format";
import { pageVariants } from "../lib/motion";

export const ProfilePage = () => {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  if (!user) return null;
  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" exit="exit">
      <header className="px-6 pt-12">
        <h1 className="font-display text-4xl tracking-tighter font-medium leading-none">
          Profil.
        </h1>
      </header>

      <section className="px-6 mt-10">
        <div className="flex items-center gap-5 pb-8 border-b hairline">
          <div className="h-16 w-16 rounded-full bg-ink text-paper flex items-center justify-center font-display text-xl font-medium">
            {initials(user.full_name)}
          </div>
          <div>
            <p className="font-display text-xl tracking-tight font-medium leading-none">
              {user.full_name}
            </p>
            <p className="text-[13px] text-ink-3 mt-1.5">{user.email}</p>
            <p className="text-[10px] uppercase tracking-[0.22em] font-mono text-muted mt-2">
              {user.role === "merchant" ? "Restaurant" : "Client"}
            </p>
          </div>
        </div>

        <ul className="divide-y hairline mt-2">
          <Row label="Notifications" value="Activées" />
          <Row label="Devices liés" value="1 — iPhone" />
          <Row label="Langue" value="Français" />
          <Row label="Confidentialité" value="Géoloc. partagée au scan" />
        </ul>

        <div className="mt-10">
          <Button
            variant="secondary"
            full
            onClick={() => {
              logout();
              nav("/login", { replace: true });
            }}
          >
            Se déconnecter
          </Button>
        </div>
      </section>
    </motion.div>
  );
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <li className="py-4 flex items-center justify-between text-[14px]">
      <span className="text-ink-3">{label}</span>
      <span className="text-ink">{value}</span>
    </li>
  );
}
