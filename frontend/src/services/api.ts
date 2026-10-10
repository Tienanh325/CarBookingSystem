import type { AuthResult } from "../types";
export const API_URL = import.meta.env.VITE_API_URL ?? "/api";
const KEY = "goride.session";
export function session(): AuthResult | null {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
}
export function saveSession(value: AuthResult | null) {
  if (value) sessionStorage.setItem(KEY, JSON.stringify(value));
  else sessionStorage.removeItem(KEY);
  window.dispatchEvent(new Event("session.changed"));
}
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
  }
}
let refreshing: Promise<AuthResult> | null = null;
export async function refreshSession() {
  if (!refreshing)
    refreshing = (async () => {
      const current = session();
      if (!current) throw new ApiRequestError("Vui lòng đăng nhập", 401);
      const res = await fetch(API_URL + "/auth/refresh-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: current.tokens.refreshToken }),
        signal: AbortSignal.timeout(12000)
      });
      const payload = await res.json();
      if (!res.ok) {
        saveSession(null);
        throw new ApiRequestError("Phiên đăng nhập đã hết hạn", 401);
      }
      saveSession(payload.data);
      return payload.data as AuthResult;
    })().finally(() => {
      refreshing = null;
    });
  return refreshing;
}
export async function apiRequest<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const current = session();
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(15000),
      headers: {
        "Content-Type": "application/json",
        ...(current ? { Authorization: "Bearer " + current.tokens.accessToken } : {}),
        ...init.headers
      }
    });
  } catch {
    throw new ApiRequestError("Không kết nối được máy chủ. Vui lòng thử lại.", 0);
  }
  if (res.status === 401 && retry && current && !path.startsWith("/auth/")) {
    await refreshSession();
    return apiRequest<T>(path, init, false);
  }
  const payload = await res
    .json()
    .catch(() => ({ error: { message: "Máy chủ trả về dữ liệu không hợp lệ" } }));
  if (!res.ok || !payload.success)
    throw new ApiRequestError(payload.error?.message ?? "Yêu cầu thất bại", res.status, payload.error?.code);
  return payload.data as T;
}
export const mutate = <T>(path: string, body: unknown = {}, method = "POST") =>
  apiRequest<T>(path, { method, body: JSON.stringify(body) });
