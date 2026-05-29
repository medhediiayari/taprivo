const API_URL = import.meta.env.VITE_API_URL ?? "/api";

const ACCESS_KEY = "taprivo_token";
const REFRESH_KEY = "taprivo_refresh";
const DEVICE_KEY = "taprivo_device";

// --- token storage (in-memory cache backed by localStorage) ---

let authToken: string | null = null;
let refreshToken: string | null = null;
let deviceId: string | null = null;

export const setAuthToken = (t: string | null) => {
  authToken = t;
  if (t) localStorage.setItem(ACCESS_KEY, t);
  else localStorage.removeItem(ACCESS_KEY);
};

export const getAuthToken = () => {
  if (authToken) return authToken;
  authToken = localStorage.getItem(ACCESS_KEY);
  return authToken;
};

export const setRefreshToken = (t: string | null) => {
  refreshToken = t;
  if (t) localStorage.setItem(REFRESH_KEY, t);
  else localStorage.removeItem(REFRESH_KEY);
};

export const getRefreshToken = () => {
  if (refreshToken) return refreshToken;
  refreshToken = localStorage.getItem(REFRESH_KEY);
  return refreshToken;
};

// Stable per-browser identifier so the refresh token stays bound to this
// device (mirrors what the Flutter client will send as X-Device-Id).
export const getDeviceId = () => {
  if (deviceId) return deviceId;
  let stored = localStorage.getItem(DEVICE_KEY);
  if (!stored) {
    stored =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(DEVICE_KEY, stored);
  }
  deviceId = stored;
  return deviceId;
};

export const setSession = (s: { token: string; refresh_token?: string }) => {
  setAuthToken(s.token);
  if (s.refresh_token) setRefreshToken(s.refresh_token);
};

export const clearSession = () => {
  setAuthToken(null);
  setRefreshToken(null);
};

// Called when a refresh fails and the session is unrecoverable, so the app can
// drop the user back to the login screen.
let onAuthFailure: (() => void) | null = null;
export const setOnAuthFailure = (cb: (() => void) | null) => {
  onAuthFailure = cb;
};

export class ApiError extends Error {
  constructor(public status: number, public payload: unknown, message: string) {
    super(message);
  }
}

// --- refresh, single-flighted ---

// Endpoints that must never trigger a refresh-retry (would loop, or are the
// refresh mechanism itself).
const NO_REFRESH = new Set(["/auth/login", "/auth/signup", "/auth/refresh", "/auth/logout"]);

let refreshPromise: Promise<boolean> | null = null;

const doRefresh = async (): Promise<boolean> => {
  const rt = getRefreshToken();
  if (!rt) return false;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Device-Id": getDeviceId() },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { token: string; refresh_token: string };
    setAuthToken(data.token);
    setRefreshToken(data.refresh_token);
    return true;
  } catch {
    return false;
  }
};

// Concurrent 401s share one in-flight refresh. Critical: the backend rotates
// refresh tokens and cascade-revokes on reuse, so parallel refreshes would
// invalidate each other and kill the whole session.
const refreshOnce = (): Promise<boolean> => {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

export const api = async <T = unknown>(
  path: string,
  options: RequestInit = {},
  // internal: set on the single automatic retry after a refresh
  _retried = false,
): Promise<T> => {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Device-Id": getDeviceId(),
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (res.status === 401 && !_retried && !NO_REFRESH.has(path) && getRefreshToken()) {
    const ok = await refreshOnce();
    if (ok) return api<T>(path, options, true);
    clearSession();
    onAuthFailure?.();
  }

  if (!res.ok) {
    throw new ApiError(res.status, data, (data && (data.error ?? data.message)) || res.statusText);
  }
  return data as T;
};
