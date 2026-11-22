import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, MessageCircle, Minus, Plus, Printer, Search, Trash2, UserRound, X } from 'lucide-react';
import { get, post } from '../lib/api';
import { billShareMessage, downloadBlob, fetchBillPdf, hasPhone, openWa, tryShareFile } from '../lib/shareBill';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';
import { gstPart, qty as fmtQty, round2, rupees } from '../lib/format';
import type { BillingProduct, Customer, Invoice } from '../lib/types';
import { Button, Field, IconButton, Input, Modal, Money, Segmented, useToast } from '../components/ui';
import { useIsMobile, usePageTitle } from '../components/shell/AppShell';

// The counter. Built for two people at once:
//  - a first-time shopkeeper on a phone: big search, tap +/−, one green button;
//  - a fast operator at a desk: type → Enter adds, ↑↓ picks, C = customer,
//    F2–F5 = payment mode, Ctrl+Enter saves, Esc clears.
// Maths mirrors the server exactly (GST-inclusive, discount off the total);
// the server recomputes everything on save, so the screen can never
// disagree with the stored bill.

type Mode = 'Cash' | 'UPI' | 'Bank' | 'Udhaar';
interface Line { product: BillingProduct; qty: number; price: number }

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
  usePageTitle(t('New bill', 'नया बिल', 'Naya bill'));

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

  const gstOn = !!me?.business?.gst_enabled;
  const all = products.data?.products || [];
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
      return [...ls, { product: p, qty: n, price: p.sell_price }];
    });
    setQ('');
    searchRef.current?.focus();
  }, []);
  const setQtyAt = (id: number, v: number) => setLines((ls) => ls.flatMap((l) => (l.product.id !== id ? [l] : v <= 0 ? [] : [{ ...l, qty: v }])));
  const setPriceAt = (id: number, v: number) => setLines((ls) => ls.map((l) => (l.product.id === id ? { ...l, price: v } : l)));

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
            <span className="muted" style={{ fontSize: 12 }}>{customer.pending > 0 ? t(`Already owes ${rupees(customer.pending)}`, `पहले से ${rupees(customer.pending)} बाकी`, `Pehle se ${rupees(customer.pending)} baaki`) : customer.phone}</span>
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
            onChange={(e) => setReceived(e.target.value.replace(/[^\d.]/g, ''))} onFocus={(e) => e.target.select()} />}
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
            ? t(`${rupees(balance)} goes to ${customer.name}’s udhaar. New balance ${rupees(customer.pending + balance)}.`, `${rupees(balance)} ${customer.name} के उधार में जुड़ेगा। नया बाकी ${rupees(customer.pending + balance)}।`, `${rupees(balance)} ${customer.name} ke udhaar me judega. Naya baaki ${rupees(customer.pending + balance)}.`)
            : t(`${rupees(balance)} unpaid with no customer named — pick a customer so you can collect it later.`, `${rupees(balance)} बाकी है पर ग्राहक नहीं चुना — बाद में वसूली के लिए ग्राहक चुनें।`, `${rupees(balance)} baaki hai par customer nahi chuna — baad me vasooli ke liye customer chuno.`)}
        </div>
      )}

      <Button variant="primary" size="xl" block onClick={save} loading={saving} disabled={!lines.length}>
        <Check size={20} /> {balance > 0 && paid === 0 ? t('Save on udhaar', 'उधार में सेव करें', 'Udhaar me save karo') : t('Save bill', 'बिल सेव करें', 'Bill save karo')} · {rupees(total)}
      </Button>
    </div>
  );

  return (
    <div className="pos">
      <div className="pos-main">
        <div className="pos-top">
          <Link to="/" className="icon-btn" aria-label={t('Back', 'वापस', 'Wapas')}><ArrowLeft size={18} /></Link>
          <h1 className="pos-title">{t('New bill', 'नया बिल', 'Naya bill')}</h1>
          <span className="muted hide-mobile" style={{ fontSize: 13 }}>{gstOn ? t('Prices include GST', 'कीमतों में GST शामिल', 'Price me GST shaamil') : t('GST off', 'GST बंद', 'GST band')}</span>
        </div>

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
                    <span className="num" style={{ width: 80, textAlign: 'right', fontWeight: 500 }}>{rupees(p.sell_price)}</span>
                  </button>
                );
              })}
            </div>
          )}
          {q.trim() && !matches.length && products.data && (
            <div className="pos-results"><div style={{ padding: 14 }} className="muted">{t('No item with that name.', 'इस नाम का सामान नहीं।', 'Is naam ka saaman nahi.')} <Link to="/products?new=1">{t('Add it to products', 'सामान में जोड़ें', 'Saaman me jodo')}</Link></div></div>
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
                  </div>
                </div>
                <div className="stepper">
                  <button aria-label={t('One less', 'एक कम', 'Ek kam')} onClick={() => setQtyAt(l.product.id, l.qty - 1)}><Minus size={14} /></button>
                  <input className="num" inputMode="decimal" value={l.qty} aria-label={t('Quantity', 'मात्रा', 'Qty')} onFocus={(e) => e.target.select()}
                    onChange={(e) => { const v = Number(e.target.value.replace(/[^\d.]/g, '')); if (Number.isFinite(v)) setLines((ls) => ls.map((x) => (x.product.id === l.product.id ? { ...x, qty: v } : x))); }}
                    onBlur={(e) => { if (!(Number(e.target.value) > 0)) setQtyAt(l.product.id, 0); }} />
                  <button aria-label={t('One more', 'एक और', 'Ek aur')} onClick={() => setQtyAt(l.product.id, l.qty + 1)}><Plus size={14} /></button>
                </div>
                <input className="input input-num pos-rate hide-mobile" inputMode="decimal" value={l.price} aria-label={t('Rate', 'भाव', 'Rate')}
                  onChange={(e) => setPriceAt(l.product.id, Number(e.target.value.replace(/[^\d.]/g, '')) || 0)} onFocus={(e) => e.target.select()} />
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
    </div>
  );

  function BillDone({ inv, onNew }: { inv: Invoice; onNew: () => void }) {
    const [wa, setWa] = useState(false);
    const [askPhone, setAskPhone] = useState(false);
    const [phoneVal, setPhoneVal] = useState('');
    const blobRef = useRef<Blob | null>(null);
    const infoRef = useRef<{ shop: string; balance: number } | null>(null);

    // WhatsApp par bill bhejo — the PDF leaves from the shopkeeper's OWN
    // WhatsApp: share sheet with the PDF attached where supported, else
    // PDF download + wa.me with a ready message, else ask for the number.
    const share = async () => {
      setWa(true);
      try {
        const d = await get<{ business: { name: string }; customer: { phone?: string } | null; net_pending: number }>(`/api/invoices/${inv.id}`);
        const shop = d.business.name || 'BizYour';
        const balance = d.net_pending ?? inv.pending_amount;
        const phone = d.customer?.phone || '';
        const fname = `bill-${inv.bill_no}.pdf`;
        const blob = await fetchBillPdf(inv.id);
        blobRef.current = blob; infoRef.current = { shop, balance };
        const msgPdf = billShareMessage(t, { shop, customerName: inv.customer_name, billNo: inv.bill_no, total: inv.total, balance, attached: true });
        const r = await tryShareFile(blob, fname, msgPdf);
        if (r === 'shared' || r === 'cancelled') return;
        if (hasPhone(phone)) {
          downloadBlob(blob, fname);
          openWa(phone, billShareMessage(t, { shop, customerName: inv.customer_name, billNo: inv.bill_no, total: inv.total, balance, attached: false }));
          toast({ text: t('PDF downloaded — attach it in the WhatsApp chat', 'PDF डाउनलोड हुआ — WhatsApp चैट में जोड़ दें', 'PDF download hua — WhatsApp chat me jod do') });
        } else {
          setAskPhone(true);
        }
      } catch (e) { toast({ text: err(e), tone: 'error' }); } finally { setWa(false); }
    };
    const sendToNumber = () => {
      const info = infoRef.current; const blob = blobRef.current;
      if (!info || !blob) return;
      const msg = billShareMessage(t, { shop: info.shop, customerName: inv.customer_name, billNo: inv.bill_no, total: inv.total, balance: info.balance, attached: false });
      if (openWa(phoneVal, msg)) {
        downloadBlob(blob, `bill-${inv.bill_no}.pdf`);
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
            <Button variant="primary" size="lg" onClick={share} loading={wa}><MessageCircle size={18} /> {t('Send bill on WhatsApp', 'WhatsApp पर बिल भेजें', 'WhatsApp par bill bhejo')}</Button>
            <Button size="lg" onClick={onNew} autoFocus><Plus size={18} /> {t('Next bill', 'अगला बिल', 'Agla bill')}</Button>
            <Button size="lg" onClick={() => nav(`/bills/${inv.id}?print=1`)}><Printer size={18} /> {t('Print / PDF', 'प्रिंट / PDF', 'Print / PDF')}</Button>
          </div>
          {askPhone && (
            <div className="stack" style={{ gap: 8, marginTop: 14, textAlign: 'left' }}>
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>{t('No mobile number on this bill. Enter the customer’s number to send the bill on WhatsApp — the PDF will download, attach it in the chat.', 'इस बिल पर मोबाइल नंबर नहीं है। ग्राहक का नंबर लिखें — PDF डाउनलोड होगा, चैट में जोड़ दें।', 'Is bill par mobile number nahi hai. Customer ka number likho — PDF download hoga, chat me jod dena.')}</p>
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
  useEffect(() => { if (open) { setQ(''); setPhone(''); setHi(0); } }, [open]);
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
        {q.trim() && !exact && (
          <div style={{ padding: 12, borderTop: list.length ? '1px solid var(--line)' : 0, display: 'grid', gap: 10 }}>
            <div className="muted" style={{ fontSize: 13 }}>{t('New customer', 'नया ग्राहक', 'Naya customer')}: <b style={{ color: 'var(--ink)' }}>{q.trim()}</b></div>
            <div className="row">
              <Input placeholder={t('Mobile (for WhatsApp reminders)', 'Mobile (WhatsApp के लिए)', 'Mobile (WhatsApp ke liye)')} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Button variant="primary" onClick={create} loading={adding}>{t('Add', 'जोड़ें', 'Jodo')}</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
