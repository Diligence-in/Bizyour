import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Copy, IndianRupee, Link2, MessageCircle, MessageSquare, PencilLine, Phone, Plus, RefreshCw, Trash2, Unlink } from 'lucide-react';
import { API_BASE, del, get, post } from '../lib/api';
import { openWa } from '../lib/shareBill';
import { useI18n } from '../lib/i18n';
import { usePlan, useSession } from '../lib/session';
import { dateLabel, daysFromToday, rupees, smsUrl, todayStr } from '../lib/format';
import type { Customer, Invoice, Product } from '../lib/types';
import { BillStatusBadge, Button, Drawer, Field, Input, Modal, Money, Select, SkelRows, useToast } from '../components/ui';
import { usePageTitle } from '../components/shell/AppShell';
import { PaymentDrawer } from './BillDetail';
import { CustomerForm } from './Customers';
import { PlanLockCard } from '../components/PlanLock';

// A customer page is the digital khata: what they owe, every bill, and the
// three ways to get paid — record a payment (vasuli, spread across the oldest
// bills first by the server), remind on WhatsApp, or share a live hisab link.

interface Detail { customer: Customer; invoices: Invoice[] }

export default function CustomerDetailPage() {
  const { id } = useParams();
  const { t, err } = useI18n();
  const { me } = useSession();
  const toast = useToast();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['customer', id], queryFn: () => get<Detail>(`/api/customers/${id}`) });
  const [pay, setPay] = useState(false);
  const [edit, setEdit] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  const [hisab, setHisab] = useState<string | null>(null);
  const [hisabOpen, setHisabOpen] = useState(false);
  // 12-features pack: manual khata entry ("udhaar diya") + one-tap update
  // messages after a payment or a khata entry (manual wa.me, never auto).
  const [khataOpen, setKhataOpen] = useState(false);
  const [khataAmount, setKhataAmount] = useState('');
  const [khataDate, setKhataDate] = useState(todayStr());
  const [khataBusy, setKhataBusy] = useState(false);
  const [khataErr, setKhataErr] = useState('');
  const [updateNote, setUpdateNote] = useState<{ kind: 'payment' | 'khata'; amount: number } | null>(null);
  const d = q.data;
  usePageTitle(d?.customer.name || t('Customer', 'ग्राहक', 'Customer'));

  if (q.isLoading) return <div className="page"><SkelRows rows={10} /></div>;
  if (!d) return <div className="page"><p>{err(q.error)}</p></div>;
  const c = d.customer;
  const words = { today: t('Today', 'आज', 'Aaj'), yesterday: t('Yesterday', 'कल', 'Kal') };
  const open = d.invoices.filter((i) => i.pending_amount > 0 && !i.cancelled).sort((a, b) => a.date.localeCompare(b.date));
  const oldestDue = open.map((i) => i.due_date).filter(Boolean).sort()[0] as string | undefined;
  const late = oldestDue ? -daysFromToday(oldestDue) : 0;

  const refresh = () => ['customer', 'customers', 'invoices', 'dash-summary', 'alerts', 'day-end'].forEach((k) => qc.invalidateQueries({ queryKey: k === 'customer' ? ['customer', id] : [k] }));

  const remind = async () => {
    try { const r = await get<{ url: string }>(`/api/customers/${id}/reminder-link`); window.open(r.url, '_blank', 'noopener'); }
    catch (e) { toast({ text: err(e), tone: 'error' }); }
  };
  const fullUrl = (path: string) => (API_BASE || window.location.origin) + path;
  const openHisab = async (regenerate = false) => {
    try {
      const r = await post<{ url_path: string }>(`/api/customers/${id}/hisab-link${regenerate ? '/regenerate' : ''}`);
      setHisab(fullUrl(r.url_path)); setHisabOpen(true); refresh();
    } catch (e) { toast({ text: err(e), tone: 'error' }); }
  };

  const hisabMsg = hisab ? t(`Hello ${c.name}, you can see your full account here (bills, payments and balance): ${hisab}`, `नमस्ते ${c.name} जी, अपना पूरा हिसाब यहां देखें (बिल, भुगतान और बाकी): ${hisab}`, `Namaste ${c.name} ji, apna poora hisaab yahan dekho (bill, payment aur baaki): ${hisab}`) : '';

  return (
    <div className="page">
      <Link to="/customers" className="back-link"><ArrowLeft size={14} /> {t('Customers', 'ग्राहक', 'Customers')}</Link>
      <header className="page-head">
        <div className="grow">
          <h1>{c.name}</h1>
          <p className="page-sub row" style={{ gap: 12, flexWrap: 'wrap' }}>
            {c.phone ? <a href={`tel:${c.phone}`} className="row" style={{ gap: 4 }}><Phone size={13} /> {c.phone}</a> : <span>{t('No mobile number', 'मोबाइल नहीं', 'Mobile nahi')}</span>}
            {c.city && <span>{c.city}</span>}
            {c.gstin && <span>GSTIN {c.gstin}</span>}
          </p>
        </div>
        <div className="page-actions">
          <Button icon={<PencilLine size={16} />} onClick={() => setEdit(true)}>{t('Edit', 'बदलें', 'Badlo')}</Button>
          <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setDelOpen(true)}>{t('Delete', 'हटाएं', 'Hatao')}</Button>
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => nav('/pos')}>{t('New bill', 'नया बिल', 'Naya bill')}</Button>
        </div>
      </header>

      <section className="khata">
        <div className="khata-figure">
          <span className="strip-label">{c.pending > 0 ? t('Owes you', 'आपको देना है', 'Aapko dena hai') : t('Account settled', 'हिसाब साफ़', 'Hisaab saaf')}</span>
          <Money value={c.pending} tone={c.pending > 0 ? 'owed' : undefined} className="khata-amount" />
          <span className="strip-note">
            {c.pending > 0 && oldestDue ? (late > 0 ? t(`Oldest due ${late} days ago`, `सबसे पुराना ${late} दिन पहले देय था`, `Sabse purana ${late} din pehle due tha`) : t(`Next due ${dateLabel(oldestDue, words)}`, `अगली तारीख ${dateLabel(oldestDue, words)}`, `Agli tareekh ${dateLabel(oldestDue, words)}`)) : `${t('Billed', 'कुल बिल', 'Kul bill')} ${rupees(c.total_billed)} · ${t('received', 'मिला', 'mila')} ${rupees(c.total_received)}`}
          </span>
          {c.credit_limit != null && (
            <span className="strip-note">
              {t('Credit limit', 'क्रेडिट लिमिट', 'Credit limit')} {rupees(c.credit_limit)} · {c.pending > c.credit_limit
                ? t('over limit', 'लिमिट से ऊपर', 'limit se upar')
                : t(`${rupees(Math.max(0, c.credit_limit - c.pending))} headroom`, `${rupees(Math.max(0, c.credit_limit - c.pending))} बाकी`, `${rupees(Math.max(0, c.credit_limit - c.pending))} baaki`)}
            </span>
          )}
        </div>
        <div className="khata-actions">
          <Button variant="primary" size="lg" icon={<IndianRupee size={18} />} disabled={c.pending <= 0} onClick={() => setPay(true)}>{t('Record payment', 'भुगतान दर्ज करें', 'Payment likho')}</Button>
          <Button size="lg" icon={<Plus size={18} />} onClick={() => { setKhataAmount(''); setKhataDate(todayStr()); setKhataErr(''); setKhataOpen(true); }}>{t('Udhaar diya', 'उधार दिया', 'Udhaar diya')}</Button>
          <Button size="lg" icon={<MessageCircle size={18} />} disabled={c.pending <= 0 || !c.phone} onClick={remind} title={!c.phone ? t('Add a mobile number first', 'पहले मोबाइल नंबर जोड़ें', 'Pehle mobile number jodo') : undefined}>{t('Remind on WhatsApp', 'WhatsApp पर याद दिलाएं', 'WhatsApp pe yaad dilao')}</Button>
          <Button size="lg" icon={<Link2 size={18} />} onClick={() => openHisab(false)}>{t('Share hisab link', 'हिसाब link भेजें', 'Hisaab link bhejo')}</Button>
        </div>
      </section>

      {updateNote && (
        <div className="banner banner-info" style={{ marginBottom: 16 }}>
          <span className="grow">
            {updateNote.kind === 'payment'
              ? t(`${rupees(updateNote.amount)} received from ${c.name}. New balance ${rupees(c.pending)}.`, `${rupees(updateNote.amount)} ${c.name} से मिला। नया बाकी ${rupees(c.pending)}।`, `${rupees(updateNote.amount)} ${c.name} se mila. Naya baaki ${rupees(c.pending)}.`)
              : t(`${rupees(updateNote.amount)} udhaar added to ${c.name}’s khata. New balance ${rupees(c.pending)}.`, `${c.name} के खाते में ${rupees(updateNote.amount)} उधार जुड़ा। नया बाकी ${rupees(c.pending)}।`, `${c.name} ke khate me ${rupees(updateNote.amount)} udhaar juda. Naya baaki ${rupees(c.pending)}.`)}
          </span>
          <Button size="sm" icon={<MessageCircle size={14} />} disabled={!c.phone} onClick={() => {
            const shop = me?.business?.name || 'BizYour';
            const msg = updateNote.kind === 'payment'
              ? t(`Namaste ${c.name} ji, this is ${shop} — your payment of ${rupees(updateNote.amount)} is received. Thank you! Balance now: ${rupees(c.pending)}.`, `नमस्ते ${c.name} जी, ${shop} की ओर से — आपका ${rupees(updateNote.amount)} भुगतान मिल गया। धन्यवाद! अब बाकी: ${rupees(c.pending)}।`, `Namaste ${c.name} ji, ${shop} se — aapka ${rupees(updateNote.amount)} payment mil gaya. Dhanyavaad! Ab baaki: ${rupees(c.pending)}.`)
              : t(`Namaste ${c.name} ji, this is ${shop} — ${rupees(updateNote.amount)} udhaar is added to your khata. Total pending now: ${rupees(c.pending)}.`, `नमस्ते ${c.name} जी, ${shop} की ओर से — आपके खाते में ${rupees(updateNote.amount)} उधार जुड़ा। कुल बाकी अब: ${rupees(c.pending)}।`, `Namaste ${c.name} ji, ${shop} se — aapke khate me ${rupees(updateNote.amount)} udhaar juda. Kul baaki ab: ${rupees(c.pending)}.`);
            if (!openWa(c.phone, msg)) toast({ text: t('No mobile number for this customer', 'इस ग्राहक का mobile number नहीं है', 'Is customer ka mobile number nahi hai'), tone: 'error' });
          }}>{t('Tell them on WhatsApp', 'WhatsApp पर बताएं', 'WhatsApp pe batao')}</Button>
          <Button size="sm" variant="ghost" onClick={() => setUpdateNote(null)}>{t('Dismiss', 'हटाएं', 'Hatao')}</Button>
        </div>
      )}

      <section className="panel">
        <header className="panel-head"><h2>{t('Bills', 'बिल', 'Bills')}</h2><span className="muted num" style={{ fontSize: 13 }}>{d.invoices.length}</span></header>
        {!d.invoices.length ? <p className="muted" style={{ padding: 16 }}>{t('No bills for this customer yet.', 'इस ग्राहक का कोई बिल नहीं।', 'Is customer ka koi bill nahi.')}</p> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>{t('Bill', 'बिल', 'Bill')}</th><th>{t('Date', 'तारीख', 'Date')}</th><th className="r">{t('Total', 'कुल', 'Kul')}</th><th className="r hide-mobile">{t('Paid', 'मिला', 'Mila')}</th><th className="r">{t('Unpaid', 'बाकी', 'Baaki')}</th><th className="hide-mobile">{t('Status', 'स्थिति', 'Status')}</th></tr></thead>
            <tbody>{d.invoices.map((b) => (
              <tr key={b.id} className="clickable" tabIndex={0} onClick={() => nav(`/bills/${b.id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`/bills/${b.id}`)}>
                <td className="num primary">{b.kind === 'opening' ? t('Opening', 'पुराना', 'Purana') : `#${b.bill_no}`}</td>
                <td>{dateLabel(b.date, words)}</td>
                <td className="r num">{rupees(b.total)}</td>
                <td className="r num hide-mobile">{rupees(b.paid_amount)}</td>
                <td className="r">{b.pending_amount > 0 && !b.cancelled ? <Money value={b.pending_amount} tone="owed" /> : <span className="muted">—</span>}</td>
                <td className="hide-mobile"><BillStatusBadge status={b.status} cancelled={b.cancelled} overdue={!!b.due_date && b.pending_amount > 0 && daysFromToday(b.due_date) < 0} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <SpecialRates customerId={id!} />

      <PaymentDrawer open={pay} onClose={() => setPay(false)} max={c.pending} title={`${t('Payment from', 'भुगतान —', 'Payment —')} ${c.name}`}
        note={t('applied to the oldest bills first', 'सबसे पुराने बिल में पहले जुड़ेगा', 'sabse purane bill me pehle judega')}
        onSave={async (amount, mode, date) => {
          const r = await post<{ allocations: { bill_no: number; amount: number }[] }>(`/api/customers/${id}/vasuli`, { amount, mode, date });
          const n = r.allocations?.length || 0;
          toast({ text: t(`${rupees(amount)} received — applied to ${n} bill${n === 1 ? '' : 's'}`, `${rupees(amount)} मिला — ${n} बिल में जुड़ा`, `${rupees(amount)} mila — ${n} bill me juda`) });
          setUpdateNote({ kind: 'payment', amount });
          refresh();
        }} />

      <Drawer open={khataOpen} onClose={() => setKhataOpen(false)} title={t('Udhaar diya — no bill', 'उधार दिया — बिना बिल', 'Udhaar diya — bina bill')}
        footer={<><Button onClick={() => setKhataOpen(false)}>{t('Close', 'बंद', 'Band')}</Button><Button variant="primary" loading={khataBusy} disabled={!(Number(khataAmount) > 0)} onClick={async () => {
          setKhataBusy(true); setKhataErr('');
          try {
            await post(`/api/customers/${id}/khata`, { amount: Number(khataAmount), date: khataDate });
            toast({ text: t(`${rupees(Number(khataAmount))} udhaar added to ${c.name}’s khata`, `${c.name} के खाते में ${rupees(Number(khataAmount))} उधार जुड़ा`, `${c.name} ke khate me ${rupees(Number(khataAmount))} udhaar juda`) });
            setUpdateNote({ kind: 'khata', amount: Number(khataAmount) });
            setKhataOpen(false);
            refresh();
          } catch (e) { setKhataErr(err(e)); } finally { setKhataBusy(false); }
        }}>{t('Add to khata', 'खाते में जोड़ें', 'Khate me jodo')}</Button></>}>
        <div className="stack" style={{ gap: 16 }}>
          <p className="muted" style={{ margin: 0 }}>{t('Record credit given without a bill — it shows in the khata like an opening balance and can be collected with Vasuli. No items, no stock, no GST.', 'बिना बिल के उधार लिखें — खाते में पुराने बाकी की तरह दिखेगा और Vasuli से वसूला जा सकता है। कोई सामान नहीं, stock नहीं, GST नहीं।', 'Bina bill ke udhaar likho — khate me purane baaki ki tarah dikhega aur Vasuli se vasoola ja sakta hai. Koi saaman nahi, stock nahi, GST nahi.')}</p>
          <Field label={t('Amount ₹', 'रकम ₹', 'Rakam ₹')} error={khataErr}>{(fid) => <Input id={fid} numeric inputMode="decimal" value={khataAmount} onChange={(e) => setKhataAmount(e.target.value.replace(/[^\d.]/g, ''))} autoFocus />}</Field>
          <Field label={t('Date', 'तारीख', 'Date')}>{(fid) => <Input id={fid} type="date" value={khataDate} onChange={(e) => setKhataDate(e.target.value)} />}</Field>
        </div>
      </Drawer>

      <CustomerForm open={edit} onClose={() => setEdit(false)} initial={c} />

      <Drawer open={hisabOpen} onClose={() => setHisabOpen(false)} title={t('Hisab link', 'हिसाब link', 'Hisaab link')}>
        <div className="stack" style={{ gap: 16 }}>
          <p className="muted">{t(`Anyone with this link can see ${c.name}’s bills, payments and balance — nothing else. Turn it off any time.`, `इस link से कोई भी ${c.name} के बिल, भुगतान और बाकी देख सकता है — और कुछ नहीं। कभी भी बंद करें।`, `Is link se koi bhi ${c.name} ke bill, payment aur baaki dekh sakta hai — aur kuch nahi. Kabhi bhi band karo.`)}</p>
          <div className="copy-box"><span className="ellipsis grow num" style={{ fontSize: 13 }}>{hisab}</span>
            <Button size="sm" icon={<Copy size={14} />} onClick={() => { navigator.clipboard?.writeText(hisab || ''); toast({ text: t('Link copied', 'Link copy हुआ', 'Link copy hua') }); }}>{t('Copy', 'कॉपी', 'Copy')}</Button>
          </div>
          {c.phone && hisab && (
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <a className="btn btn-primary" target="_blank" rel="noopener" href={`https://wa.me/${c.phone.replace(/\D/g, '').replace(/^0/, '').replace(/^(\d{10})$/, '91$1')}?text=${encodeURIComponent(hisabMsg)}`}>
                <MessageCircle size={16} /> {t('Send on WhatsApp', 'WhatsApp पर भेजें', 'WhatsApp pe bhejo')}
              </a>
              <a className="btn" href={smsUrl(c.phone, hisabMsg)}>
                <MessageSquare size={16} /> {t('Send by SMS', 'SMS से भेजें', 'SMS se bhejo')}
              </a>
            </div>
          )}
          <div className="row" style={{ gap: 8 }}>
            <Button size="sm" icon={<RefreshCw size={14} />} onClick={() => openHisab(true)}>{t('New link (old one stops)', 'नया link (पुराना बंद)', 'Naya link (purana band)')}</Button>
            <Button size="sm" variant="danger" icon={<Unlink size={14} />} onClick={async () => { try { await del(`/api/customers/${id}/hisab-link`); setHisabOpen(false); refresh(); toast({ text: t('Link turned off', 'Link बंद हुआ', 'Link band hua') }); } catch (e) { toast({ text: err(e), tone: 'error' }); } }}>{t('Turn off', 'बंद करें', 'Band karo')}</Button>
          </div>
        </div>
      </Drawer>

      <Modal open={delOpen} onClose={() => setDelOpen(false)} label={t('Delete customer', 'ग्राहक हटाएं', 'Customer hatao')}>
        <div className="stack" style={{ gap: 12 }}>
          <p>{t(`Delete ${c.name}? This cannot be undone.`, `${c.name} को हटाएं? यह वापस नहीं होगा।`, `${c.name} ko hatao? Ye wapas nahi hoga.`)}</p>
          <p className="muted">{t('A customer with any bill — even a cancelled one — cannot be deleted, so past bills and reports stay correct. To remove such a customer, cancel their bills first.', 'जिस ग्राहक का कोई भी बिल बना है — रद्द वाला भी — वह हटाया नहीं जा सकता, ताकि पुराने बिल और रिपोर्ट सही रहें। ऐसे ग्राहक को हटाना है तो पहले उसके बिल रद्द करें।', 'Jis customer ka koi bhi bill bana hai — cancel wala bhi — wo hataya nahi ja sakta, taaki purane bill aur report sahi rahen. Aise customer ko hatana hai to pehle uske bill cancel karo.')}</p>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => setDelOpen(false)}>{t('Keep', 'रखें', 'Rakho')}</Button>
            <Button variant="danger" loading={delBusy} onClick={async () => {
              setDelBusy(true);
              try {
                await del(`/api/customers/${id}`);
                setDelOpen(false);
                toast({ text: t(`${c.name} deleted`, `${c.name} हट गया`, `${c.name} hat gaya`) });
                nav('/customers');
              } catch (e) {
                const m = String((e as Error)?.message || '');
                toast({ text: m.includes('customer_has_invoices') ? t(`${c.name} has bills, so this customer cannot be deleted. Cancel their bills first.`, `${c.name} के बिल हैं, इसलिए यह ग्राहक हटाया नहीं जा सकता। पहले उसके बिल रद्द करें।`, `${c.name} ke bill hain, isliye ye customer hataya nahi ja sakta. Pehle uske bill cancel karo.`) : err(e), tone: 'error' });
              } finally { setDelBusy(false); }
            }}>{t('Delete customer', 'ग्राहक हटाएं', 'Customer hatao')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// 12-features pack: per-customer-per-product special rates. On a bill, a
// special rate beats the tier price (see Pos resolveRate). Billing plan and
// above; free-plan shops see the upgrade note instead of the editor.
function SpecialRates({ customerId }: { customerId: string }) {
  const { t, err } = useI18n();
  const plan = usePlan();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['special-rates', customerId], queryFn: () => get<{ prices: { product_id: number; product_name: string; price: number }[] }>(`/api/customers/${customerId}/prices`) });
  const prods = useQuery({ queryKey: ['products'], queryFn: () => get<{ products: Product[] }>('/api/products') });
  const [prodId, setProdId] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  if (plan === 'free') return (
    <section className="panel">
      <header className="panel-head"><h2>{t('Special rates', 'खास भाव', 'Special rates')}</h2></header>
      <div style={{ padding: 16 }}><PlanLockCard need="billing" feature={t('Special rates', 'खास भाव', 'Special rates')} /></div>
    </section>
  );
  const rows = q.data?.prices || [];
  return (
    <section className="panel">
      <header className="panel-head"><h2>{t('Special rates', 'खास भाव', 'Special rates')}</h2><span className="muted" style={{ fontSize: 13 }}>{t('One price per item, just for this customer — beats the tier price on bills.', 'हर सामान का एक भाव, सिर्फ़ इस ग्राहक के लिए — बिल पर tier भाव से ऊपर।', 'Har saaman ka ek bhaav, sirf is customer ke liye — bill par tier bhaav se upar.')}</span></header>
      {q.isLoading ? <div style={{ padding: 16 }}><SkelRows rows={3} /></div> : rows.length === 0 ? (
        <p className="muted" style={{ padding: '0 16px' }}>{t('No special rates yet.', 'अभी कोई खास भाव नहीं।', 'Abhi koi khaas bhaav nahi.')}</p>
      ) : (
        <div className="list">{rows.map((r) => (
          <div key={r.product_id} className="list-row">
            <div className="grow" style={{ minWidth: 0 }}><div className="title ellipsis">{r.product_name}</div></div>
            <Money value={r.price} />
            <button className="icon-btn icon-btn-sm" aria-label={t('Remove', 'हटाएं', 'Hatao')} onClick={async () => {
              try {
                await del(`/api/customers/${customerId}/prices/${r.product_id}`);
                qc.invalidateQueries({ queryKey: ['special-rates', customerId] });
              } catch (e) { toast({ text: err(e), tone: 'error' }); }
            }}><Trash2 size={15} /></button>
          </div>
        ))}</div>
      )}
      <div className="panel-body row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Select value={prodId} onChange={(e) => setProdId(e.target.value)} style={{ flex: '2 1 160px' }}>
          <option value="">{t('Pick a product…', 'सामान चुनें…', 'Saaman chuno…')}</option>
          {(prods.data?.products || []).map((p) => <option key={p.id} value={p.id}>{p.name} · {rupees(p.sell_price)}</option>)}
        </Select>
        <Input numeric inputMode="decimal" placeholder={t('Rate ₹', 'भाव ₹', 'Rate ₹')} value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} style={{ flex: '1 1 90px' }} />
        <Button variant="primary" loading={busy} disabled={!prodId || !(Number(price) > 0)} onClick={async () => {
          setBusy(true);
          try {
            await post(`/api/customers/${customerId}/prices`, { product_id: Number(prodId), price: Number(price) });
            setPrice(''); setProdId('');
            qc.invalidateQueries({ queryKey: ['special-rates', customerId] });
            toast({ text: t('Rate saved', 'भाव सेव हुआ', 'Bhaav save hua') });
          } catch (e) { toast({ text: err(e), tone: 'error' }); } finally { setBusy(false); }
        }}>{t('Save rate', 'भाव सेव करें', 'Bhaav save karo')}</Button>
      </div>
    </section>
  );
}
