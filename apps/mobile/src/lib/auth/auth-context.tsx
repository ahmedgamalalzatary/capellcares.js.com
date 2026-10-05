import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authJSON, configureAuthSessionAdapter } from "@/lib/api/http";
import { AUTH_STORAGE_KEY } from "@/constants/storage";
import {
  authSessionAdapter,
  bootstrapSession,
  clearSession,
  getRefreshToken,
  refreshAccessToken,
  setAuthenticatedSession,
  subscribeAccessToken,
  subscribeCleared
} from "./token-store";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  hydrated: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  signup: (name: string, email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function parseUser(raw: string | null): AuthUser | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (typeof parsed?.id === "number" && typeof parsed?.name === "string" && typeof parsed?.email === "string") {
      return { id: parsed.id, name: parsed.name, email: parsed.email };
    }
  } catch {
    // A damaged profile entry is treated as signed out.
  }
  return null;
}

async function persistUser(user: AuthUser | null): Promise<void> {
  try {
    if (user) await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    else await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // The in-memory profile remains authoritative for this run.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const activeRef = useRef(true);

  useEffect(() => {
    // Install the request-time session adapter so the API client can refresh a 401 once and bind retries to this session.
    configureAuthSessionAdapter(authSessionAdapter);
    const unsubscribeToken = subscribeAccessToken(setAccessToken);
    const unsubscribeCleared = subscribeCleared(() => {
      setUser(null);
      void persistUser(null);
    });
    return () => {
      configureAuthSessionAdapter(null);
      unsubscribeToken();
      unsubscribeCleared();
    };
  }, []);

  // A cold start whose refresh failed transiently restores the profile with no access token.
  // Retry on foreground so the session becomes usable again without a manual sign-in.
  useEffect(() => {
    if (!user || accessToken) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshAccessToken();
    });
    return () => subscription.remove();
  }, [user, accessToken]);

  useEffect(() => {
    activeRef.current = true;
    void (async () => {
      let storedUser: AuthUser | null = null;
      try {
        storedUser = parseUser(await AsyncStorage.getItem(AUTH_STORAGE_KEY));
      } catch {
        storedUser = null;
      }
      if (!activeRef.current) return;

      // Only a stored profile WITH a recoverable session signs the user in. A stale profile
      // and a stray refresh token are each insufficient; a stale profile alone is cleared.
      if (storedUser) {
        const restored = await bootstrapSession();
        if (!activeRef.current) return;
        if (restored) setUser(storedUser);
        else await persistUser(null);
      } else {
        // Without a stored profile a refresh token is unusable; drop it so it cannot linger in SecureStore.
        await clearSession();
      }
      if (activeRef.current) setHydrated(true);
    })();
    return () => {
      activeRef.current = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const result = await authJSON<{ accessToken?: string; refreshToken?: string; user?: AuthUser }>("login", {
      email,
      password
    });
    if (!result?.accessToken || !result.user) throw new Error("Login failed");
    // Persist the refresh token before the access token is published.
    await setAuthenticatedSession({ accessToken: result.accessToken, refreshToken: result.refreshToken ?? null });
    setUser(result.user);
    await persistUser(result.user);
    return result.user;
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string): Promise<AuthUser> => {
    await authJSON("signup", { name, email, password });
    return login(email, password);
  }, [login]);

  const logout = useCallback(async () => {
    const token = getRefreshToken();
    setUser(null);
    await clearSession();
    await persistUser(null);
    try {
      await authJSON("logout", undefined, token ? { refreshToken: token } : {});
    } catch {
      // Offline local clearing is immediate; server revocation requires connectivity (D5).
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, accessToken, hydrated, login, signup, logout }),
    [user, accessToken, hydrated, login, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
