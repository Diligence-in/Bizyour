// Thin, typed wrapper over the existing Express API. No endpoint was changed
// for the new app — it speaks exactly the same /api/* contract as the
// classic app, with the same token in localStorage ('bos_token'), so a user
// logged into one is logged into the other.

const TOKEN_KEY = 'bos_token';

// Split deploy (frontend on Vercel, API on Render): set VITE_API_BASE at
// build time. Same-origin deploy: leave it empty.
export const API_BASE = String(import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(t: string | null) {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ }
}

export class ApiError extends Error {
  status: number;
  code: string;
  data: Record<string, unknown>;
  constructor(status: number, code: string, data: Record<string, unknown>) {
    super(code);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

type Listener = (e: ApiError) => void;
const authListeners = new Set<Listener>();
/** Called when the server says the session is gone (401) — the app logs out. */
export function onAuthLost(fn: Listener) { authListeners.add(fn); return () => { authListeners.delete(fn); }; }

const setupListeners = new Set<Listener>();
/** Called when the server refuses with 403 workspace_not_setup (two-stage
    workflow: the shop setup is not done yet) — the app routes to Setup. */
export function onWorkspaceSetup(fn: Listener) { setupListeners.add(fn); return () => { setupListeners.delete(fn); }; }

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(API_BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'network_error', {});
  }
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const code = String((data as { error?: string }).error || `http_${res.status}`);
    const err = new ApiError(res.status, code, data);
    if (res.status === 401 && path !== '/api/auth/login') authListeners.forEach((l) => l(err));
    if (res.status === 403 && code === 'workspace_not_setup' && !path.startsWith('/api/workspace/')) setupListeners.forEach((l) => l(err));
    throw err;
  }
  return data as T;
}

export const get = <T,>(p: string) => api<T>('GET', p);
export const post = <T,>(p: string, b?: unknown) => api<T>('POST', p, b ?? {});
export const put = <T,>(p: string, b?: unknown) => api<T>('PUT', p, b ?? {});
export const del = <T,>(p: string) => api<T>('DELETE', p);

/** Authenticated fetch returning a Blob (bill PDF for the WhatsApp share). */
export async function fetchBlob(path: string): Promise<Blob> {
  const token = getToken();
  const res = await fetch(API_BASE + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ApiError(res.status, `http_${res.status}`, {});
  return res.blob();
}

/** Authenticated file download (CSV exports, JSON e-way bills). */
export async function download(path: string, fallbackName: string) {
  const token = getToken();
  const res = await fetch(API_BASE + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ApiError(res.status, `http_${res.status}`, {});
  const blob = await res.blob();
  const cd = res.headers.get('content-disposition') || '';
  const m = /filename="?([^";]+)"?/i.exec(cd);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = m ? m[1] : fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
