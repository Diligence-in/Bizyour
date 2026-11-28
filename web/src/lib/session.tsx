import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, get, getToken, onAuthLost, post, setToken } from './api';
import type { Me } from './types';
import { askToPick } from './mode';

// Session = who is logged in + which business + what they may see.
// Permission helpers mirror the server guards exactly (server.js
// requireOwner / requireStockAccess / requireBillingAccess). The UI hides
// what a role cannot use; the server still enforces it.

interface SessionCtx {
  me: Me | null;
  loading: boolean;
  /** Effective workspace plan from /api/me ('free' | 'billing' | 'everything' | ''). '' = not loaded yet — treat as full access, the server enforces. */
  plan: string;
  login: (identifier: string, password: string) => Promise<void>;
  /** Start a session from a token the server already issued (e.g. after email verification). */
  adopt: (r: { token: string } & Me) => void;
  setBusiness: (b: Me['business']) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  can: { finance: boolean; stock: boolean; billing: boolean; owner: boolean; mart: boolean };
}
const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(!!getToken());
  const qc = useQueryClient();

  const refresh = useCallback(async () => {
    if (!getToken()) { setMe(null); setLoading(false); return; }
    try {
      const m = await get<Me>('/api/me');
      setMe(m);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) { setToken(null); setMe(null); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => onAuthLost(() => { setToken(null); setMe(null); qc.clear(); }), [qc]);

  const login = useCallback(async (identifier: string, password: string) => {
    const r = await post<{ token: string } & Me>('/api/auth/login', { identifier, password });
    setToken(r.token);
    askToPick();
    setMe({ user: r.user, business: r.business });
    // The login response has no effective_plan — pull /api/me so the
    // plan gates (nav, locks) know the tier right away, not after reload.
    await refresh();
  }, [refresh]);

  const adopt = useCallback((r: { token: string } & Me) => {
    setToken(r.token);
    askToPick();
    setMe({ user: r.user, business: r.business });
    void refresh();
  }, [refresh]);
  const setBusiness = useCallback((b: Me['business']) => setMe((m) => (m ? { ...m, business: b } : m)), []);

  const logout = useCallback(async () => {
    try { await post('/api/auth/logout'); } catch { /* token may already be gone */ }
    setToken(null); qc.clear();
    // Logged out → the homepage (founder's call: never park a logged-out
    // visitor on the login page). A clean page load, so no screen from the
    // old session can flash or redirect on the way out.
    window.location.replace('/');
  }, [qc]);

  const can = useMemo(() => {
    const u = me?.user;
    const owner = u?.role === 'owner';
    const stock = owner || u?.access === 'all' || u?.access === 'stock';
    const billing = owner || u?.access === 'all' || u?.access === 'billing';
    return { owner, finance: owner, stock, billing, mart: owner || stock };
  }, [me]);

  const v = useMemo(() => ({ me, loading, plan: me?.effective_plan || '', login, adopt, setBusiness, logout, refresh, can }), [me, loading, login, adopt, setBusiness, logout, refresh, can]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function useSession() {
  const c = useContext(Ctx);
  if (!c) throw new Error('SessionProvider missing');
  return c;
}

/** The shop's effective plan ('free' | 'billing' | 'everything' | ''). */
export function usePlan(): string {
  return useSession().plan;
}
