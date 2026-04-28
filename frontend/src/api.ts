import AsyncStorage from "@react-native-async-storage/async-storage";

const RAW_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";
export const API_BASE = RAW_BASE.replace(/\/$/, "") + "/api";

const TOKEN_KEY = "nickcoin_token";

export async function getToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string | null) {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

type Method = "GET" | "POST" | "PUT" | "DELETE";

export async function api<T = any>(
  path: string,
  options: { method?: Method; body?: any; auth?: boolean } = {}
): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (auth) {
    const t = await getToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const detail = (data && (data.detail || data.message)) || `HTTP ${res.status}`;
    const msg = Array.isArray(detail)
      ? detail.map((d: any) => d?.msg || JSON.stringify(d)).join(" ")
      : typeof detail === "string"
      ? detail
      : JSON.stringify(detail);
    throw new Error(msg);
  }
  return data as T;
}
