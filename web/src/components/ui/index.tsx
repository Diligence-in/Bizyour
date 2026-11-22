import {
  createContext, forwardRef, useCallback, useContext, useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { rupees } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import type { BillStatus } from '../../lib/types';

/* ---------- Button ---------- */
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'mart';
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant; size?: 'sm' | 'md' | 'lg' | 'xl'; block?: boolean; icon?: ReactNode; kbd?: string; loading?: boolean;
}
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'secondary', size = 'md', block, icon, kbd, loading, children, className = '', disabled, type = 'button', ...rest }, ref
) {
  const cls = ['btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, block && 'btn-block', className].filter(Boolean).join(' ');
  return (
    <button ref={ref} type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {icon}
      {children}
      {kbd && <span className="kbd" aria-hidden>{kbd}</span>}
    </button>
  );
});

export function IconButton({ label, children, size, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: 'sm' }) {
  return (
    <button type="button" className={`icon-btn ${size === 'sm' ? 'icon-btn-sm' : ''} ${className}`} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}

export const Kbd = ({ children }: { children: ReactNode }) => <span className="kbd">{children}</span>;

/* ---------- Fields ---------- */
interface FieldProps { label?: ReactNode; hint?: ReactNode; error?: ReactNode; children: (id: string) => ReactNode; className?: string }
export function Field({ label, hint, error, children, className = '' }: FieldProps) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      {label && <label className="field-label" htmlFor={id}>{label}</label>}
      {children(id)}
      {error ? <span className="field-error" role="alert">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { size2?: 'lg'; numeric?: boolean }>(
  function Input({ className = '', size2, numeric, ...rest }, ref) {
    return <input ref={ref} className={`input ${size2 === 'lg' ? 'input-lg' : ''} ${numeric ? 'input-num' : ''} ${className}`} {...rest} />;
  }
);
export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`select ${className}`} {...rest}>{children}</select>;
}

export function Segmented<V extends string>({ value, onChange, options, size, label }: {
  value: V; onChange: (v: V) => void; options: { value: V; label: ReactNode; title?: string }[]; size?: 'lg'; label: string;
}) {
  return (
    <div className={`segmented ${size === 'lg' ? 'segmented-lg' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} title={o.title} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

/* ---------- Money + badges ---------- */
export function Money({ value, tone, paise, sign, className = '' }: { value: number; tone?: 'in' | 'owed' | 'warn' | 'auto'; paise?: boolean; sign?: boolean; className?: string }) {
  const t = tone === 'auto' ? (value < 0 ? 'owed' : value > 0 ? 'in' : undefined) : tone;
  return <span className={`money ${t ? `money-${t}` : ''} ${className}`}>{rupees(value, { paise, sign })}</span>;
}

export function Badge({ tone, children, plain }: { tone?: 'in' | 'owed' | 'warn' | 'info' | 'accent' | 'mart'; children: ReactNode; plain?: boolean }) {
  return <span className={`badge ${tone ? `badge-${tone}` : ''} ${plain ? 'badge-plain' : ''}`}>{children}</span>;
}

export function BillStatusBadge({ status, cancelled, overdue }: { status: BillStatus; cancelled?: boolean; overdue?: boolean }) {
  const { t } = useI18n();
  if (cancelled) return <Badge>{t('Cancelled', 'रद्द', 'Cancel')}</Badge>;
  if (status === 'paid') return <Badge tone="in">{t('Paid', 'चुकता', 'Paid')}</Badge>;
  if (overdue) return <Badge tone="owed">{t('Overdue', 'बकाया पार', 'Overdue')}</Badge>;
  if (status === 'partial') return <Badge tone="warn">{t('Part paid', 'आंशिक', 'Thoda baaki')}</Badge>;
  return <Badge tone="owed">{t('Unpaid', 'बाकी', 'Baaki')}</Badge>;
}

export function StockBadge({ status }: { status: 'ok' | 'low' | 'out' }) {
  const { t } = useI18n();
  if (status === 'out') return <Badge tone="owed">{t('Out of stock', 'खत्म', 'Khatam')}</Badge>;
  if (status === 'low') return <Badge tone="warn">{t('Low', 'कम', 'Kam')}</Badge>;
  return <Badge tone="in">{t('In stock', 'है', 'Hai')}</Badge>;
}

/* ---------- Panel ---------- */
export function Panel({ title, action, children, className = '', bodyClass = 'panel-body', foot }: {
  title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; foot?: ReactNode;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && <header className="panel-head">{typeof title === 'string' ? <h2>{title}</h2> : title}{action}</header>}
      <div className={bodyClass}>{children}</div>
      {foot && <footer className="panel-foot">{foot}</footer>}
    </section>
  );
}

/* ---------- Tabs ---------- */
export function Tabs<V extends string>({ value, onChange, tabs, label }: { value: V; onChange: (v: V) => void; tabs: { value: V; label: ReactNode; count?: number }[]; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tb) => (
        <button key={tb.value} role="tab" className="tab" aria-selected={tb.value === value} onClick={() => onChange(tb.value)}>
          {tb.label}{tb.count !== undefined && <span className="count num">{tb.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- Overlays ---------- */
function useOverlay(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    const el = ref.current;
    const focusable = el?.querySelector<HTMLElement>('[autofocus], input, select, textarea, button:not([data-close])');
    (focusable || el)?.focus();
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey, true); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open, onClose]);
  return ref;
}

export function Drawer({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useOverlay(open, onClose);
  const { t } = useI18n();
  if (!open) return null;
  return createPortal(
    <>
      <div className="scrim" onClick={onClose} />
      <div ref={ref} className="drawer" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} tabIndex={-1} style={wide ? { width: 'min(720px, 100vw)' } : undefined}>
        <div className="drawer-head">
          <h2>{title}</h2>
          <IconButton label={t('Close', 'बंद करें', 'Band karo')} data-close onClick={onClose}><X size={18} /></IconButton>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </div>
    </>,
    document.body
  );
}

export function Modal({ open, onClose, children, className = '', label }: { open: boolean; onClose: () => void; children: ReactNode; className?: string; label: string }) {
  const ref = useOverlay(open, onClose);
  if (!open) return null;
  return createPortal(
    <>
      <div className="scrim" onClick={onClose} />
      <div ref={ref} className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>{children}</div>
    </>,
    document.body
  );
}

/* ---------- Empty + skeleton ---------- */
export function Empty({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return <div className="empty">{icon}<h3>{title}</h3>{body && <p>{body}</p>}{action && <div style={{ marginTop: 8 }}>{action}</div>}</div>;
}
export const Skel = ({ w = '100%', h = 14 }: { w?: number | string; h?: number }) => <span className="skel" style={{ display: 'block', width: w, height: h }} />;
export function SkelRows({ rows = 5 }: { rows?: number }) {
  return <div style={{ padding: 16, display: 'grid', gap: 14 }}>{Array.from({ length: rows }, (_, i) => <Skel key={i} w={`${92 - (i % 3) * 14}%`} />)}</div>;
}

/* ---------- Toasts ---------- */
interface ToastItem { id: number; text: string; tone?: 'error'; action?: { label: string; onClick: () => void } }
const ToastCtx = createContext<(t: Omit<ToastItem, 'id'>) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-2), { ...t, id }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), t.action ? 7000 : 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {createPortal(
        <div className="toasts" role="status" aria-live="polite">
          {items.map((it) => (
            <div key={it.id} className={`toast ${it.tone === 'error' ? 'toast-error' : ''}`}>
              <span>{it.text}</span>
              {it.action && <button className="btn btn-sm" onClick={() => { it.action!.onClick(); setItems((xs) => xs.filter((x) => x.id !== it.id)); }}>{it.action.label}</button>}
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
