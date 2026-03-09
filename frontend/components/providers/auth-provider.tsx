"use client";

import {authApi} from "@/lib/api";
import type {AuthPayload, UserProfile} from "@/lib/types";
import {AxiosError} from "axios";
import {createContext, useCallback, useContext, useEffect, useMemo, useState} from "react";

interface AuthContextValue {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  setAuth: (payload: AuthPayload) => void;
  refresh: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function persist(payload: AuthPayload) {
  localStorage.setItem("token", payload.token);
  localStorage.setItem("auth_user", JSON.stringify(payload.user));
}

export function AuthProvider({children}: {children: React.ReactNode}) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("auth_user");
    setUser(null);
    setToken(null);
  }, []);

  const setAuth = useCallback((payload: AuthPayload) => {
    persist(payload);
    setUser(payload.user);
    setToken(payload.token);
  }, []);

  const refresh = useCallback(async () => {
    const storedToken = localStorage.getItem("token");
    if (!storedToken) {
      setLoading(false);
      return;
    }

    try {
      setToken(storedToken);
      const {data} = await authApi.me();
      localStorage.setItem("auth_user", JSON.stringify(data));
      setUser(data);
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 401) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    const storedUser = localStorage.getItem("auth_user");
    const storedToken = localStorage.getItem("token");
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
    }
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onUnauthorized = () => logout();
    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, [logout]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    token,
    loading,
    setAuth,
    refresh,
    logout
  }), [user, token, loading, setAuth, refresh, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
