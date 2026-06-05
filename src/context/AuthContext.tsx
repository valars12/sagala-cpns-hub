import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "@/lib/api-client";
import { storage } from "@/lib/storage";
import type { AuthResponse, User } from "@/types";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticating: boolean;
  login: (payload: {
    username: string;
    password: string;
    forceLogin?: boolean;
  }) => Promise<User>;
  register: (payload: {
    username: string;
    password: string;
  }) => Promise<{ user: User; requiresValidation: boolean; message?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const invalidBackendMessage =
  "Backend belum merespons format yang benar. Periksa VITE_API_URL dan status backend.";
const SESSION_SYNC_INTERVAL_MS = 15_000;

const hasValidUserIdentity = (user: Partial<User> | undefined): user is User =>
  Boolean(user && typeof user.id === "string" && user.id.trim());

const parseAuthResponse = (payload: unknown): AuthResponse => {
  if (!payload || typeof payload !== "object") {
    throw new Error(invalidBackendMessage);
  }

  const parsed = payload as Partial<AuthResponse>;
  if (typeof parsed.token !== "string" || !parsed.token.trim()) {
    throw new Error(invalidBackendMessage);
  }

  if (!hasValidUserIdentity(parsed.user as Partial<User> | undefined)) {
    throw new Error(invalidBackendMessage);
  }

  return parsed as AuthResponse;
};

const parseProfileResponse = (payload: unknown): User => {
  if (!payload || typeof payload !== "object") {
    throw new Error(invalidBackendMessage);
  }

  const parsed = payload as { user?: Partial<User> };
  if (!hasValidUserIdentity(parsed.user)) {
    throw new Error(invalidBackendMessage);
  }

  return parsed.user;
};

const parseUserFromUnknown = (payload: unknown): User => {
  if (!payload || typeof payload !== "object") {
    throw new Error(invalidBackendMessage);
  }

  const parsedUser = payload as Partial<User>;
  if (!hasValidUserIdentity(parsedUser)) {
    throw new Error(invalidBackendMessage);
  }

  return parsedUser;
};

const handleAuthSuccess = (payload: unknown) => {
  const auth = parseAuthResponse(payload);
  storage.set(auth.token ?? "", auth.user);
  return auth;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(storage.getUser());
  const [token, setToken] = useState<string | null>(storage.getToken());
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const { data } = await api.get<unknown>("/api/auth/profile");
        const profileUser = parseProfileResponse(data);
        storage.set(token, profileUser);
        setUser(profileUser);
      } catch (error) {
        storage.clear();
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    void initialize();
  }, [token]);

  useEffect(() => {
    const handleForcedLogout = () => {
      storage.clear();
      setUser(null);
      setToken(null);
    };

    window.addEventListener("sagala-bimbel:logout", handleForcedLogout);
    return () => {
      window.removeEventListener("sagala-bimbel:logout", handleForcedLogout);
    };
  }, []);

  useEffect(() => {
    if (!token) return;

    const intervalId = window.setInterval(async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const { data } = await api.get<unknown>("/api/auth/profile");
        const profileUser = parseProfileResponse(data);
        const currentToken = storage.getToken();
        if (!currentToken) return;
        storage.set(currentToken, profileUser);
        setUser(profileUser);
      } catch (_error) {
        // Auto logout is handled by the API interceptor when the backend returns 401.
      }
    }, SESSION_SYNC_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [token]);

  const login: AuthContextValue["login"] = useCallback(async ({
    username,
    password,
    forceLogin
  }) => {
    setIsAuthenticating(true);
    try {
      const { data } = await api.post<unknown>("/api/auth/login", {
        username,
        password,
        forceLogin: Boolean(forceLogin)
      });
      const auth = handleAuthSuccess(data);
      setToken(auth.token ?? null);
      setUser(auth.user);
      return auth.user;
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const register: AuthContextValue["register"] = useCallback(async ({
    username,
    password
  }) => {
    setIsAuthenticating(true);
    try {
      const { data } = await api.post<unknown>("/api/auth/register", {
        username,
        password
      });
      if (data && typeof data === "object" && "token" in data) {
        const auth = handleAuthSuccess(data);
        setToken(auth.token ?? null);
        setUser(auth.user);
        return { user: auth.user, requiresValidation: false };
      }

      const parsed = data as {
        user?: unknown;
        requiresValidation?: unknown;
        message?: unknown;
      };

      if (parsed?.requiresValidation === true && parsed.user) {
        const pendingUser = parseUserFromUnknown(parsed.user);
        return {
          user: pendingUser,
          requiresValidation: true,
          message:
            typeof parsed.message === "string" ? parsed.message : undefined
        };
      }

      throw new Error(invalidBackendMessage);
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const logout: AuthContextValue["logout"] = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } catch (error) {
      // Ignore logout network errors so users can always clear their local session.
    } finally {
      storage.clear();
      setUser(null);
      setToken(null);
    }
  }, []);

  const refreshProfile: AuthContextValue["refreshProfile"] = useCallback(async () => {
    const currentToken = storage.getToken();
    if (!currentToken) {
      return null;
    }
    try {
      const { data } = await api.get<unknown>("/api/auth/profile");
      const profileUser = parseProfileResponse(data);
      if (storage.getToken()) {
        storage.set(currentToken, profileUser);
      }
      setUser(profileUser);
      return profileUser;
    } catch (error) {
      storage.clear();
      setUser(null);
      setToken(null);
      return null;
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticating,
      login,
      register,
      logout,
      refreshProfile
    }),
    [user, token, isLoading, isAuthenticating, login, register, logout, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
