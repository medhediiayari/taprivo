import { AnimatePresence } from "motion/react";
import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { useAuth } from "./lib/auth";
import { CardDetailPage } from "./pages/CardDetailPage";
import { CardsPage } from "./pages/CardsPage";
import { LoginPage } from "./pages/LoginPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RewardsPage } from "./pages/RewardsPage";
import { ScanPage } from "./pages/ScanPage";
import { SignupPage } from "./pages/SignupPage";
import { ConfigPage } from "./pages/merchant/ConfigPage";
import { DashboardPage } from "./pages/merchant/DashboardPage";
import { NfcProvisioningPage } from "./pages/merchant/NfcProvisioningPage";
import { AdminActivityPage } from "./pages/admin/AdminActivityPage";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { AdminMerchantsPage } from "./pages/admin/AdminMerchantsPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";

const RequireAuth = ({
  children,
  role,
}: {
  children: ReactNode;
  role?: "client" | "merchant" | "admin";
}) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center text-muted text-[12px] font-mono uppercase tracking-wider">
        Chargement…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    const home = user.role === "admin" ? "/admin" : user.role === "merchant" ? "/merchant" : "/";
    return <Navigate to={home} replace />;
  }
  return <>{children}</>;
};

export default function App() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        <Route
          path="/"
          element={
            <RequireAuth role="client">
              <AppShell>
                <CardsPage />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/card/:id"
          element={
            <RequireAuth role="client">
              <AppShell>
                <CardDetailPage />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/scan"
          element={
            <RequireAuth role="client">
              <AppShell>
                <ScanPage />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/rewards"
          element={
            <RequireAuth role="client">
              <AppShell>
                <RewardsPage />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <AppShell>
                <ProfilePage />
              </AppShell>
            </RequireAuth>
          }
        />

        <Route
          path="/merchant"
          element={
            <RequireAuth role="merchant">
              <AppShell>
                <DashboardPage />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/merchant/config"
          element={
            <RequireAuth role="merchant">
              <AppShell>
                <ConfigPage />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/merchant/nfc"
          element={
            <RequireAuth role="merchant">
              <AppShell>
                <NfcProvisioningPage />
              </AppShell>
            </RequireAuth>
          }
        />

        <Route
          path="/admin"
          element={
            <RequireAuth role="admin">
              <AppShell>
                <AdminDashboardPage />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/merchants"
          element={
            <RequireAuth role="admin">
              <AppShell>
                <AdminMerchantsPage />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireAuth role="admin">
              <AppShell>
                <AdminUsersPage />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/activity"
          element={
            <RequireAuth role="admin">
              <AppShell>
                <AdminActivityPage />
              </AppShell>
            </RequireAuth>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}
