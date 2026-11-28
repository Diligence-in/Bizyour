import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Minus, Plus, Printer, Search, Trash2, UserRound, X } from 'lucide-react';
import { get, post, put } from '../lib/api';
import { billShareMessage, fetchBillPdfUrl, hasPhone, openBillPdf, openWa } from '../lib/shareBill';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';
import { gstPart, qty as fmtQty, round2, rupees } from '../lib/format';
import type { BillingProduct, Customer, Invoice } from '../lib/types';
import { Button, Field, IconButton, Input, Modal, Money, Segmented, Select, useToast } from '../components/ui';
import { useIsMobile, usePageTitle } from '../components/shell/AppShell';

// The counter. Built for two people at once:
//  - a first-time shopkeeper on a phone: big search, tap +/−, one green button;
//  - a fast operator at a desk: type → Enter adds, ↑↓ picks, C = customer,
//    F2–F5 = payment mode, Ctrl+Enter saves, Esc clears.
// Maths mirrors the server exactly (GST-inclusive, discount off the total);
// the server recomputes everything on save, so the screen can never
// disagree with the stored bill.
//
// Edit mode (23 Nov): /pos?edit=<bill id> opens the same counter filled with
// a saved bill — items, rates, customer, discount, payment — and saves back
// to that bill (PUT /api/invoices/:id), replacing the old "Edit in classic
// screen" link. The bill's own quantities count as available stock.

type Mode = 'Cash' | 'UPI' | 'Bank' | 'Udhaar';
const UNITS = ['piece', 'pack', 'kg', 'gram', 'litre', 'ml', 'box', 'dozen', 'bag', 'bottle', 'metre'];
type Tier = 'retail' | 'wholesale';
interface Line { product: BillingProduct; qty: number; price: number; tier: Tier }

function addDays(n: number) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function PosPage() {
  const { t, err } = useI18n();
  const { me } = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const nav = useNavigate();
  const mobile = useIsMobile();
  const [sp] = useSearchParams();
  const editId = sp.get('edit');
  const editBill = useQuery({
    queryKey: ['invoice', editId],
    queryFn: () => get<{ invoice: Invoice; customer: Customer | null; items: { product_id: number; product_name: string; qty: number; sell_price: number; gst_rate: number; p_unit?: string }[]; returns: unknown[] }>(`/api/invoices/${editId}`),
    enabled: !!editId
  });
  const editInv = editBill.data?.invoice;
  usePageTitle(editId ? t(`Edit bill #${editInv?.bill_no ?? ''}`, `बिल #${editInv?.bill_no ?? ''} बदलें`, `Bill #${editInv?.bill_no ?? ''} badlo`) : t('New bill', 'नया बिल', 'Naya bill'));

  const products = useQuery({ queryKey: ['billing-products'], queryFn: () => get<{ products: BillingProduct[] }>('/api/billing-products'), staleTime: 15_000 });
  const recent = useQuery({ queryKey: ['recent-items'], queryFn: () => get<{ items: { product_id: number; name: string; last_rate: number }[] }>('/api/billing/recent-items') });
  const customers = useQuery({ queryKey: ['customers'], queryFn: () => get<{ customers: Customer[] }>('/api/customers') });

  const [lines, setLines] = useState<Line[]>([]);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [custOpen, setCustOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('Cash');
  const [discount, setDiscount] = useState('');
  const [received, setReceived] = useState<string | null>(null); // null = follow total
  const [due, setDue] = useState(addDays(15));
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<Invoice | null>(null);
  const [payOpen, setPayOpen] = useState(false); // mobile payment sheet
  const searchRef = useRef<HTMLInputElement>(null);

  // 12-features pack: per-customer special rates (override) + the
  // customer's default price tier. Bill rate resolution, everywhere on
  // this screen: special rate → tier price → sell price.
  const specials = useQuery({
    queryKey: ['special-rates', customer?.id],
    queryFn: () => get<{ prices: { product_id: number; price: number }[] }>(`/api/customers/${customer!.id}/prices`),
    enabled: !!customer
  });
  const specialMap = useMemo(() => {
    const m = new Map<number, number>();
    (specials.data?.prices || []).forEach((p) => m.set(p.product_id, Number(p.price)));
    return m;
  }, [specials.data]);
  const resolveRate = useCallback((p: BillingProduct, tier: Tier) => {
    const sp = specialMap.get(p.id);
    if (sp !== undefined) return sp;
    if (tier === 'wholesale' && p.wholesale_price != null) return p.wholesale_price;
    return p.sell_price;
  }, [specialMap]);
  const setTierAt = (id: number, tier: Tier) => setLines((ls) => ls.map((l) => (l.product.id === id ? { ...l, tier, price: resolveRate(l.product, tier) } : l)));

  const gstOn = !!me?.business?.gst_enabled;
  // While editing, the quantities already on this bill are back in stock.
  const origQty = useMemo(() => {
    const m = new Map<number, number>();
    (editBill.data?.items || []).forEach((it) => m.set(it.product_id, (m.get(it.product_id) || 0) + Number(it.qty)));
    return m;
  }, [editBill.data]);
  const all = useMemo(() => (products.data?.products || []).map((p) => (origQty.has(p.id) ? { ...p, stock_qty: p.stock_qty + (origQty.get(p.id) || 0) } : p)), [products.data, origQty]);
  const loadedRef = useRef(false);
  useEffect(() => {
    const d = editBill.data;
    if (!d || !products.data || !customers.data || loadedRef.current) return;
    loadedRef.current = true;
    const inv = d.invoice;
    const merged: Line[] = [];
    for (const it of d.items) {
      const i = merged.findIndex((l) => l.product.id === it.product_id);
      if (i >= 0) { merged[i] = { ...merged[i], qty: merged[i].qty + Number(it.qty) }; continue; }
      const p = all.find((x) => x.id === it.product_id) || { id: it.product_id, name: it.product_name, unit: it.p_unit || '', sell_price: it.sell_price, wholesale_price: null, gst_rate: it.gst_rate, stock_qty: Number(it.qty) };
      merged.push({ product: p, qty: Number(it.qty), price: Number(it.sell_price), tier: (p.wholesale_price != null && Number(it.sell_price) === Number(p.wholesale_price)) ? 'wholesale' : 'retail' });
    }
    setLines(merged);
    setCustomer(inv.customer_id ? (customers.data.customers.find((c) => c.id === inv.customer_id) || d.customer) : null);
    setDiscount(Number(inv.discount) > 0 ? String(inv.discount) : '');
    const paidNow = Number(inv.paid_amount) || 0;
    if (paidNow >= Number(inv.total)) { setMode(((inv.payment_mode as Mode) || 'Cash')); setReceived(null); }
    else { setMode('Udhaar'); setReceived(paidNow ? String(paidNow) : null); }
    if (inv.due_date) setDue(inv.due_date);
  }, [editBill.data, products.data, customers.data, all]);
  // What the customer owes apart from this bill (so editing never double-counts).
  const custPending = customer ? round2(customer.pending - (editInv && customer.id === editInv.customer_id ? Math.max(0, Number(editInv.total) - Number(editInv.paid_amount)) : 0)) : 0;
  const editBlocked = !!editBill.data && (editBill.data.invoice.cancelled || (editBill.data.returns || []).length > 0 || editBill.data.invoice.kind !== 'sale');
  const inBill = (id: number) => lines.find((l) => l.product.id === id)?.qty || 0;

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const words = term.split(/\s+/);
    return all
      .filter((p) => words.every((w) => p.name.toLowerCase().includes(w)))
      .sort((a, b) => Number(b.name.toLowerCase().startsWith(term)) - Number(a.name.toLowerCase().startsWith(term)))
      .slice(0, 8);
  }, [q, all]);
  useEffect(() => setHi(0), [q]);

  const subtotal = round2(lines.reduce((s, l) => s + round2(l.qty * l.price), 0));
  const gst = gstOn ? round2(lines.reduce((s, l) => s + gstPart(round2(l.qty * l.price), l.product.gst_rate), 0)) : 0;
  const disc = Math.min(subtotal, Math.max(0, Number(discount) || 0));
  const total = round2(subtotal - disc);
  const paid = mode === 'Udhaar' ? Math.min(total, Math.max(0, Number(received ?? 0) || 0)) : received === null ? total : Math.min(total, Math.max(0, Number(received) || 0));
  const balance = round2(total - paid);

  const add = useCallback((p: BillingProduct, n = 1) => {
    setLines((ls) => {
      const i = ls.findIndex((l) => l.product.id === p.id);
      if (i >= 0) { const c = ls.slice(); c[i] = { ...c[i], qty: c[i].qty + n }; return c; }
      const tier: Tier = (customer?.price_tier || 'retail') as Tier;
      return [...ls, { product: p, qty: n, price: resolveRate(p, tier), tier }];
    });
    setQ('');
    searchRef.current?.focus();
  }, [customer, resolveRate]);
  const setQtyAt = (id: number, v: number) => setLines((ls) => ls.flatMap((l) => (l.product.id !== id ? [l] : v <= 0 ? [] : [{ ...l, qty: v }])));
  const setPriceAt = (id: number, v: number) => setLines((ls) => ls.map((l) => (l.product.id === id ? { ...l, price: v } : l)));

  // Quick-add (founder, 24 Nov): bill banate hue naya item yahi banao —
  // pehle Products me jaakar add karne ki jarurat nahi; item stock me
  // save hokar seedha is bill me jud jata hai.
  const [quickOpen, setQuickOpen] = useState(false);

  const reset = () => {
    setLines([]); setCustomer(null); setMode('Cash'); setDiscount(''); setReceived(null); setDue(addDays(15)); setDone(null); setPayOpen(false);
    setTimeout(() => searchRef.current?.focus(), 0);
  };

  const overStock = lines.find((l) => l.qty > l.product.stock_qty);

  const save = async () => {
    if (!lines.length || saving) return;
    if (overStock) { toast({ text: t(`Only ${overStock.product.stock_qty} ${overStock.product.unit} of ${overStock.product.name} in stock.`, `${overStock.product.name} का stock सिर्फ़ ${overStock.product.stock_qty} है।`, `${overStock.product.name} ka stock sirf ${overStock.product.stock_qty} hai.`), tone: 'error' }); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        items: lines.map((l) => ({ product_id: l.product.id, qty: l.qty, sell_price: l.price })),
        discount: disc,
        paid_amount: paid,
        payment_mode: paid > 0 ? (mode === 'Udhaar' ? 'Cash' : mode) : undefined
      };
      if (customer) body.customer_id = customer.id;
      if (balance > 0) body.due_date = due || null;
      if (editId) {
        body.customer_id = customer ? customer.id : null;
        await put<{ invoice: Invoice }>(`/api/invoices/${editId}`, body);
        ['invoice', 'billing-products', 'recent-items', 'dash-summary', 'invoices', 'customers', 'alerts', 'day-end', 'dash-finance', 'products'].forEach((k) => qc.invalidateQueries({ queryKey: k === 'invoice' ? ['invoice', editId] : [k] }));
        toast({ text: t(`Bill #${editInv?.bill_no ?? ''} updated`, `बिल #${editInv?.bill_no ?? ''} बदल गया`, `Bill #${editInv?.bill_no ?? ''} badal gaya`) });
        nav(`/bills/${editId}`, { replace: true });
        return;
      }
      const r = await post<{ invoice: Invoice }>('/api/invoices', body);
      setDone(r.invoice);
      setPayOpen(false);
      qc.invalidateQueries({ queryKey: ['billing-products'] });
      qc.invalidateQueries({ queryKey: ['recent-items'] });
      qc.invalidateQueries({ queryKey: ['dash-summary'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['alerts'] });
      qc.invalidateQueries({ queryKey: ['day-end'] });
      qc.invalidateQueries({ queryKey: ['dash-finance'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    } catch (e) {
      toast({ text: err(e), tone: 'error' });
    } finally { setSaving(false); }
  };

  // Keyboard map for the counter.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]') && !done) return;
      if (done) {
        if (e.key === 'Enter' || e.key.toLowerCase() === 'n') { e.preventDefault(); reset(); }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); save(); return; }
      const fm: Record<string, Mode> = { F2: 'Cash', F3: 'UPI', F4: 'Bank', F5: 'Udhaar' };
      if (fm[e.key]) { e.preventDefault(); setMode(fm[e.key]); setReceived(null); return; }
      const el = e.target as HTMLElement;
      const typing = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
      if (typing) return;
      if (e.key.toLowerCase() === 'c') { e.preventDefault(); setCustOpen(true); }
      else if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => { if (!mobile) searchRef.current?.focus(); }, [mobile]);

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(matches.length - 1, h + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (matches[hi]) add(matches[hi]);
      else if (q.trim()) setQuickOpen(true);
      else if (!q.trim() && lines.length && !mobile) save();
    } else if (e.key === 'Escape') { setQ(''); }
  };

  if (done) return <BillDone inv={done} onNew={reset} />;

  const words = {
    walkin: t('Walk-in customer', 'बिना नाम ग्राहक', 'Walk-in customer')
  };

  const summary = (
    <div className="pos-pay">
      <button className="pos-customer" onClick={() => setCustOpen(true)}>
        <UserRound size={18} />
        <span className="grow" style={{ textAlign: 'left', minWidth: 0 }}>
          <span className="ellipsis" style={{ display: 'block', fontWeight: 500 }}>{customer ? customer.name : words.walkin}</span>
          {customer ? (
            <span className="muted" style={{ fontSize: 12 }}>{custPending > 0 ? t(`Already owes ${rupees(custPending)}`, `पहले से ${rupees(custPending)} बाकी`, `Pehle se ${rupees(custPending)} baaki`) : customer.phone}</span>
          ) : <span className="muted" style={{ fontSize: 12 }}>{t('Change customer', 'ग्राहक चुनें', 'Customer chuno')}</span>}
        </span>
        {customer && <IconButton size="sm" label={t('Remove customer', 'ग्राहक हटाएं', 'Customer hatao')} onClick={(e) => { e.stopPropagation(); setCustomer(null); }}><X size={14} /></IconButton>}
      </button>

      <dl className="pos-sums">
        <div><dt>{t('Items', 'सामान', 'Saaman')}</dt><dd className="num">{rupees(subtotal)}</dd></div>
        {gstOn && <div className="muted"><dt>{t('GST included', 'GST शामिल', 'GST shaamil')}</dt><dd className="num">{rupees(gst, { paise: true })}</dd></div>}
        <div>
          <dt><label htmlFor="pos-disc">{t('Discount', 'छूट', 'Discount')}</label></dt>
          <dd><input id="pos-disc" className="input input-num pos-mini" inputMode="decimal" placeholder="0" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^\d.]/g, ''))} /></dd>
        </div>
      </dl>

      <div className="pos-total">
        <span>{t('Total', 'कुल', 'Kul')}</span>
        <span className="num">{rupees(total)}</span>
      </div>

      <Segmented<Mode> label={t('Payment', 'भुगतान', 'Payment')} size="lg" value={mode} onChange={(m) => { setMode(m); setReceived(null); }}
        options={[
          { value: 'Cash', label: t('Cash', 'नकद', 'Cash'), title: 'F2' },
          { value: 'UPI', label: 'UPI', title: 'F3' },
          { value: 'Bank', label: t('Bank', 'बैंक', 'Bank'), title: 'F4' },
          { value: 'Udhaar', label: t('Udhaar', 'उधार', 'Udhaar'), title: 'F5' }
        ]} />

      <div className="pos-received">
        <Field label={mode === 'Udhaar' ? t('Paid now (optional)', 'अभी दिया (अगर)', 'Abhi diya (agar)') : t('Received', 'मिला', 'Mila')}>
          {(id) => <Input id={id} numeric inputMode="decimal" value={received === null ? (mode === 'Udhaar' ? '' : String(total)) : received} placeholder="0"
            onChange={(e) => setReceived(e.target.value.replace(/[^\d.]/g, ''))} />}
        </Field>
        {balance > 0 && (
          <Field label={t('Pay by', 'कब तक', 'Kab tak')}>
            {(id) => <Input id={id} type="date" value={due} onChange={(e) => setDue(e.target.value)} />}
          </Field>
        )}
      </div>

      {balance > 0 && (
        <div className={`banner ${customer ? 'banner-warn' : 'banner-owed'}`} style={{ fontSize: 13 }}>
          {customer
            ? t(`${rupees(balance)} goes to ${customer.name}’s udhaar. New balance ${rupees(custPending + balance)}.`, `${rupees(balance)} ${customer.name} के उधार में जुड़ेगा। नया बाकी ${rupees(custPending + balance)}।`, `${rupees(balance)} ${customer.name} ke udhaar me judega. Naya baaki ${rupees(custPending + balance)}.`)
            : t(`${rupees(balance)} unpaid with no customer named — pick a customer so you can collect it later.`, `${rupees(balance)} बाकी है पर ग्राहक नहीं चुना — बाद में वसूली के लिए ग्राहक चुनें।`, `${rupees(balance)} baaki hai par customer nahi chuna — baad me vasooli ke liye customer chuno.`)}
        </div>
      )}

      {customer && customer.credit_limit != null && custPending + total > customer.credit_limit && (
        <div className="banner banner-warn" role="alert" style={{ fontSize: 13 }}>
          {t(`Credit limit ${rupees(customer.credit_limit)} crossed — ${customer.name} already owes ${rupees(custPending)}; with this bill it becomes ${rupees(custPending + total)}. You can still save this bill — the limit is a warning, not a block.`, `क्रेडिट लिमिट ${rupees(customer.credit_limit)} पार — ${customer.name} का पहले से ${rupees(custPending)} बाकी है; इस बिल के साथ ${rupees(custPending + total)} हो जाएगा। फिर भी बिल सेव कर सकते हो — लिमिट चेतावनी है, रोक नहीं।`, `Credit limit ${rupees(customer.credit_limit)} paar — ${customer.name} ka pehle se ${rupees(custPending)} baaki hai; is bill ke saath ${rupees(custPending + total)} ho jayega. Phir bhi bill save kar sakte ho — limit warning hai, rok nahi.`)}
        </div>
      )}

      <Button variant="primary" size="xl" block onClick={save} loading={saving} disabled={!lines.length || editBlocked}>
        <Check size={20} /> {editId ? t('Save changes', 'बदलाव सेव करें', 'Badlav save karo') : balance > 0 && paid === 0 ? t('Save on udhaar', 'उधार में सेव करें', 'Udhaar me save karo') : t('Save bill', 'बिल सेव करें', 'Bill save karo')} · {rupees(total)}
      </Button>
    </div>
  );

  return (
    <div className="pos">
      <div className="pos-main">
        <div className="pos-top">
          <Link to={editId ? `/bills/${editId}` : '/'} className="icon-btn" aria-label={t('Back', 'वापस', 'Wapas')}><ArrowLeft size={18} /></Link>
          <h1 className="pos-title">{editId ? t(`Edit bill #${editInv?.bill_no ?? ''}`, `बिल #${editInv?.bill_no ?? ''} बदलें`, `Bill #${editInv?.bill_no ?? ''} badlo`) : t('New bill', 'नया बिल', 'Naya bill')}</h1>
          <span className="muted hide-mobile" style={{ fontSize: 13 }}>{gstOn ? t('Prices include GST', 'कीमतों में GST शामिल', 'Price me GST shaamil') : t('GST off', 'GST बंद', 'GST band')}</span>
        </div>

        {editId && editBlocked && (
          <div className="banner banner-owed" role="alert" style={{ margin: '0 0 12px' }}>{t('This bill can’t be edited — it is cancelled or has returned items. Cancel it and make a new bill instead.', 'यह बिल नहीं बदल सकता — रद्द है या इसमें वापसी हुई है। इसे रद्द करके नया बिल बनाएं।', 'Ye bill nahi badal sakta — cancel hai ya isme wapsi hui hai. Ise cancel karke naya bill banao.')}</div>
        )}
        {editId && !editBlocked && editInv && (
          <div className="banner banner-info" role="status" style={{ margin: '0 0 12px' }}>{t(`You are changing bill #${editInv.bill_no}. Stock, udhaar and GST are recalculated when you save.`, `आप बिल #${editInv.bill_no} बदल रहे हैं। सेव करने पर स्टॉक, उधार और GST फिर से गिने जाएंगे।`, `Aap bill #${editInv.bill_no} badal rahe ho. Save karne pe stock, udhaar aur GST phir se gine jayenge.`)}</div>
        )}
        <div className="pos-search">
          <div className="input-wrap">
            <Search size={18} />
            <input ref={searchRef} className="input input-lg" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onSearchKey}
              placeholder={t('Type an item name…', 'सामान का नाम लिखें…', 'Saaman ka naam likho…')} aria-label={t('Search items', 'सामान खोजें', 'Saaman search')}
              role="combobox" aria-expanded={matches.length > 0} aria-controls="pos-results" autoComplete="off" />
          </div>
          {matches.length > 0 && (
            <div className="pos-results" id="pos-results" role="listbox">
              {matches.map((p, i) => {
                const left = p.stock_qty - inBill(p.id);
                return (
                  <button key={p.id} role="option" aria-selected={i === hi} className="pos-result" onMouseMove={() => setHi(i)} onClick={() => add(p)} disabled={left <= 0}>
                    <span className="grow ellipsis">{p.name}</span>
                    <span className={`num ${left <= 0 ? 'money-owed' : 'muted'}`} style={{ fontSize: 13 }}>{left <= 0 ? t('out of stock', 'खत्म', 'khatam') : `${fmtQty(left)} ${p.unit}`}</span>
                    <span className="num" style={{ width: 80, textAlign: 'right', fontWeight: 500 }}>{rupees(resolveRate(p, (customer?.price_tier || 'retail') as Tier))}</span>
                  </button>
                );
              })}
              <button className="pos-result" onClick={() => setQuickOpen(true)}>
                <span className="grow ellipsis" style={{ fontWeight: 500 }}>+ {t(`New item: ${q.trim()}`, `नया सामान: ${q.trim()}`, `Naya saaman: ${q.trim()}`)}</span>
                <span className="muted" style={{ fontSize: 13 }}>{t('add here — saved to stock too', 'यहीं जोड़ें — stock में भी जाएगा', 'yahi jodo — stock me bhi jayega')}</span>
              </button>
            </div>
          )}
          {q.trim() && !matches.length && products.data && (
            <div className="pos-results">
              <button className="pos-result" onClick={() => setQuickOpen(true)}>
                <span className="grow ellipsis" style={{ fontWeight: 500 }}>+ {t(`New item: ${q.trim()}`, `नया सामान: ${q.trim()}`, `Naya saaman: ${q.trim()}`)}</span>
                <span className="muted" style={{ fontSize: 13 }}>{t('not in stock yet — add it here, no need to open Products', 'stock में नहीं है — यहीं जोड़ें, Products खोलने की ज़रूरत नहीं', 'stock me nahi hai — yahi jodo, Products kholne ki jarurat nahi')}</span>
              </button>
            </div>
          )}
        </div>

        {!lines.length && (
          <div className="pos-quick">
            <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{t('Sold recently — tap to add', 'हाल में बिके — जोड़ने के लिए दबाएं', 'Haal me bike — jodne ke liye dabao')}</div>
            <div className="chips">
              {(recent.data?.items || all.slice(0, 8).map((p) => ({ product_id: p.id, name: p.name, last_rate: p.sell_price }))).slice(0, 10).map((r) => {
                const p = all.find((x) => x.id === r.product_id);
                if (!p) return null;
                return <button key={r.product_id} className="chip" onClick={() => add(p)} disabled={p.stock_qty <= 0}>{r.name} <span className="num muted">{rupees(p.sell_price)}</span></button>;
              })}
            </div>
          </div>
        )}

        {lines.length > 0 && (
          <div className="bill-sheet" aria-label={t('Bill items', 'बिल का सामान', 'Bill ka saaman')}>
            <div className="sheet-head hide-mobile">
              <span className="grow">{t('Item', 'सामान', 'Saaman')}</span>
              <span style={{ width: 132, textAlign: 'center' }}>{t('Qty', 'मात्रा', 'Qty')}</span>
              <span style={{ width: 100, textAlign: 'right' }}>{t('Rate', 'भाव', 'Rate')}</span>
              <span style={{ width: 100, textAlign: 'right' }}>{t('Amount', 'रकम', 'Rakam')}</span>
              <span style={{ width: 36 }} />
            </div>
            {lines.map((l) => (
              <div key={l.product.id} className={`sheet-line ${l.qty > l.product.stock_qty ? 'is-over' : ''}`}>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="ellipsis" style={{ fontWeight: 500 }}>{l.product.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {l.qty > l.product.stock_qty ? <span className="money-owed">{t(`only ${l.product.stock_qty} in stock`, `सिर्फ़ ${l.product.stock_qty} स्टॉक में`, `sirf ${l.product.stock_qty} stock me`)}</span> : `${fmtQty(l.product.stock_qty - l.qty)} ${l.product.unit} ${t('left after this', 'बचेगा', 'bachega')}`}
                    {gstOn && l.product.gst_rate > 0 ? ` · GST ${l.product.gst_rate}%` : ''}
                    {specialMap.has(l.product.id)
                      ? <span style={{ marginLeft: 8 }}>{t('Special rate', 'खास भाव', 'Special rate')} {rupees(specialMap.get(l.product.id)!)}</span>
                      : l.product.wholesale_price != null && (
                        <span style={{ marginLeft: 8, verticalAlign: 'middle' }}>
                          <Segmented<Tier> label={t('Price tier — retail or wholesale', 'भाव — खुदरा या थोक', 'Price tier — retail ya wholesale')} value={l.tier} onChange={(v) => setTierAt(l.product.id, v)} options={[
                            { value: 'retail', label: rupees(l.product.sell_price), title: t('Retail price', 'खुदरा भाव', 'Retail price') },
                            { value: 'wholesale', label: rupees(l.product.wholesale_price), title: t('Wholesale price', 'थोक भाव', 'Wholesale price') }
                          ]} />
                        </span>
                      )}
                  </div>
                </div>
                <div className="stepper">
                  <button aria-label={t('One less', 'एक कम', 'Ek kam')} onClick={() => setQtyAt(l.product.id, l.qty - 1)}><Minus size={14} /></button>
                  <input className="num" inputMode="decimal" value={l.qty} aria-label={t('Quantity', 'मात्रा', 'Qty')}
                    onChange={(e) => { const v = Number(e.target.value.replace(/[^\d.]/g, '')); if (Number.isFinite(v)) setLines((ls) => ls.map((x) => (x.product.id === l.product.id ? { ...x, qty: v } : x))); }}
                    onBlur={(e) => { if (!(Number(e.target.value) > 0)) setQtyAt(l.product.id, 0); }} />
                  <button aria-label={t('One more', 'एक और', 'Ek aur')} onClick={() => setQtyAt(l.product.id, l.qty + 1)}><Plus size={14} /></button>
                </div>
                <input className="input input-num pos-rate hide-mobile" inputMode="decimal" value={l.price} aria-label={t('Rate', 'भाव', 'Rate')}
                  onChange={(e) => setPriceAt(l.product.id, Number(e.target.value.replace(/[^\d.]/g, '')) || 0)} />
                <span className="num sheet-amt">{rupees(round2(l.qty * l.price))}</span>
                <IconButton size="sm" label={t('Remove', 'हटाएं', 'Hatao')} onClick={() => setQtyAt(l.product.id, 0)}><Trash2 size={15} /></IconButton>
              </div>
            ))}
          </div>
        )}
      </div>

      {mobile ? (
        <>
          {lines.length > 0 && (
            <div className="pos-mobile-bar">
              <div className="grow">
                <div className="muted" style={{ fontSize: 12 }}>{lines.length} {t('items', 'सामान', 'saaman')}{customer ? ` · ${customer.name}` : ''}</div>
                <div className="num" style={{ fontSize: 22, fontWeight: 600 }}>{rupees(total)}</div>
              </div>
              <Button variant="primary" size="lg" onClick={() => setPayOpen(true)}>{t('Charge', 'पैसे लें', 'Paise lo')}</Button>
            </div>
          )}
          <Modal open={payOpen} onClose={() => setPayOpen(false)} label={t('Payment', 'भुगतान', 'Payment')}>
            <div style={{ padding: 16, overflowY: 'auto' }}>{summary}</div>
          </Modal>
        </>
      ) : (
        <aside className="pos-side">{summary}</aside>
      )}

      <CustomerPicker open={custOpen} onClose={() => { setCustOpen(false); setTimeout(() => searchRef.current?.focus(), 0); }}
        customers={customers.data?.customers || []} onPick={(c) => { setCustomer(c); setCustOpen(false); setTimeout(() => searchRef.current?.focus(), 0); }} />

      <QuickAddItem open={quickOpen} initialName={q.trim()} onClose={() => setQuickOpen(false)}
        onCreated={(p) => { setQuickOpen(false); add(p); }} />
    </div>
  );

  function BillDone({ inv, onNew }: { inv: Invoice; onNew: () => void }) {
    const [wa, setWa] = useState(false);
    const [askPhone, setAskPhone] = useState(false);
    const [phoneVal, setPhoneVal] = useState('');
    const infoRef = useRef<{ shop: string; balance: number; pdfUrl?: string } | null>(null);

    // WhatsApp par bill bhejo — seedha customer ki chat khulti hai, message
    // text ready milta hai, bas Send dabana hai. Text-only: wa.me se file
    // attach nahi ho sakti, isliye message me bill ki public PDF link hoti
    // hai — customer tap kare to PDF khul jati hai, bina login ke.
    const share = async () => {
      setWa(true);
      try {
        const d = await get<{ business: { name: string }; customer: { phone?: string } | null; net_pending: number }>(`/api/invoices/${inv.id}`);
        const shop = d.business.name || 'BizYour';
        const balance = d.net_pending ?? inv.pending_amount;
        const phone = d.customer?.phone || '';
        // Public PDF link for the message (best-effort: the share still
        // works without it if the link fetch fails).
        let pdfUrl: string | undefined;
        try { pdfUrl = await fetchBillPdfUrl(inv.id); } catch { pdfUrl = undefined; }
        infoRef.current = { shop, balance, pdfUrl };
        const msg = billShareMessage(t, { shop, customerName: inv.customer_name, billNo: inv.bill_no, total: inv.total, balance, attached: false, pdfUrl });
        if (hasPhone(phone)) {
          openWa(phone, msg);
        } else {
          setAskPhone(true);
        }
      } catch (e) { toast({ text: err(e), tone: 'error' }); } finally { setWa(false); }
    };
    const sendToNumber = () => {
      const info = infoRef.current;
      if (!info) return;
      const msg = billShareMessage(t, { shop: info.shop, customerName: inv.customer_name, billNo: inv.bill_no, total: inv.total, balance: info.balance, attached: false, pdfUrl: info.pdfUrl });
      if (openWa(phoneVal, msg)) {
        setAskPhone(false);
      } else {
        toast({ text: t('Enter a valid mobile number', 'सही मोबाइल नंबर लिखें', 'Sahi mobile number likho'), tone: 'error' });
      }
    };
    return (
      <div className="pos-done">
        <div className="done-card">
          <div className="done-tick"><Check size={28} strokeWidth={2.5} /></div>
          <h1>{t(`Bill #${inv.bill_no} saved`, `बिल #${inv.bill_no} सेव हुआ`, `Bill #${inv.bill_no} save hua`)}</h1>
          <p className="done-amt num">{rupees(inv.total)}</p>
          <p className="muted">
            {inv.customer_name}
            {inv.pending_amount > 0 ? <> · <Money value={inv.pending_amount} tone="owed" /> {t('on udhaar', 'उधार', 'udhaar')}</> : <> · {t('paid', 'चुकता', 'paid')} {inv.payment_mode ? `(${inv.payment_mode})` : ''}</>}
          </p>
          <div className="done-actions">
            <Button variant="primary" size="lg" onClick={share} loading={wa}>{t('Send bill on WhatsApp', 'WhatsApp पर बिल भेजें', 'WhatsApp par bill bhejo')}</Button>
            <Button size="lg" onClick={onNew} autoFocus><Plus size={18} /> {t('Next bill', 'अगला बिल', 'Agla bill')}</Button>
            <Button size="lg" onClick={() => openBillPdf(inv.id, inv.bill_no).catch(() => nav(`/bills/${inv.id}`))}><Printer size={18} /> {t('Print / PDF', 'प्रिंट / PDF', 'Print / PDF')}</Button>
          </div>
          {askPhone && (
            <div className="stack" style={{ gap: 8, marginTop: 14, textAlign: 'left' }}>
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>{t('No mobile number on this bill. Enter the customer’s number to send the bill on WhatsApp.', 'इस बिल पर मोबाइल नंबर नहीं है। ग्राहक का नंबर लिखें।', 'Is bill par mobile number nahi hai. Customer ka number likho.')}</p>
              <div className="row" style={{ gap: 8 }}>
                <Input inputMode="tel" placeholder="98XXXXXXXX" value={phoneVal} onChange={(e) => setPhoneVal(e.target.value)} autoFocus />
                <Button variant="primary" onClick={sendToNumber}>{t('Open WhatsApp', 'WhatsApp खोलें', 'WhatsApp kholo')}</Button>
              </div>
            </div>
          )}
          <Link to={`/bills/${inv.id}`} className="muted" style={{ fontSize: 13 }}>{t('Open bill', 'बिल खोलें', 'Bill kholo')}</Link>
        </div>
      </div>
    );
  }
}

function CustomerPicker({ open, onClose, customers, onPick }: { open: boolean; onClose: () => void; customers: Customer[]; onPick: (c: Customer) => void }) {
  const { t, err } = useI18n();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const [phone, setPhone] = useState('');
  const [adding, setAdding] = useState(false);
  const [addMode, setAddMode] = useState(false);
  useEffect(() => { if (open) { setQ(''); setPhone(''); setHi(0); setAddMode(false); } }, [open]);
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return customers.filter((c) => !term || c.name.toLowerCase().includes(term) || (c.phone || '').includes(term)).slice(0, 8);
  }, [q, customers]);
  useEffect(() => setHi(0), [q]);
  const exact = customers.some((c) => c.name.toLowerCase() === q.trim().toLowerCase());
  const create = async () => {
    if (!q.trim()) return;
    setAdding(true);
    try {
      const r = await post<{ customer: Customer }>('/api/customers', { name: q.trim(), phone: phone.trim() });
      qc.invalidateQueries({ queryKey: ['customers'] });
      onPick({ ...r.customer, pending: r.customer.pending || 0 });
    } catch (e) { alert(err(e)); } finally { setAdding(false); }
  };
  return (
    <Modal open={open} onClose={onClose} className="cmdk" label={t('Choose customer', 'ग्राहक चुनें', 'Customer chuno')}>
      <div className="cmdk-input">
        <UserRound size={18} className="muted" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Customer name or mobile', 'ग्राहक का नाम या mobile', 'Customer ka naam ya mobile')}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(list.length - 1, h + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
            else if (e.key === 'Enter') { e.preventDefault(); if (list[hi]) onPick(list[hi]); else create(); }
          }} />
      </div>
      <div className="cmdk-list">
        {list.map((c, i) => (
          <button key={c.id} className="cmdk-item" aria-selected={i === hi} onMouseMove={() => setHi(i)} onClick={() => onPick(c)}>
            <UserRound size={16} /> <span className="ellipsis">{c.name}</span>
            <span className="hint">{c.pending > 0 ? <span className="money-owed">{t('owes', 'बाकी', 'baaki')} {rupees(c.pending)}</span> : c.phone}</span>
          </button>
        ))}
        {(q.trim() && !exact) || addMode ? (
          <div style={{ padding: 12, borderTop: list.length ? '1px solid var(--line)' : 0, display: 'grid', gap: 10 }}>
            <div className="muted" style={{ fontSize: 13 }}>{q.trim()
              ? <>{t('New customer', 'नया ग्राहक', 'Naya customer')}: <b style={{ color: 'var(--ink)' }}>{q.trim()}</b></>
              : t('New customer — type the name in the box above', 'नया ग्राहक — ऊपर वाले box में नाम लिखें', 'Naya customer — upar wale box me naam likho')}</div>
            <div className="row">
              <Input placeholder={t('Mobile (for WhatsApp reminders)', 'Mobile (WhatsApp के लिए)', 'Mobile (WhatsApp ke liye)')} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Button variant="primary" onClick={create} loading={adding} disabled={!q.trim()}>{t('Add', 'जोड़ें', 'Jodo')}</Button>
              {addMode && <Button onClick={() => setAddMode(false)} disabled={adding}>{t('Cancel', 'रद्द', 'Cancel')}</Button>}
            </div>
          </div>
        ) : (
          <button className="cmdk-item" onClick={() => setAddMode(true)}>
            <Plus size={16} /> <span className="ellipsis">{t('Add new customer', 'नया ग्राहक जोड़ें', 'Naya customer jodo')}</span>
            <span className="hint">{t('Name + mobile, right here', 'नाम + mobile, यहीं से', 'Naam + mobile, yahin se')}</span>
          </button>
        )}
      </div>
    </Modal>
  );
}

function QuickAddItem({ open, initialName, onClose, onCreated }: { open: boolean; initialName: string; onClose: () => void; onCreated: (p: BillingProduct) => void }) {
  const { t, err } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const [sell, setSell] = useState('');
  const [buy, setBuy] = useState('');
  const [stock, setStock] = useState('');
  const [unit, setUnit] = useState('pack');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setName(initialName); setSell(''); setBuy(''); setStock(''); setUnit('pack'); } }, [open, initialName ]);
  const create = async () => {
    const sellN = Number(sell);
    if (!name.trim() || !(sellN > 0) || busy) return;
    setBusy(true);
    try {
      const stockVal = stock.trim() === '' ? 1 : Math.max(0, Number(stock) || 0);
      const r = await post<{ product: Record<string, unknown> }>('/api/products', {
        name: name.trim(), sell_price: sellN, buy_price: Number(buy) > 0 ? Number(buy) : sellN,
        stock_qty: stockVal, unit, gst_rate: 0
      });
      const p = r.product || {};
      qc.invalidateQueries({ queryKey: ['billing-products'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      toast({ text: t(`${name.trim()} saved to stock and added to this bill.`, `${name.trim()} stock में save होकर बिल में जुड़ गया।`, `${name.trim()} stock me save hokar bill me jud gaya.`) });
      onCreated({
        id: Number(p.id), name: String(p.name || name.trim()), unit: String(p.unit || unit),
        sell_price: Number(p.sell_price ?? sellN), wholesale_price: null, gst_rate: Number(p.gst_rate ?? 0),
        stock_qty: Number((p.stock_qty as number) ?? (p.stock as number) ?? stockVal)
      });
    } catch (e) { toast({ text: err(e), tone: 'error' }); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} label={t('New item', 'नया सामान', 'Naya saaman')}>
      <div className="stack" style={{ gap: 12, padding: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{t('Add a new item', 'नया सामान जोड़ें', 'Naya saaman jodo')}</h2>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>{t('Saved in your stock right away, and added to this bill — no need to open Products first.', 'Turant aapke stock me save hoga aur is bill me jud jayega — pehle Products kholne ki jarurat nahi.', 'Turant aapke stock me save hoga aur is bill me jud jayega — pehle Products kholne ki jarurat nahi.')}</p>
        <Field label={t('Item name', 'सामान का नाम', 'Saaman ka naam')}>{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoFocus />}</Field>
        <div className="row" style={{ gap: 10 }}>
          <Field label={t('Selling price ₹', 'बेचने का दाम ₹', 'Bechne ka daam ₹')}>{(id) => <Input id={id} inputMode="decimal" value={sell} onChange={(e) => setSell(e.target.value)} />}</Field>
          <Field label={t('Buying price ₹ (optional)', 'खरीद दाम ₹ (chaaho to)', 'Khareed daam ₹ (chaaho to)')}>{(id) => <Input id={id} inputMode="decimal" value={buy} onChange={(e) => setBuy(e.target.value)} />}</Field>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <Field label={t('Stock now (blank = 1)', 'अभी stock (khaali = 1)', 'Abhi stock (khaali = 1)')}>{(id) => <Input id={id} inputMode="decimal" value={stock} onChange={(e) => setStock(e.target.value)} />}</Field>
          <Field label={t('Unit', 'इकाई', 'Unit')}>{(id) => <Select id={id} value={unit} onChange={(e) => setUnit(e.target.value)}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</Select>}</Field>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose} disabled={busy}>{t('Cancel', 'रद्द', 'Cancel')}</Button>
          <Button variant="primary" onClick={create} loading={busy} disabled={!name.trim() || !(Number(sell) > 0)}>{t('Add to bill', 'बिल में जोड़ें', 'Bill me jodo')}</Button>
        </div>
      </div>
    </Modal>
  );
}
