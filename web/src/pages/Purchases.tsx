import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IndianRupee, Plus, Trash2, Truck } from 'lucide-react';
import { get, post } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';
import { dateLabel, qty as fmtQty, round2, rupees, todayStr } from '../lib/format';
import type { Product, Purchase, PurchaseItem, Supplier } from '../lib/types';
import { BillStatusBadge, Button, Drawer, Empty, Field, Input, Money, Segmented, Select, SkelRows, useToast } from '../components/ui';
import { ExportMenu } from '../components/ExportMenu';
import { PageHeader, useIsMobile, usePageTitle } from '../components/shell/AppShell';
import { PaymentDrawer } from './BillDetail';

// A purchase = stock in. Saving one raises stock through stock_movements
// (server) and adds to what you owe the supplier. It is NOT an expense —
// only goods that are later sold count against profit (COGS).

export default function PurchasesPage() {
  const { t } = useI18n();
  const { can } = useSession();
  const mobile = useIsMobile();
  const [sp, setSp] = useSearchParams();
  usePageTitle(t('Purchases', 'खरीद', 'Khareed'));
  const [creating, setCreating] = useState(sp.get('new') === '1');
  const [openId, setOpenId] = useState<number | null>(null);
  const list = useQuery({ queryKey: ['purchases'], queryFn: () => get<{ purchases: Purchase[] }>('/api/purchases') });
  const rows = list.data?.purchases || [];
  const words = { today: t('Today', 'आज', 'Aaj'), yesterday: t('Yesterday', 'कल', 'Kal') };
  const owed = rows.reduce((s, r) => s + r.pending_amount, 0);

  return (
    <div className="page">
      <PageHeader
        title={t('Purchases', 'खरीद', 'Khareed')}
        sub={list.data ? <>{t(`${rows.length} purchases · you owe suppliers`, `${rows.length} खरीद · सप्लायर को देना`, `${rows.length} khareed · supplier ko dena`)} <Money value={owed} tone={owed ? 'warn' : undefined} /></> : ' '}
        actions={<>
          {can.finance && <ExportMenu path="/api/export/purchases" name="purchases" />}
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>{t('Record purchase', 'खरीद दर्ज करें', 'Khareed likho')}</Button>
        </>}
      />
      <section className="panel">
        {list.isLoading ? <SkelRows rows={6} /> : !rows.length ? (
          <Empty icon={<Truck size={28} />} title={t('No purchases yet', 'अभी कोई खरीद नहीं', 'Abhi koi khareed nahi')} body={t('Record what you buy from suppliers — stock goes up automatically.', 'सप्लायर से खरीदा सामान दर्ज करें — stock अपने आप बढ़ेगा।', 'Supplier se khareeda saaman likho — stock apne aap badhega.')}
            action={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>{t('Record purchase', 'खरीद दर्ज करें', 'Khareed likho')}</Button>} />
        ) : mobile ? (
          <div className="list">{rows.map((r) => (
            <button key={r.id} className="list-row" onClick={() => setOpenId(r.id)}>
              <div className="grow" style={{ minWidth: 0 }}><div className="title ellipsis">{r.supplier_name}</div><div className="meta">{r.bill_no || '—'} · {dateLabel(r.date, words)}</div></div>
              <div style={{ textAlign: 'right' }}><div className="num" style={{ fontWeight: 500 }}>{rupees(r.total)}</div>{r.pending_amount > 0 && <Money value={r.pending_amount} tone="warn" className="meta" />}</div>
            </button>
          ))}</div>
        ) : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>{t('Date', 'तारीख', 'Date')}</th><th>{t('Supplier', 'सप्लायर', 'Supplier')}</th><th>{t('Their bill no.', 'उनका बिल नं.', 'Unka bill no.')}</th><th className="r">{t('Total', 'कुल', 'Kul')}</th><th className="r">{t('You owe', 'देना है', 'Dena hai')}</th><th>{t('Status', 'स्थिति', 'Status')}</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className="clickable" tabIndex={0} onClick={() => setOpenId(r.id)} onKeyDown={(e) => e.key === 'Enter' && setOpenId(r.id)}>
                <td>{dateLabel(r.date, words)}</td>
                <td className="primary">{r.supplier_name}{r.kind === 'opening' && <span className="sub">{t('Opening balance', 'पुराना बाकी', 'Purana baaki')}</span>}</td>
                <td className="num muted">{r.bill_no || '—'}</td>
                <td className="r num">{rupees(r.total)}</td>
                <td className="r">{r.pending_amount > 0 ? <Money value={r.pending_amount} tone="warn" /> : <span className="muted">—</span>}</td>
                <td><BillStatusBadge status={r.status} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
      <NewPurchase open={creating} onClose={() => { setCreating(false); if (sp.get('new')) { sp.delete('new'); setSp(sp, { replace: true }); } }} />
      <PurchaseDetail id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function PurchaseDetail({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [pay, setPay] = useState(false);
  const q = useQuery({ queryKey: ['purchase', id], queryFn: () => get<{ purchase: Purchase; items: PurchaseItem[] }>(`/api/purchases/${id}`), enabled: !!id });
  const p = q.data?.purchase;
  return (
    <>
      <Drawer open={!!id && !pay} onClose={onClose} title={p ? `${p.supplier_name}${p.bill_no ? ` · ${p.bill_no}` : ''}` : t('Purchase', 'खरीद', 'Khareed')}
        footer={p && p.pending_amount > 0 ? <Button variant="primary" icon={<IndianRupee size={16} />} onClick={() => setPay(true)}>{t('Record payment to supplier', 'सप्लायर को भुगतान', 'Supplier ko payment')}</Button> : undefined}>
        {!q.data ? <SkelRows /> : (
          <div className="stack" style={{ gap: 16 }}>
            <div className="mini-stats">
              <div><span className="strip-label">{t('Total', 'कुल', 'Kul')}</span><span className="num" style={{ fontSize: 20, fontWeight: 600 }}>{rupees(p!.total)}</span></div>
              <div><span className="strip-label">{t('Paid', 'दिया', 'Diya')}</span><span className="num" style={{ fontSize: 20, fontWeight: 600 }}>{rupees(p!.paid_amount)}</span></div>
              <div><span className="strip-label">{t('You owe', 'देना है', 'Dena hai')}</span><Money value={p!.pending_amount} tone={p!.pending_amount ? 'warn' : undefined} className="mini-big" /></div>
            </div>
            <p className="muted">{p!.date}{p!.due_date ? ` · ${t('pay by', 'देना है', 'dena hai')} ${p!.due_date}` : ''}</p>
            <table className="table table-dense">
              <thead><tr><th>{t('Item', 'सामान', 'Saaman')}</th><th className="r">{t('Qty', 'मात्रा', 'Qty')}</th><th className="r">{t('Rate', 'भाव', 'Rate')}</th><th className="r">{t('Amount', 'रकम', 'Rakam')}</th></tr></thead>
              <tbody>{q.data.items.map((i) => <tr key={i.id}><td>{i.product_name}</td><td className="r num">{fmtQty(i.qty)} {i.product_unit}</td><td className="r num">{rupees(i.buy_price)}</td><td className="r num">{rupees(i.amount)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </Drawer>
      {p && <PaymentDrawer open={pay} onClose={() => setPay(false)} max={p.pending_amount} title={`${t('Pay', 'भुगतान', 'Payment')} ${p.supplier_name}`}
        onSave={async (amount, mode, date) => {
          await post(`/api/purchases/${p.id}/payments`, { amount, mode, date });
          ['purchases', 'suppliers', 'alerts'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
          qc.invalidateQueries({ queryKey: ['purchase', id] });
          toast({ text: t(`${rupees(amount)} paid to ${p.supplier_name}`, `${p.supplier_name} को ${rupees(amount)} दिया`, `${p.supplier_name} ko ${rupees(amount)} diya`) });
        }} />}
    </>
  );
}

interface PLine { key: number; product_id: string; qty: string; buy_price: string }

function NewPurchase({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, err } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const sup = useQuery({ queryKey: ['suppliers'], queryFn: () => get<{ suppliers: Supplier[] }>('/api/suppliers'), enabled: open });
  const prods = useQuery({ queryKey: ['products'], queryFn: () => get<{ products: Product[] }>('/api/products'), enabled: open });
  const [supplierId, setSupplierId] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  const [billNo, setBillNo] = useState('');
  const [date, setDate] = useState(todayStr());
  const [lines, setLines] = useState<PLine[]>([]);
  const [paid, setPaid] = useState('');
  const [mode, setMode] = useState('Cash');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (open) { setSupplierId(''); setNewSupplier(''); setBillNo(''); setDate(todayStr()); setLines([{ key: 1, product_id: '', qty: '', buy_price: '' }]); setPaid(''); setMode('Cash'); setDue(''); setError(''); }
  }, [open]);
  const byId = useMemo(() => new Map((prods.data?.products || []).map((p) => [String(p.id), p])), [prods.data]);
  const total = round2(lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.buy_price) || 0), 0));
  const setLine = (key: number, patch: Partial<PLine>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const save = async () => {
    const items = lines.filter((l) => l.product_id && Number(l.qty) > 0).map((l) => ({ product_id: Number(l.product_id), qty: Number(l.qty), buy_price: Number(l.buy_price) || 0 }));
    if (!supplierId && !newSupplier.trim()) { setError(t('Choose a supplier.', 'सप्लायर चुनें।', 'Supplier chuno.')); return; }
    if (!items.length) { setError(t('Add at least one item with a quantity.', 'कम से कम एक सामान और मात्रा डालें।', 'Kam se kam ek saaman aur qty daalo.')); return; }
    const paidN = Math.min(total, Number(paid) || 0);
    setBusy(true); setError('');
    try {
      let sid = supplierId;
      if (!sid) { const r = await post<{ supplier: Supplier }>('/api/suppliers', { name: newSupplier.trim() }); sid = String(r.supplier.id); }
      await post('/api/purchases', { supplier_id: Number(sid), bill_no: billNo.trim(), date, items, paid_amount: paidN, paid_mode: mode, due_date: paidN < total && due ? due : undefined });
      ['purchases', 'suppliers', 'products', 'billing-products', 'alerts'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast({ text: t(`Purchase saved — stock updated for ${items.length} items`, `खरीद सेव — ${items.length} सामान का stock बढ़ा`, `Khareed save — ${items.length} saaman ka stock badha`) });
      onClose();
    } catch (e) { setError(err(e)); } finally { setBusy(false); }
  };

  return (
    <Drawer open={open} onClose={onClose} wide title={t('Record purchase', 'खरीद दर्ज करें', 'Khareed likho')}
      footer={<><span className="grow muted">{t('Total', 'कुल', 'Kul')} <b className="num" style={{ color: 'var(--ink)', fontSize: 16 }}>{rupees(total)}</b></span><Button onClick={onClose}>{t('Close', 'बंद', 'Band')}</Button><Button variant="primary" loading={busy} onClick={save}>{t('Save purchase', 'खरीद सेव करें', 'Khareed save karo')}</Button></>}>
      <div className="stack" style={{ gap: 18 }}>
        <div className="form-3">
          <Field label={t('Supplier', 'सप्लायर', 'Supplier')}>
            {(id) => <Select id={id} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">{t('New supplier…', 'नया सप्लायर…', 'Naya supplier…')}</option>
              {(sup.data?.suppliers || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>}
          </Field>
          <Field label={t('Their bill no.', 'उनका बिल नं.', 'Unka bill no.')}>{(id) => <Input id={id} value={billNo} onChange={(e) => setBillNo(e.target.value)} />}</Field>
          <Field label={t('Date', 'तारीख', 'Date')}>{(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        </div>
        {!supplierId && <Field label={t('New supplier name', 'नए सप्लायर का नाम', 'Naye supplier ka naam')}>{(id) => <Input id={id} value={newSupplier} onChange={(e) => setNewSupplier(e.target.value)} />}</Field>}

        <div>
          <div className="field-label" style={{ marginBottom: 8 }}>{t('Items', 'सामान', 'Saaman')}</div>
          <div className="stack" style={{ gap: 8 }}>
            {lines.map((l) => {
              const p = byId.get(l.product_id);
              return (
                <div key={l.key} className="pur-line">
                  <Select value={l.product_id} aria-label={t('Product', 'सामान', 'Saaman')} onChange={(e) => { const np = byId.get(e.target.value); setLine(l.key, { product_id: e.target.value, buy_price: np ? String(np.buy_price) : l.buy_price }); }}>
                    <option value="">{t('Choose product', 'सामान चुनें', 'Saaman chuno')}</option>
                    {(prods.data?.products || []).map((x) => <option key={x.id} value={x.id}>{x.name} ({fmtQty(x.stock_qty)} {x.unit})</option>)}
                  </Select>
                  <Input numeric inputMode="decimal" placeholder={t('Qty', 'मात्रा', 'Qty')} aria-label={t('Quantity', 'मात्रा', 'Qty')} value={l.qty} onChange={(e) => setLine(l.key, { qty: e.target.value.replace(/[^\d.]/g, '') })} />
                  <Input numeric inputMode="decimal" placeholder="₹" aria-label={t('Buy price', 'खरीद भाव', 'Khareed bhaav')} value={l.buy_price} onChange={(e) => setLine(l.key, { buy_price: e.target.value.replace(/[^\d.]/g, '') })} />
                  <span className="num pur-amt">{rupees((Number(l.qty) || 0) * (Number(l.buy_price) || 0))}</span>
                  <button className="icon-btn icon-btn-sm" aria-label={t('Remove', 'हटाएं', 'Hatao')} onClick={() => setLines((ls) => ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls)}><Trash2 size={15} /></button>
                  {p && <span className="pur-hint muted">{t('Stock after', 'बाद में stock', 'Baad me stock')}: {fmtQty(p.stock_qty + (Number(l.qty) || 0))} {p.unit}</span>}
                </div>
              );
            })}
          </div>
          <Button variant="ghost" size="sm" icon={<Plus size={14} />} style={{ marginTop: 8 }} onClick={() => setLines((ls) => [...ls, { key: Date.now(), product_id: '', qty: '', buy_price: '' }])}>{t('Add item', 'सामान जोड़ें', 'Saaman jodo')}</Button>
        </div>

        <div className="form-3">
          <Field label={t('Paid now ₹', 'अभी दिया ₹', 'Abhi diya ₹')}>{(id) => <Input id={id} numeric inputMode="decimal" placeholder="0" value={paid} onChange={(e) => setPaid(e.target.value.replace(/[^\d.]/g, ''))} />}</Field>
          <Field label={t('How', 'कैसे', 'Kaise')}>{() => <Segmented label="mode" value={mode} onChange={setMode} options={[{ value: 'Cash', label: t('Cash', 'नकद', 'Cash') }, { value: 'UPI', label: 'UPI' }, { value: 'Bank', label: t('Bank', 'बैंक', 'Bank') }]} />}</Field>
          {(Number(paid) || 0) < total && <Field label={t('Pay supplier by', 'सप्लायर को कब तक', 'Supplier ko kab tak')} hint={t('Optional', 'अगर तय हो', 'Agar tay ho')}>{(id) => <Input id={id} type="date" value={due} onChange={(e) => setDue(e.target.value)} />}</Field>}
        </div>
        {error && <div className="banner banner-owed" role="alert">{error}</div>}
      </div>
    </Drawer>
  );
}
