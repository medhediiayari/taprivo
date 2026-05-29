import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api, clearSession, getAuthToken, getRefreshToken, setOnAuthFailure, setSession } from "./api";

export type User = {
  id: string;
  email: string;
  full_name: string;
  role: "client" | "merchant" | "admin";
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: {
    full_name: string;
    email: string;
    password: string;
    role?: "client" | "merchant" | "admin";
  }) => Promise<void>;
  logout: () => void;
};

const Ctx = createContext<AuthCtx | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // When a refresh ultimately fails, the api layer clears the session and
  // calls this so RequireAuth redirects to /login.
  useEffect(() => {
    setOnAuthFailure(() => setUser(null));
    return () => setOnAuthFailure(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api<User>("/auth/me")
      .then((u) => !cancelled && setUser(u))
      .catch(() => {
        clearSession();
        if (!cancelled) setUser(null);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{ token: string; refresh_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setSession(res);
    setUser(res.user);
  }, []);

  const signup = useCallback(
    async (input: {
      full_name: string;
      email: string;
      password: string;
      role?: "client" | "merchant" | "admin";
    }) => {
      const res = await api<{ token: string; refresh_token: string; user: User }>("/auth/signup", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setSession(res);
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(() => {
    const rt = getRefreshToken();
    // Best-effort server-side revocation; clear locally regardless.
    if (rt) {
      api("/auth/logout", { method: "POST", body: JSON.stringify({ refresh_token: rt }) }).catch(
        () => {},
      );
    }
    clearSession();
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, loading, login, signup, logout }}>{children}</Ctx.Provider>;
};

export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
};
