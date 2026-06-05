import axios, { AxiosHeaders } from "axios";
import { storage } from "@/lib/storage";

const rawBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const normalizedBaseUrl = rawBaseUrl.replace(/\/$/, "");
const baseUrl = normalizedBaseUrl.endsWith("/api")
  ? normalizedBaseUrl.slice(0, -4)
  : normalizedBaseUrl;

const api = axios.create({
  baseURL: baseUrl,
  headers: {
    "Content-Type": "application/json"
  }
});

const sanitizeHeaderValue = (value: string) => {
  try {
    return value
      .normalize("NFKD")
      .replace(/[^\x20-\x7E]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return value
      .replace(/[^\x20-\x7E]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
};

api.interceptors.request.use((config) => {
  const token = storage.getToken();
  const deviceId = storage.getDeviceId();
  const deviceLabel = sanitizeHeaderValue(storage.getDeviceLabel()).slice(0, 180);
  if (token) {
    const headers =
      config.headers instanceof AxiosHeaders
        ? config.headers
        : new AxiosHeaders(config.headers);
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("X-Device-Id", deviceId);
    headers.set("X-Device-Label", deviceLabel);
    config.headers = headers;
    return config;
  }

  const headers =
    config.headers instanceof AxiosHeaders
      ? config.headers
      : new AxiosHeaders(config.headers);
  headers.set("X-Device-Id", deviceId);
  headers.set("X-Device-Label", deviceLabel);
  config.headers = headers;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      storage.clear();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("sagala-bimbel:logout"));
      }
    }
    return Promise.reject(error);
  }
);

export default api;
