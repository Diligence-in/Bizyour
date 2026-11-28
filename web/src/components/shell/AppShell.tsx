import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, BookOpenText, Home, Lock, LogOut, Menu, PackageCheck, Plus, ReceiptText, Search, ShoppingCart, Store, Users } from 'lucide-react';
import { get } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useSession } from '../../lib/session';
import { initials } from '../../lib/format';
import type { Lang, Subscription } from '../../lib/types';
import { Button, Drawer, Segmented } from '../ui';
import { allowed, allowedPlan, navGroups, type Mode, type NavItem } from './nav';
import { lastPath, modeOf, rememberPath } from '../../lib/mode';
import { CommandPalette } from './CommandPalette';

export function useIsMobile() {
  const q = '(max-width: 719px)';
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}

function NavEntry({ item, badge, onNavigate }: { item: NavItem; badge?: number; onNavigate?: () => void }) {
  const content = (
    <>
      <item.icon size={18} strokeWidth={1.75} aria-hidden />
      <span className="grow ellipsis">{item.label}</span>
      {badge ? <span className="nav-count num">{badge}</span> : null}
      {item.classic && <ArrowUpRight size={14} className="nav-classic" aria-hidden />}
    </>
  );
  if (item.classic) return <a className="nav-link" href={item.to} onClick={onNavigate}>{content}</a>;
  return <NavLink to={item.to} end={item.to === '/' || item.to === '/mart'} className="nav-link" onClick={onNavigate}>{content}</NavLink>;
}

export function LangSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <Segmented<Lang> label={t('Language', 'भाषा', 'Bhasha')} value={lang} onChange={setLang}
      options={[{ value: 'en', label: 'EN' }, { value: 'hi', label: 'हिं' }, { value: 'hg', label: 'Hinglish' }]} />
  );
}

type Badges = Partial<Record<'mart-buy' | 'mart-sell' | 'mart-notifs', number>>;
/** Workspace | Business Mart — the two sides of the app, as in the original. */
export function ModeSwitch({ mode, martDot, onSwitch }: { mode: Mode; martDot?: boolean; onSwitch?: () => void }) {
  const { t } = useI18n();
  const { can } = useSession();
  const nav = useNavigate();
  const go = (m: Mode) => { onSwitch?.(); if (m !== mode) nav(lastPath(m)); };
  return (
    <div className="mode-switch" role="tablist" aria-label={t('Switch side', 'हिस्सा बदलें', 'Side badlo')}>
      {(can.billing || can.stock) && (
        <button role="tab" aria-selected={mode === 'workspace'} className={mode === 'workspace' ? 'on' : ''} onClick={() => go('workspace')} data-testid="mode-workspace">
          <BookOpenText size={16} strokeWidth={1.75} aria-hidden /> <span>Workspace</span>
        </button>
      )}
      {can.mart && (
        <button role="tab" aria-selected={mode === 'mart'} className={`mode-mart ${mode === 'mart' ? 'on' : ''}`} onClick={() => go('mart')} data-testid="mode-mart">
          <ShoppingCart size={16} strokeWidth={1.75} aria-hidden /> <span>Business Mart</span>
          {martDot && mode !== 'mart' && <i className="mode-dot" aria-label={t('new', 'नया', 'naya')} />}
        </button>
      )}
    </div>
  );
}

function NavList({ onNavigate, badges, mode }: { onNavigate?: () => void; badges?: Badges; mode: Mode }) {
  const { t } = useI18n();
  const { can, plan } = useSession();
  const groups = navGroups(t).filter((g) => g.mode === 'both' || g.mode === mode);
  return (
    <nav className="nav" aria-label={t('Main', 'मुख्य', 'Main')}>
      {groups.map((g) => {
        const items = g.items.filter((i) => allowed(i, can) && allowedPlan(i, plan));
        if (!items.length) return null;
        return (
          <div key={g.id} className={`nav-group ${g.tone === 'mart' ? 'nav-group-mart' : ''}`}>
            {g.label && <div className="nav-group-label">{g.label}</div>}
            {items.map((i) => <NavEntry key={i.id} item={i} onNavigate={onNavigate} badge={i.badgeKey ? badges?.[i.badgeKey] || undefined : undefined} />)}
          </div>
        );
      })}
    </nav>
  );
}

function SubscriptionNote({ mode }: { mode: Mode }) {
  const { t } = useI18n();
  const { can } = useSession();
  const { data } = useQuery({ queryKey: ['subscription'], queryFn: () => get<{ subscription: Subscription; plan?: string; plan_tier?: string | null }>('/api/subscription'), enabled: can.owner, staleTime: 300_000 });
  const s = data?.subscription;
  if (!s) return null;
  if (mode === 'mart') return <div className="sub-note sub-note-mart">{t('Business Mart is free, always.', 'Business Mart हमेशा मुफ़्त है।', 'Business Mart hamesha free hai.')}</div>;
  // Free Udhaar plan after the trial: udhaar stays open, billing & stock
  // are locked — a note, not the lock overlay (see WorkspaceLock).
  if (s.read_only && data?.plan_tier === 'free') return <Link className="sub-note" to="/settings?tab=plan">{t('Free Udhaar plan — billing & stock need an upgrade', 'फ्री उधार प्लान — billing और stock के लिए upgrade करें', 'Free Udhaar plan — billing aur stock ke liye upgrade karo')}</Link>;
  if (s.read_only) return <Link className="sub-note sub-note-owed" to="/settings?tab=plan">{t('Workspace plan ended — read-only. Business Mart still works. Renew', 'Workspace plan खत्म — सिर्फ़ देख सकते हैं। Business Mart चालू है। Renew करें', 'Workspace plan khatam — sirf dekh sakte ho. Business Mart chalu hai. Renew karo')}</Link>;
  if (s.status === 'none') return null; // shop setup not done yet — no plan exists to talk about
  if (s.status === 'trial' || s.days_left <= 7) {
    return <Link className="sub-note" to="/settings?tab=plan">{s.status === 'trial' ? t(`Workspace trial · ${s.days_left} days left`, `Workspace ट्रायल · ${s.days_left} दिन बाकी`, `Workspace trial · ${s.days_left} din baaki`) : t(`Workspace renews in ${s.days_left} days`, `Workspace ${s.days_left} दिन में renew`, `Workspace ${s.days_left} din me renew`)}</Link>;
  }
  return null;
}

/** Founder rule (2026-11-22): an expired Workspace plan LOCKS the
    Workspace — it never logs the user out. The data stays visible
    (read-only browsing after dismiss), the session stays alive, the
    Business Mart side is untouched, and the moment the plan is active
    again the lock lifts and the current view refreshes in place. */
function WorkspaceLock({ mode }: { mode: Mode }) {
  const { t } = useI18n();
  const { can, me } = useSession();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => get<{ subscription: Subscription; plan?: string; plan_tier?: string | null }>('/api/subscription'),
    enabled: can.owner && mode === 'workspace',
    staleTime: 30_000,
    refetchInterval: (q) => (q.state.data?.subscription?.read_only ? 30_000 : false)
  });
  const s = data?.subscription;
  const key = s ? `bos_lock_dismissed:${me?.business?.id}:${s.ends_at}` : '';
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { try { setDismissed(!!(key && sessionStorage.getItem(key))); } catch { setDismissed(false); } }, [key]);
  useEffect(() => {
    // Plan active again → lift the lock and refresh what is on screen.
    if (s && !s.read_only) {
      try { sessionStorage.removeItem(key); } catch { /* */ }
      qc.invalidateQueries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.read_only]);
  if (mode !== 'workspace' || !can.owner || !s?.read_only || dismissed) return null;
  // Free Udhaar plan: the shop keeps udhaar after the trial, so the
  // expired-plan lock overlay must NOT cover the screen — the sidebar
  // note (SubscriptionNote) explains the plan instead.
  if (data?.plan_tier === 'free') return null;
  const dismiss = () => { try { sessionStorage.setItem(key, '1'); } catch { /* */ } setDismissed(true); };
  return (
    <div className="lock-overlay" role="dialog" aria-modal="true" aria-label={t('Plan ended', 'Plan खत्म', 'Plan khatam')}>
      <div className="lock-card">
        <span className="auth-icon"><Lock size={22} /></span>
        <h2>{t('Trial / plan has ended', 'Trial / plan खत्म हो गया', 'Trial / plan khatam ho gaya')}</h2>
        <p className="muted">{t('Your data is completely safe. Pay and pick up right where you left off — no logout, no setup again.', 'आपका data बिल्कुल safe है। Payment करके वहीं से दोबारा शुरू करो — कोई logout नहीं, कोई setup दोबारा नहीं।', 'Aapka data bilkul safe hai. Payment karke wahi se dobara shuru karo — koi logout nahi, koi setup dobara nahi.')}</p>
        <p className="muted">{t('Business Mart stays free and open, as always.', 'Business Mart हमेशा की तरह मुफ़्त और खुला है।', 'Business Mart hamesha ki tarah free aur khula hai.')}</p>
        <div className="lock-actions">
          <Link to="/settings?tab=plan"><Button variant="primary" size="lg">{t('See plans & renew', 'Plans देखें और renew करें', 'Plans dekho aur renew karo')}</Button></Link>
          <Button size="lg" onClick={dismiss}>{t('Just look at my data', 'सिर्फ़ मेरा data देखूं', 'Sirf mera data dekhoon')}</Button>
        </div>
      </div>
    </div>
  );
}

export function AppShell() {
  const { t } = useI18n();
  const { me, logout, can, plan } = useSession();
  const nav = useNavigate();
  const loc = useLocation();
  const mobile = useIsMobile();
  const [cmdk, setCmdk] = useState(false);
  const [more, setMore] = useState(false);
  const { data: mart } = useQuery({
    queryKey: ['mart-summary'],
    queryFn: () => get<{ buying?: { new_quotes?: number }; selling?: { new_leads?: number }; unread?: number }>('/api/mart/summary'),
    // The summary is seller-side data: before the shop setup it answers
    // 403 workspace_not_setup, so simply don't ask (badges stay empty).
    enabled: can.mart && !!me?.business?.workspace_active, refetchInterval: 60_000, staleTime: 30_000, retry: false
  });
  const badges: Badges = { 'mart-buy': mart?.buying?.new_quotes, 'mart-sell': mart?.selling?.new_leads, 'mart-notifs': mart?.unread };
  const mode = modeOf(loc.pathname);
  const martDot = !!(badges['mart-buy'] || badges['mart-sell'] || badges['mart-notifs']);
  useEffect(() => { rememberPath(loc.pathname); }, [loc.pathname]);

  // Global keyboard: ⌘K/Ctrl+K palette, "/" search, N new bill, G-then-key jumps.
  useEffect(() => {
    let gPending = 0;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmdk((v) => !v); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('[role="dialog"]')) return;
      if (e.key === '/') { e.preventDefault(); setCmdk(true); return; }
      if (loc.pathname === '/pos') return; // the counter owns single-key shortcuts
      const k = e.key.toLowerCase();
      if (gPending && Date.now() - gPending < 1200) {
        gPending = 0;
        const map: Record<string, string> = { h: '/', b: '/bills', c: '/customers', p: '/products', s: '/suppliers', u: '/purchases', m: '/mart', o: '/mart/orders' };
        if (map[k]) { e.preventDefault(); nav(map[k]); }
        return;
      }
      if (k === 'g') { gPending = Date.now(); return; }
      if (k === 'n' && can.billing && plan !== 'free') { e.preventDefault(); nav('/pos'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav, loc.pathname, can.billing, plan]);

  const biz = me?.business;
  const fullBleed = loc.pathname === '/pos';

  return (
    <div className={`shell ${fullBleed ? 'shell-pos' : ''} shell-${mode}`}>
      {!mobile && (
        <aside className="sidebar">
          <div className="sidebar-top">
            <img src="/bizyour-mark-512.png?v=c" alt="" className="brand-mark" width={28} height={28} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="biz-name ellipsis">{biz?.name || 'BizYour'}</div>
              <div className="biz-meta ellipsis">{[biz?.city, biz?.gst_enabled ? 'GST' : null].filter(Boolean).join(', ') || 'BizYour'}</div>
            </div>
          </div>
          <button className="search-trigger" onClick={() => setCmdk(true)}>
            <Search size={16} aria-hidden /> <span className="grow">{t('Search…', 'खोजें…', 'Search…')}</span>
          </button>
          <ModeSwitch mode={mode} martDot={martDot} />
          <NavList badges={badges} mode={mode} />
          <div className="sidebar-foot">
            <SubscriptionNote mode={mode} />
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <LangSwitch />
            </div>
            <div className="me-row">
              <span className="avatar" aria-hidden>{initials(me?.user.name || '')}</span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="ellipsis" style={{ fontWeight: 500 }}>{me?.user.name}</div>
                <div className="muted ellipsis" style={{ fontSize: 12 }}>{me?.user.role === 'owner' ? t('Owner', 'मालिक', 'Owner') : t('Staff', 'स्टाफ', 'Staff')}</div>
              </div>
              <button className="icon-btn icon-btn-sm" onClick={logout} aria-label={t('Log out', 'लॉग आउट', 'Log out')} title={t('Log out', 'लॉग आउट', 'Log out')}><LogOut size={16} /></button>
            </div>
          </div>
        </aside>
      )}

      <main className="main" id="main">
        {mobile && !fullBleed && <div className="mobile-mode"><ModeSwitch mode={mode} martDot={martDot} /></div>}
        <Outlet context={{ openSearch: () => setCmdk(true) }} />
      </main>

      <WorkspaceLock mode={mode} />

      {mobile && !fullBleed && mode === 'mart' && (
        <nav className="bottombar bottombar-mart" aria-label={t('Business Mart', 'बिज़नेस मार्ट', 'Business Mart')}>
          <BottomLink to="/mart" icon={<ShoppingCart size={22} strokeWidth={1.75} />} label={t('Buy', 'खरीदें', 'Khareedo')} end />
          <BottomLink to="/mart/browse" icon={<Search size={22} strokeWidth={1.75} />} label={t('Browse', 'देखें', 'Dekho')} />
          <BottomLink to="/mart/orders" icon={<PackageCheck size={22} strokeWidth={1.75} />} label={t('Orders', 'ऑर्डर', 'Orders')} />
          <BottomLink to="/mart/sell" icon={<Store size={22} strokeWidth={1.75} />} label={t('Sell', 'बेचें', 'Becho')} />
          <button className="bottom-link" onClick={() => setMore(true)}>
            <Menu size={22} strokeWidth={1.75} /><span>{t('More', 'और', 'Aur')}</span>
          </button>
        </nav>
      )}
      {mobile && !fullBleed && mode === 'workspace' && (
        <nav className="bottombar" aria-label={t('Main', 'मुख्य', 'Main')}>
          <BottomLink to="/" icon={<Home size={22} strokeWidth={1.75} />} label={t('Home', 'होम', 'Home')} end />
          {can.billing && plan !== 'free' && <BottomLink to="/bills" icon={<ReceiptText size={22} strokeWidth={1.75} />} label={t('Bills', 'बिल', 'Bills')} />}
          {can.billing && plan !== 'free' && (
            <NavLink to="/pos" className="bottom-primary" aria-label={t('New bill', 'नया बिल', 'Naya bill')}>
              <Plus size={26} strokeWidth={2.25} />
            </NavLink>
          )}
          {can.billing && <BottomLink to="/customers" icon={<Users size={22} strokeWidth={1.75} />} label={t('Udhaar', 'उधार', 'Udhaar')} />}
          <button className="bottom-link" onClick={() => setMore(true)}>
            <Menu size={22} strokeWidth={1.75} /><span>{t('More', 'और', 'Aur')}</span>
          </button>
        </nav>
      )}

      <Drawer open={more} onClose={() => setMore(false)} title={biz?.name || 'BizYour'}>
        <div className="stack" style={{ gap: 16 }}>
          <button className="search-trigger" onClick={() => { setMore(false); setCmdk(true); }}>
            <Search size={16} /> <span className="grow">{t('Search', 'खोजें', 'Search')}</span>
          </button>
          <ModeSwitch mode={mode} martDot={martDot} onSwitch={() => setMore(false)} />
          <NavList onNavigate={() => setMore(false)} badges={badges} mode={mode} />
          <SubscriptionNote mode={mode} />
          <LangSwitch />
          <button className="btn btn-secondary btn-block" onClick={logout}><LogOut size={16} /> {t('Log out', 'लॉग आउट', 'Log out')}</button>
        </div>
      </Drawer>

      <CommandPalette open={cmdk} onClose={() => setCmdk(false)} />
    </div>
  );
}

function BottomLink({ to, icon, label, end }: { to: string; icon: ReactNode; label: string; end?: boolean }) {
  return <NavLink to={to} end={end} className="bottom-link">{icon}<span>{label}</span></NavLink>;
}

/** Page header used by every screen: title, optional subtitle and actions. */
export function PageHeader({ title, sub, actions, back }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <header className="page-head">
      <div className="grow" style={{ minWidth: 0 }}>
        {back}
        <h1>{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function usePageTitle(title: string) {
  useEffect(() => { document.title = title ? `${title} · BizYour` : 'BizYour'; }, [title]);
}

export const useNavGroups = () => { const { t } = useI18n(); return useMemo(() => navGroups(t), [t]); };
