import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, getToken, setToken } from "./api";

export type User = {
  id: string;
  email: string;
  username: string;
  referral_code: string;
  referred_by?: string | null;
  balance_nkg: number;
  balance_beta: number;
  language: string;
  created_at?: string;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    username: string;
    language?: string;
    referral_code?: string;
  }) => Promise<{ seed_phrase: string }>;
  recover: (email: string, seed: string, newPass: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setLanguage: (lang: string) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const t = await getToken();
    if (!t) {
      setUser(null);
      return;
    }
    try {
      const r = await api<{ user: User }>("/auth/me");
      setUser(r.user);
    } catch {
      await setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const r = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
    await setToken(r.token);
    setUser(r.user);
  };

  const register = async (data: any) => {
    const r = await api<{ token: string; user: User; seed_phrase: string }>("/auth/register", {
      method: "POST",
      body: data,
      auth: false,
    });
    await setToken(r.token);
    setUser(r.user);
    return { seed_phrase: r.seed_phrase };
  };

  const recover = async (email: string, seed: string, newPass: string) => {
    const r = await api<{ token: string; user: User }>("/auth/recover", {
      method: "POST",
      body: { email, seed_phrase: seed, new_password: newPass },
      auth: false,
    });
    await setToken(r.token);
    setUser(r.user);
  };

  const logout = async () => {
    await setToken(null);
    setUser(null);
  };

  const setLanguage = async (lang: string) => {
    try {
      await api("/auth/language", { method: "POST", body: { language: lang } });
    } catch {}
    setUser((u) => (u ? { ...u, language: lang } : u));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, recover, logout, refresh, setLanguage }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
