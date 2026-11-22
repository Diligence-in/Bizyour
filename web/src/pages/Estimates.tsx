import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, MessageCircle, Plus, Tags, Trash2 } from 'lucide-react';
import { get, post } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';
import { dateLabel, qty as fmtQty, round2, rupees, todayStr } from '../lib/format';
import type { BillingProduct, Customer } from '../lib/types';
import { Badge, Button, Drawer, Empty, Field, Input, Select, SkelRows, useToast } from '../components/ui';
import { PageHeader, useIsMobile, usePageTitle } from '../components/shell/AppShell';

// An estimate (quotation) is a price promise: it does not touch stock or
// udhaar. Converting it makes a real bill through the normal billing path.
interface Estimate { id: number; customer_name: string; estimate_no: number; date: string; subtotal: number; discount: number; gst_enabled: boolean; gst_amount: number; total: number; status: 'open' | 'converted'; converted_invoice_id: number | null }
interface EItem { id: number; product_name: string; qty: number; sell_price: number; amount: number }

export default function EstimatesPage() {
  const { t } = useI18n();
  const mobile = useIsMobile();
  usePageTitle(t('Estimates', 'एस्टीमेट', 'Estimate'));
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const q = useQuery({ queryKey: ['estimates'], queryFn: () => get<{ estimates: Estimate[] }>('/api/estimates') });
  const rows = q.data?.estimates || [];
  const words = { today: t('Today', 'आज', 'Aaj'), yesterday: t('Yesterday', 'कल', 'Kal') };
  const badge = (e: Estimate) => e.status === 'converted' ? <Badge tone="in">{t('Billed', 'बिल बना', 'Bill bana')}</Badge> : <Badge tone="info">{t('Open', 'खुला', 'Khula')}</Badge>;
  return (
    <div className="page">
      <PageHeader title={t('Estimates', 'एस्टीमेट', 'Estimate')} sub={t('Quote a price first. Turn it into a bill when the customer says yes.', 'पहले भाव बताएं। ग्राहक हाँ कहे तो बिल बना दें।', 'Pehle bhaav batao. Customer haan kahe to bill bana do.')}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>{t('New estimate', 'नया एस्टीमेट', 'Naya estimate')}</Button>} />
      <section className="panel">
        {q.isLoading ? <SkelRows rows={5} /> : !rows.length ? (
          <Empty icon={<Tags size={28} />} title={t('No estimates yet', 'अभी कोई एस्टीमेट नहीं', 'Abhi koi estimate nahi')} body={t('Send a quotation on WhatsApp before you bill — stock and udhaar stay untouched until you convert it.', 'बिल से पहले WhatsApp पर कोटेशन भेजें — बिल बनाने तक stock और उधार नहीं बदलते।', 'Bill se pehle WhatsApp par quotation bhejo — bill banne tak stock aur udhaar nahi badalte.')}
            action={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>{t('New estimate', 'नया एस्टीमेट', 'Naya estimate')}</Button>} />
        ) : mobile ? (
          <div className="list">{rows.map((e) => (
            <button key={e.id} className="list-row" onClick={() => setOpenId(e.id)}>
              <div className="grow" style={{ minWidth: 0 }}><div className="title ellipsis">{e.customer_name}</div><div className="meta">#{e.estimate_no} · {dateLabel(e.date, words)}</div></div>
              <div style={{ textAlign: 'right' }}><div className="num" style={{ fontWeight: 500 }}>{rupees(e.total)}</div>{badge(e)}</div>
            </button>))}</div>
        ) : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>#</th><th>{t('Date', 'तारीख', 'Date')}</th><th>{t('Customer', 'ग्राहक', 'Customer')}</th><th className="r">{t('Total', 'कुल', 'Kul')}</th><th>{t('Status', 'स्थिति', 'Status')}</th></tr></thead>
            <tbody>{rows.map((e) => (
              <tr key={e.id} className="clickable" tabIndex={0} onClick={() => setOpenId(e.id)} onKeyDown={(ev) => ev.key === 'Enter' && setOpenId(e.id)}>
                <td className="num muted">{e.estimate_no}</td><td>{dateLabel(e.date, words)}</td><td className="primary">{e.customer_name}</td><td className="r num">{rupees(e.total)}</td><td>{badge(e)}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </section>
      <NewEstimate open={creating} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setOpenId(id); }} />
      <EstimateDetail id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function EstimateDetail({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { t, err } = useI18n();
  const qc = useQueryClient();
  const nav = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ['estimate', id], queryFn: () => get<{ estimate: Estimate; items: EItem[] }>(`/api/estimates/${id}`), enabled: !!id });
  const e = q.data?.estimate;
  const wa = async () => {
    try { const r = await get<{ url: string }>(`/api/estimates/${id}/whatsapp-link`); window.open(r.url, '_blank', 'noopener'); }
    catch (x) { toast({ text: err(x), tone: 'error' }); }
  };
  const convert = async () => {
    setBusy(true);
    try {
      const r = await post<{ invoice: { id: number; bill_no: number } }>(`/api/estimates/${id}/convert`);
      ['estimates', 'estimate', 'invoices', 'customers', 'products', 'billing-products', 'alerts', 'dash-summary'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast({ text: t(`Bill #${r.invoice.bill_no} made`, `बिल #${r.invoice.bill_no} बन गया`, `Bill #${r.invoice.bill_no} ban gaya`) });
      onClose(); nav(`/bills/${r.invoice.id}`);
    } catch (x) { toast({ text: err(x), tone: 'error' }); } finally { setBusy(false); }
  };
  return (
    <Drawer open={!!id} onClose={onClose} title={e ? `${t('Estimate', 'एस्टीमेट', 'Estimate')} #${e.estimate_no}` : t('Estimate', 'एस्टीमेट', 'Estimate')}
      footer={e ? <><Button icon={<MessageCircle size={16} />} onClick={wa}>{t('Send on WhatsApp', 'WhatsApp पर भेजें', 'WhatsApp par bhejo')}</Button><span className="grow" />
        {e.status === 'open' ? <Button variant="primary" loading={busy} icon={<ArrowRightLeft size={16} />} onClick={convert}>{t('Make bill', 'बिल बनाएं', 'Bill banao')}</Button>
          : e.converted_invoice_id ? <Button onClick={() => { onClose(); nav(`/bills/${e.converted_invoice_id}`); }}>{t('Open the bill', 'बिल खोलें', 'Bill kholo')}</Button> : null}</> : undefined}>
      {!q.data || !e ? <SkelRows /> : (
        <div className="stack" style={{ gap: 16 }}>
          <div><div className="title">{e.customer_name}</div><div className="meta">{e.date} · {e.status === 'converted' ? t('Already billed', 'बिल बन चुका', 'Bill ban chuka') : t('Open', 'खुला', 'Khula')}</div></div>
          <table className="table table-dense">
            <thead><tr><th>{t('Item', 'सामान', 'Saaman')}</th><th className="r">{t('Qty', 'मात्रा', 'Qty')}</th><th className="r">{t('Rate', 'भाव', 'Rate')}</th><th className="r">{t('Amount', 'रकम', 'Rakam')}</th></tr></thead>
            <tbody>{q.data.items.map((i) => <tr key={i.id}><td>{i.product_name}</td><td className="r num">{fmtQty(i.qty)}</td><td className="r num">{rupees(i.sell_price)}</td><td className="r num">{rupees(i.amount)}</td></tr>)}</tbody>
          </table>
          <div className="sum-lines">
            {e.discount > 0 && <div className="sum-line"><span>{t('Discount', 'छूट', 'Chhoot')}</span><span className="num">−{rupees(e.discount)}</span></div>}
            {e.gst_enabled && <div className="sum-line"><span>{t('GST included', 'GST शामिल', 'GST shamil')}</span><span className="num">{rupees(e.gst_amount)}</span></div>}
            <div className="sum-line total"><span>{t('Total', 'कुल', 'Kul')}</span><span className="num">{rupees(e.total)}</span></div>
          </div>
          {e.status === 'open' && <p className="muted" style={{ margin: 0 }}>{t('Making the bill checks stock and uses the prices quoted here.', 'बिल बनाते समय stock जाँचा जाएगा और यही भाव लगेंगे।', 'Bill banate samay stock jaancha jayega aur yahi bhaav lagenge.')}</p>}
        </div>
      )}
    </Drawer>
  );
}

interface Line { key: number; product_id: string; qty: string; price: string }
function NewEstimate({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  const { t, err } = useI18n();
  const { me } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const prods = useQuery({ queryKey: ['billing-products'], queryFn: () => get<{ products: BillingProduct[] }>('/api/billing-products'), enabled: open });
  const custs = useQuery({ queryKey: ['customers'], queryFn: () => get<{ customers: Customer[] }>('/api/customers'), enabled: open });
  const [customer, setCustomer] = useState(''); const [date, setDate] = useState(todayStr()); const [discount, setDiscount] = useState('');
  const [lines, setLines] = useState<Line[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (open) { setCustomer(''); setDate(todayStr()); setDiscount(''); setLines([{ key: 1, product_id: '', qty: '1', price: '' }]); setError(''); } }, [open]);
  const byId = useMemo(() => new Map((prods.data?.products || []).map((p) => [String(p.id), p])), [prods.data]);
  const sub = round2(lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0));
  const total = Math.max(0, round2(sub - (Number(discount) || 0)));
  const setLine = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const save = async () => {
    const items = lines.filter((l) => l.product_id && Number(l.qty) > 0).map((l) => ({ product_id: Number(l.product_id), qty: Number(l.qty), price: Number(l.price) || 0 }));
    if (!items.length) { setError(t('Add at least one item with a quantity.', 'कम से कम एक सामान और मात्रा डालें।', 'Kam se kam ek saaman aur qty daalo.')); return; }
    setBusy(true); setError('');
    try {
      const r = await post<{ estimate: { id: number; estimate_no: number } }>('/api/estimates', { customer_id: customer ? Number(customer) : undefined, date, discount: Number(discount) || 0, items });
      qc.invalidateQueries({ queryKey: ['estimates'] });
      toast({ text: t(`Estimate #${r.estimate.estimate_no} saved`, `एस्टीमेट #${r.estimate.estimate_no} सेव`, `Estimate #${r.estimate.estimate_no} save`) });
      onCreated(r.estimate.id);
    } catch (e) { setError(err(e)); } finally { setBusy(false); }
  };
  return (
    <Drawer open={open} onClose={onClose} wide title={t('New estimate', 'नया एस्टीमेट', 'Naya estimate')}
      footer={<><span className="grow muted">{t('Total', 'कुल', 'Kul')} <b className="num" style={{ color: 'var(--ink)', fontSize: 16 }}>{rupees(total)}</b>{me?.business?.gst_enabled && <span style={{ marginLeft: 8 }}>{t('(GST included in rates)', '(भाव में GST शामिल)', '(bhaav me GST shamil)')}</span>}</span><Button onClick={onClose}>{t('Close', 'बंद', 'Band')}</Button><Button variant="primary" loading={busy} onClick={save}>{t('Save estimate', 'एस्टीमेट सेव करें', 'Estimate save karo')}</Button></>}>
      <div className="stack" style={{ gap: 18 }}>
        <div className="form-2">
          <Field label={t('Customer', 'ग्राहक', 'Customer')}>{(id) => <Select id={id} value={customer} onChange={(e) => setCustomer(e.target.value)}><option value="">{t('Walk-in', 'वॉक-इन', 'Walk-in')}</option>{(custs.data?.customers || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}</Field>
          <Field label={t('Date', 'तारीख', 'Date')}>{(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        </div>
        <div>
          <div className="field-label" style={{ marginBottom: 8 }}>{t('Items', 'सामान', 'Saaman')}</div>
          <div className="stack" style={{ gap: 8 }}>
            {lines.map((l) => (
              <div key={l.key} className="pur-line">
                <Select value={l.product_id} aria-label={t('Product', 'सामान', 'Saaman')} onChange={(e) => { const p = byId.get(e.target.value); setLine(l.key, { product_id: e.target.value, price: p ? String(p.sell_price) : l.price }); }}>
                  <option value="">{t('Choose product', 'सामान चुनें', 'Saaman chuno')}</option>
                  {(prods.data?.products || []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </Select>
                <Input numeric inputMode="decimal" placeholder={t('Qty', 'मात्रा', 'Qty')} aria-label={t('Quantity', 'मात्रा', 'Qty')} value={l.qty} onChange={(e) => setLine(l.key, { qty: e.target.value.replace(/[^\d.]/g, '') })} />
                <Input numeric inputMode="decimal" placeholder="₹" aria-label={t('Rate', 'भाव', 'Rate')} value={l.price} onChange={(e) => setLine(l.key, { price: e.target.value.replace(/[^\d.]/g, '') })} />
                <span className="num pur-amt">{rupees((Number(l.qty) || 0) * (Number(l.price) || 0))}</span>
                <button className="icon-btn icon-btn-sm" aria-label={t('Remove', 'हटाएं', 'Hatao')} onClick={() => setLines((ls) => ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls)}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" icon={<Plus size={14} />} style={{ marginTop: 8 }} onClick={() => setLines((ls) => [...ls, { key: Date.now(), product_id: '', qty: '1', price: '' }])}>{t('Add item', 'सामान जोड़ें', 'Saaman jodo')}</Button>
        </div>
        <div className="form-2"><Field label={t('Discount ₹', 'छूट ₹', 'Chhoot ₹')} hint={t('Optional', 'चाहें तो', 'Agar chaho')}>{(id) => <Input id={id} numeric inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^\d.]/g, ''))} />}</Field></div>
        {error && <div className="banner banner-owed" role="alert">{error}</div>}
      </div>
    </Drawer>
  );
}
