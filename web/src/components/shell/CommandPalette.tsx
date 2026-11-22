import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, FileText, Package, Plus, Search, ShoppingCart, Truck, User, Factory, type LucideIcon } from 'lucide-react';
import { get } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useSession } from '../../lib/session';
import { rupees } from '../../lib/format';
import { Modal } from '../ui';
import { allowed, navGroups } from './nav';

// ⌘K / Ctrl+K: one box to jump anywhere or find any record — the Tally
// "Go To" habit, in a modern palette. Live record search uses the existing
// role-filtered /api/search (staff only see what their access allows).

interface Hit { id: string; label: string; hint?: string; icon: LucideIcon; group: string; run: () => void }
interface SearchRes {
  products: { id: number; name: string; stock_qty: number; sell_price: number }[];
  customers: { id: number; name: string; phone?: string; pending?: number }[];
  suppliers: { id: number; name: string; pending?: number }[];
  invoices: { id: number; bill_no: number; customer_name: string; total: number }[];
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { can } = useSession();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [res, setRes] = useState<SearchRes | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) { setQ(''); setSel(0); setRes(null); } }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setRes(null); return; }
    const id = setTimeout(() => {
      get<SearchRes>(`/api/search?q=${encodeURIComponent(term)}`).then(setRes).catch(() => setRes(null));
    }, 160);
    return () => clearTimeout(id);
  }, [q]);

  const go = (to: string) => { onClose(); if (to.startsWith('/classic')) window.location.href = to; else nav(to); };

  const hits = useMemo<Hit[]>(() => {
    const term = q.trim().toLowerCase();
    const actions: Hit[] = [];
    if (can.billing) actions.push({ id: 'a-bill', label: t('New bill', 'नया बिल', 'Naya bill'), icon: Plus, group: t('Actions', 'काम', 'Kaam'), run: () => go('/pos') });
    if (can.stock) actions.push({ id: 'a-prod', label: t('Add a product', 'सामान जोड़ें', 'Saaman jodo'), icon: Package, group: t('Actions', 'काम', 'Kaam'), run: () => go('/products?new=1') });
    if (can.stock) actions.push({ id: 'a-pur', label: t('Record a purchase', 'खरीद दर्ज करें', 'Khareed likho'), icon: Truck, group: t('Actions', 'काम', 'Kaam'), run: () => go('/purchases?new=1') });
    if (can.mart) actions.push({ id: 'a-mart', label: t('Ask wholesalers for quotes', 'थोक वालों से भाव मांगें', 'Wholesalers se bhaav maango'), icon: ShoppingCart, group: t('Actions', 'काम', 'Kaam'), run: () => go('/mart?new=1') });
    if (can.billing) actions.push({ id: 'a-cust', label: t('Add a customer', 'ग्राहक जोड़ें', 'Customer jodo'), icon: User, group: t('Actions', 'काम', 'Kaam'), run: () => go('/customers?new=1') });
    const pages: Hit[] = navGroups(t).flatMap((g) => g.items.filter((i) => allowed(i, can)).map((i) => ({
      id: `p-${i.id}`, label: i.label, icon: i.icon,
      group: t('Go to', 'जाएं', 'Jao'), run: () => go(i.to), _k: `${i.label} ${i.keywords || ''}`.toLowerCase()
    } as Hit & { _k: string })));
    const match = (h: Hit & { _k?: string }) => !term || (h._k || h.label.toLowerCase()).includes(term);
    const out: Hit[] = [...actions.filter(match), ...pages.filter(match)];
    if (res) {
      const g = t('Records', 'रिकॉर्ड', 'Records');
      res.customers.forEach((c) => out.push({ id: `c${c.id}`, label: c.name, hint: c.pending ? `${t('owes', 'बाकी', 'baaki')} ${rupees(c.pending)}` : c.phone, icon: User, group: g, run: () => go(`/customers/${c.id}`) }));
      res.invoices.forEach((i) => out.push({ id: `i${i.id}`, label: `${t('Bill', 'बिल', 'Bill')} #${i.bill_no} · ${i.customer_name}`, hint: rupees(i.total), icon: FileText, group: g, run: () => go(`/bills/${i.id}`) }));
      res.products.forEach((p) => out.push({ id: `pr${p.id}`, label: p.name, hint: `${p.stock_qty} ${t('in stock', 'स्टॉक', 'stock')} · ${rupees(p.sell_price)}`, icon: Package, group: g, run: () => go(`/products?open=${p.id}`) }));
      res.suppliers.forEach((s) => out.push({ id: `s${s.id}`, label: s.name, hint: s.pending ? `${t('to pay', 'देना', 'dena')} ${rupees(s.pending)}` : undefined, icon: Factory, group: g, run: () => go('/suppliers') }));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, res, can, t]);

  useEffect(() => { setSel(0); }, [q, res]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(hits.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); hits[sel]?.run(); }
  };

  let lastGroup = '';
  return (
    <Modal open={open} onClose={onClose} className="cmdk" label={t('Search', 'खोजें', 'Search')}>
      <div className="cmdk-input">
        <Search size={18} className="muted" aria-hidden />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
          placeholder={t('Search bills, customers, products — or type a page', 'बिल, ग्राहक, सामान खोजें — या स्क्रीन का नाम', 'Bill, customer, saaman search karo — ya screen ka naam')}
          aria-label={t('Search', 'खोजें', 'Search')} role="combobox" aria-expanded="true" aria-controls="cmdk-list" />
      </div>
      <div className="cmdk-list" id="cmdk-list" role="listbox" ref={listRef}>
        {hits.length === 0 && <div className="empty" style={{ padding: 24 }}><p>{t('Nothing found.', 'कुछ नहीं मिला।', 'Kuch nahi mila.')}</p></div>}
        {hits.map((h, i) => {
          const head = h.group !== lastGroup ? <div className="cmdk-group" key={`g-${h.group}`}>{h.group}</div> : null;
          lastGroup = h.group;
          return [
            head,
            <button key={h.id} data-i={i} role="option" aria-selected={i === sel} className="cmdk-item" onMouseMove={() => setSel(i)} onClick={h.run}>
              <h.icon size={16} aria-hidden /> <span className="ellipsis">{h.label}</span>
              {h.hint && <span className="hint">{h.hint}</span>}
            </button>
          ];
        })}
      </div>
      <div className="cmdk-foot">
        <span>↑↓ {t('move', 'चुनें', 'chuno')}</span>
        <span><CornerDownLeft size={12} style={{ verticalAlign: '-2px' }} /> {t('open', 'खोलें', 'kholo')}</span>
        <span>Esc {t('close', 'बंद', 'band')}</span>
      </div>
    </Modal>
  );
}
