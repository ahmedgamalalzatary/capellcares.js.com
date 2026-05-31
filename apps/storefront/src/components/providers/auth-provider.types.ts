import type { ReactNode } from "react";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  signup: (name: string, email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

export interface AuthProviderProps {
  children: ReactNode;
}
