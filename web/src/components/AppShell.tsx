import { motion } from "motion/react";
import { type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { initials } from "../lib/format";
import { spring } from "../lib/motion";

type Props = {
  children: ReactNode;
  showNav?: boolean;
};

const clientTabs = [
  { to: "/", label: "Cartes", icon: CardsIcon },
  { to: "/scan", label: "Scanner", icon: ScanIcon },
  { to: "/rewards", label: "Récompenses", icon: RewardIcon },
  { to: "/profile", label: "Profil", icon: ProfileIcon },
];

const merchantTabs = [
  { to: "/merchant", label: "Bord", icon: DashboardIcon },
  { to: "/merchant/scan", label: "Scan", icon: ScanIcon },
  { to: "/merchant/customers", label: "Clients", icon: ProfileIcon },
  { to: "/merchant/history", label: "Histo.", icon: ActivityIcon },
  { to: "/profile", label: "Profil", icon: ProfileIcon },
];

const adminTabs = [
  { to: "/admin", label: "Bord", icon: DashboardIcon },
  { to: "/admin/merchants", label: "Restos", icon: MerchantIcon },
  { to: "/admin/users", label: "Users", icon: ProfileIcon },
  { to: "/admin/activity", label: "Activité", icon: ActivityIcon },
  { to: "/profile", label: "Profil", icon: ProfileIcon },
];

// Full-label navigation for the desktop sidebar (merchant + admin).
const merchantNav = [
  { to: "/merchant", label: "Tableau de bord", icon: DashboardIcon },
  { to: "/merchant/scan", label: "Scan QR", icon: ScanIcon },
  { to: "/merchant/customers", label: "Clients", icon: ProfileIcon },
  { to: "/merchant/history", label: "Historique", icon: ActivityIcon },
  { to: "/merchant/config", label: "Établissement", icon: ConfigIcon },
  { to: "/merchant/nfc", label: "Badges NFC", icon: NfcIcon },
];

const adminNav = [
  { to: "/admin", label: "Tableau de bord", icon: DashboardIcon },
  { to: "/admin/merchants", label: "Restaurants", icon: MerchantIcon },
  { to: "/admin/users", label: "Utilisateurs", icon: ProfileIcon },
  { to: "/admin/activity", label: "Activité", icon: ActivityIcon },
];

export const AppShell = ({ children, showNav = true }: Props) => {
  const { user, logout } = useAuth();
  const tabs =
    user?.role === "admin"
      ? adminTabs
      : user?.role === "merchant"
        ? merchantTabs
        : clientTabs;
  const sidebar = user?.role === "merchant" || user?.role === "admin";
  const nav = user?.role === "admin" ? adminNav : merchantNav;

  return (
    <div className="min-h-dvh paper-grain">
      {showNav && sidebar && user && <Sidebar nav={nav} userName={user.full_name} role={user.role} logout={logout} />}
      <main className={`pb-24 ${sidebar ? "lg:pb-12 lg:pl-64" : ""}`}>{children}</main>
      {showNav && user && <BottomNav tabs={tabs} hideOnDesktop={sidebar} />}
    </div>
  );
};

type NavItem = { to: string; label: string; icon: () => JSX.Element };

const Sidebar = ({
  nav,
  userName,
  role,
  logout,
}: {
  nav: NavItem[];
  userName: string;
  role: string;
  logout: () => void;
}) => {
  const { pathname } = useLocation();
  const isActive = (to: string) =>
    to === "/merchant" || to === "/admin" ? pathname === to : pathname.startsWith(to);
  return (
    <aside className="hidden lg:flex lg:flex-col fixed inset-y-0 left-0 w-64 bg-ink text-paper z-40 px-4 py-6">
      <Link to={nav[0].to} className="flex items-center gap-2.5 px-2 mb-6">
        <span className="h-8 w-8 rounded-lg bg-paper text-ink flex items-center justify-center font-display font-bold text-lg">
          T
        </span>
        <span className="font-display text-lg tracking-tight font-medium">Taprivo</span>
      </Link>

      <div className="flex items-center gap-3 rounded-[var(--radius-md)] bg-paper/10 px-3 py-3 mb-6">
        <span className="h-9 w-9 rounded-full bg-paper text-ink flex items-center justify-center text-[13px] font-display font-medium shrink-0">
          {initials(userName)}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-medium truncate">{userName}</p>
          <p className="text-[11px] text-paper/60">{role === "admin" ? "Administrateur" : "Commerçant"}</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-[14px] transition-colors ${
                active ? "bg-paper/15 text-paper font-medium" : "text-paper/70 hover:bg-paper/8 hover:text-paper"
              }`}
            >
              <Icon />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1 pt-4 border-t border-paper/10">
        <Link
          to="/profile"
          className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-[14px] text-paper/70 hover:bg-paper/8 hover:text-paper transition-colors"
        >
          <HelpIcon />
          Aide & support
        </Link>
        <button
          onClick={logout}
          className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-[14px] text-paper/70 hover:bg-paper/8 hover:text-paper transition-colors text-left"
        >
          <LogoutIcon />
          Déconnexion
        </button>
      </div>
    </aside>
  );
};

type Tab = { to: string; label: string; icon: () => JSX.Element };


const BottomNav = ({ tabs, hideOnDesktop }: { tabs: Tab[]; hideOnDesktop?: boolean }) => {
  const { pathname } = useLocation();
  return (
    <nav
      className={`fixed bottom-0 inset-x-0 z-40 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 px-4 ${hideOnDesktop ? "lg:hidden" : ""}`}
      style={{
        background:
          "linear-gradient(180deg, rgba(251,251,248,0) 0%, rgba(251,251,248,0.95) 30%, rgba(251,251,248,1) 100%)",
      }}
    >
      <ul className="mx-auto max-w-md flex items-center justify-between gap-1 bg-paper border hairline rounded-full px-2 py-2 shadow-[0_4px_24px_-12px_rgba(10,10,10,0.18)]">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active =
            t.to === "/" ? pathname === "/" : pathname.startsWith(t.to);
          return (
            <li key={t.to} className="flex-1">
              <Link
                to={t.to}
                className="relative flex items-center justify-center gap-1.5 h-10 rounded-full text-[12px] font-medium tracking-tight transition-colors"
              >
                {active && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-ink rounded-full"
                    transition={spring}
                  />
                )}
                <span className={`relative z-10 flex items-center gap-1.5 ${active ? "text-paper" : "text-ink-3"}`}>
                  <Icon />
                  <span className="hidden sm:inline">{t.label}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

function CardsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 11h18" />
    </svg>
  );
}
function ScanIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M7 12h10" />
    </svg>
  );
}
function RewardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="13" rx="1.5" />
      <path d="M3 12h18" />
      <path d="M12 8v13" />
      <path d="M8 8a3 3 0 0 1 4-3 3 3 0 0 1 4 3" />
    </svg>
  );
}
function ProfileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    </svg>
  );
}
function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}
function ConfigIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33 1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
function NfcIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 18 0" />
      <path d="M6 12a6 6 0 0 1 12 0" />
      <path d="M9 12a3 3 0 0 1 6 0" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </svg>
  );
}
function MerchantIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h18l-1.5 11a2 2 0 0 1-2 1.7H6.5a2 2 0 0 1-2-1.7L3 8z" />
      <path d="M8 8V6a4 4 0 0 1 8 0v2" />
    </svg>
  );
}
function ActivityIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </svg>
  );
}
function HelpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}
