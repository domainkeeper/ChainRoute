import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { ApiError, TokenResponse } from "../types/api";

const API_BASE_URL = "/api/v1";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

let accessToken: string | null = null;
let refreshToken: string | null = null;
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: string) => void;
  reject: (error: Error) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

export const setTokens = (access: string, refresh: string) => {
  accessToken = access;
  refreshToken = refresh;
  try {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
  } catch {
    // localStorage may be unavailable
  }
};

export const getAccessToken = () => accessToken;

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  try {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  } catch {
    // localStorage may be unavailable
  }
};

export const initializeAuth = () => {
  try {
    const storedAccess = localStorage.getItem("access_token");
    const storedRefresh = localStorage.getItem("refresh_token");
    if (storedAccess) {
      accessToken = storedAccess;
    }
    if (storedRefresh) {
      refreshToken = storedRefresh;
    }
  } catch {
    // localStorage may be unavailable
  }
};

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      refreshToken &&
      !originalRequest.url?.includes("/auth/")
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await api.post<TokenResponse>("/auth/refresh", {
          refresh_token: refreshToken,
        });
        const { access_token, refresh_token } = response.data;
        setTokens(access_token, refresh_token);
        processQueue(null, access_token);
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        clearTokens();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const extractErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data?.detail?.error?.message) return data.detail.error.message;
    if (data?.detail?.message) return data.detail.message;
    if (Array.isArray(data?.detail)) {
      return data.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(", ");
    }
    if (data?.message) return data.message;
    if (typeof data === "string") return data;
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unknown error occurred";
};

export const extractErrorCode = (error: unknown): string | null => {
  if (axios.isAxiosError(error) && error.response?.data) {
    const data = error.response.data;
    return data?.detail?.error?.code || null;
  }
  return null;
};