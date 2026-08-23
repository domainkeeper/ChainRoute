import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { initializeAuth, setTokens, clearTokens, getAccessToken } from "@/api/client";
import { authApi } from "@/api";
import type { User, TokenResponse } from "@/types/api";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    role: User["role"];
    wallet_address?: string;
  }) => Promise<void>;
  logout: () => void;
  updateWallet: (wallet_address: string | null) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await authApi.getProfile();
      setUser(userData);
    } catch {
      setUser(null);
      clearTokens();
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initializeAuth();
    const token = getAccessToken();
    if (token) {
      refreshUser();
    } else {
      setIsLoading(false);
    }
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const { access_token, refresh_token, user: userData } = await authApi.login(email, password);
    setTokens(access_token, refresh_token);
    setUser(userData);
  };

  const register = async (data: {
    name: string;
    email: string;
    password: string;
    role: User["role"];
    wallet_address?: string;
  }) => {
    const { access_token, refresh_token, user: userData } = await authApi.register(data);
    setTokens(access_token, refresh_token);
    setUser(userData);
  };

  const logout = () => {
    clearTokens();
    setUser(null);
  };

  const updateWallet = async (wallet_address: string | null) => {
    const userData = await authApi.updateWallet(wallet_address);
    setUser(userData);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        updateWallet,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}