import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Copy, IndianRupee, Link2, MessageCircle, MessageSquare, PencilLine, Phone, Plus, RefreshCw, Trash2, Unlink } from 'lucide-react';
import { API_BASE, del, get, post } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { dateLabel, daysFromToday, rupees, smsUrl } from '../lib/format';
import type { Customer, Invoice } from '../lib/types';
import { BillStatusBadge, Button, Drawer, Modal, Money, SkelRows, useToast } from '../components/ui';
import { usePageTitle } from '../components/shell/AppShell';
import { PaymentDrawer } from './BillDetail';
import { CustomerForm } from './Customers';

// A customer page is the digital khata: what they owe, every bill, and the
// three ways to get paid — record a payment (vasuli, spread across the oldest
// bills first by the server), remind on WhatsApp, or share a live hisab link.

interface Detail { customer: Customer; invoices: Invoice[] }

export default function CustomerDetailPage() {
  const { id } = useParams();
  const { t, err } = useI18n();
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
        </div>
        <div className="khata-actions">
          <Button variant="primary" size="lg" icon={<IndianRupee size={18} />} disabled={c.pending <= 0} onClick={() => setPay(true)}>{t('Record payment', 'भुगतान दर्ज करें', 'Payment likho')}</Button>
          <Button size="lg" icon={<MessageCircle size={18} />} disabled={c.pending <= 0 || !c.phone} onClick={remind} title={!c.phone ? t('Add a mobile number first', 'पहले मोबाइल नंबर जोड़ें', 'Pehle mobile number jodo') : undefined}>{t('Remind on WhatsApp', 'WhatsApp पर याद दिलाएं', 'WhatsApp pe yaad dilao')}</Button>
          <Button size="lg" icon={<Link2 size={18} />} onClick={() => openHisab(false)}>{t('Share hisab link', 'हिसाब link भेजें', 'Hisaab link bhejo')}</Button>
        </div>
      </section>

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

      <PaymentDrawer open={pay} onClose={() => setPay(false)} max={c.pending} title={`${t('Payment from', 'भुगतान —', 'Payment —')} ${c.name}`}
        note={t('applied to the oldest bills first', 'सबसे पुराने बिल में पहले जुड़ेगा', 'sabse purane bill me pehle judega')}
        onSave={async (amount, mode, date) => {
          const r = await post<{ allocations: { bill_no: number; amount: number }[] }>(`/api/customers/${id}/vasuli`, { amount, mode, date });
          const n = r.allocations?.length || 0;
          toast({ text: t(`${rupees(amount)} received — applied to ${n} bill${n === 1 ? '' : 's'}`, `${rupees(amount)} मिला — ${n} बिल में जुड़ा`, `${rupees(amount)} mila — ${n} bill me juda`) });
          refresh();
        }} />

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
