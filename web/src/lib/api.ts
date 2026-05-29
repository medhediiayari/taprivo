const API_URL = import.meta.env.VITE_API_URL ?? "/api";

let authToken: string | null = null;

export const setAuthToken = (t: string | null) => {
  authToken = t;
  if (t) localStorage.setItem("taprivo_token", t);
  else localStorage.removeItem("taprivo_token");
};

export const getAuthToken = () => {
  if (authToken) return authToken;
  const stored = localStorage.getItem("taprivo_token");
  if (stored) authToken = stored;
  return authToken;
};

export class ApiError extends Error {
  constructor(public status: number, public payload: unknown, message: string) {
    super(message);
  }
}

export const api = async <T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> => {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, data, (data && (data.error ?? data.message)) || res.statusText);
  }
  return data as T;
};
