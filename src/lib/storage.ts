import type { User } from "@/types";

const TOKEN_KEY = "sagala_bimbel_token";
const USER_KEY = "sagala_bimbel_user";
const DEVICE_ID_KEY = "sagala_bimbel_device_id";

type StorageDriver = Pick<Storage, "setItem" | "getItem" | "removeItem">;

const createMemoryStorage = (): StorageDriver => {
  const memory = new Map<string, string>();
  return {
    setItem: (key, value) => {
      memory.set(key, value);
    },
    getItem: (key) => memory.get(key) ?? null,
    removeItem: (key) => {
      memory.delete(key);
    }
  };
};

const canUseStorage = (candidate: Storage) => {
  try {
    const probeKey = "__sagala_bimbel_storage_probe__";
    candidate.setItem(probeKey, "1");
    candidate.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
};

const resolveStorageDriver = (): StorageDriver => {
  if (typeof window === "undefined") {
    return createMemoryStorage();
  }

  if (canUseStorage(window.localStorage)) {
    return window.localStorage;
  }

  if (canUseStorage(window.sessionStorage)) {
    return window.sessionStorage;
  }

  return createMemoryStorage();
};

const storageDriver = resolveStorageDriver();

const generateDeviceId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const resolveBrowserName = (userAgent: string) => {
  if (/edg/i.test(userAgent)) return "Edge";
  if (/opr|opera/i.test(userAgent)) return "Opera";
  if (/chrome|crios/i.test(userAgent)) return "Chrome";
  if (/safari/i.test(userAgent) && !/chrome|crios|android/i.test(userAgent)) {
    return "Safari";
  }
  if (/firefox|fxios/i.test(userAgent)) return "Firefox";
  return "Browser";
};

const sanitizeHeaderSafeText = (value: string) => {
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

export const storage = {
  set(token: string, user: User) {
    storageDriver.setItem(TOKEN_KEY, token);
    storageDriver.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    storageDriver.removeItem(TOKEN_KEY);
    storageDriver.removeItem(USER_KEY);
  },
  getToken() {
    return storageDriver.getItem(TOKEN_KEY);
  },
  getUser(): User | null {
    const raw = storageDriver.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch (error) {
      console.warn("Failed to parse stored user", error);
      return null;
    }
  },
  getDeviceId() {
    const existing = storageDriver.getItem(DEVICE_ID_KEY);
    if (existing && existing.trim()) return existing;

    const generated = generateDeviceId();
    storageDriver.setItem(DEVICE_ID_KEY, generated);
    return generated;
  },
  getDeviceLabel() {
    if (typeof navigator === "undefined") return "Unknown Device";

    const browser = resolveBrowserName(navigator.userAgent || "");
    const platformFromUAData = (
      navigator as Navigator & { userAgentData?: { platform?: string } }
    ).userAgentData?.platform;
    const platform = platformFromUAData || navigator.platform || "Unknown Platform";

    const rawLabel = `${browser} - ${platform}`;
    const sanitized = sanitizeHeaderSafeText(rawLabel).slice(0, 180);
    return sanitized || "Browser - Unknown Platform";
  }
};
