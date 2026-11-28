import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, MessageSquare, RotateCcw, Search, UserPlus, Users } from 'lucide-react';
import { ApiError, get, post, put } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';
import { initials, rupees, smsUrl } from '../lib/format';
import { openWa } from '../lib/shareBill';
import type { Customer } from '../lib/types';
import { Button, Drawer, Empty, Field, Input, Money, Select, SkelRows, Tabs, useToast } from '../components/ui';
import { ExportMenu } from '../components/ExportMenu';
import { ImportButton } from '../components/ImportData';
import { PageHeader, useIsMobile, usePageTitle } from '../components/shell/AppShell';
import { PlanLockCard } from '../components/PlanLock';

type F = 'all' | 'owes' | 'reminders' | 'deleted';
interface Reminder { id: number; name: string; phone: string; pending: number; oldest_due_date: string | null; bill_count: number }
interface KhataUsage { month: string; used: number; limit: number | null; plan: string; remaining: number | null }

export default function CustomersPage() {
  const { t } = useI18n();
  const { me } = useSession();
  const nav = useNavigate();
  const mobile = useIsMobile();
  const [sp, setSp] = useSearchParams();
  usePageTitle(t('Customers', 'ग्राहक', 'Customers'));
  const [tab, setTab] = useState<F>(sp.get('filter') === 'owes' ? 'owes' : 'all');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(sp.get('new') === '1');
  const c = useQuery({ queryKey: ['customers'], queryFn: () => get<{ customers: Customer[] }>('/api/customers') });
  const all = c.data?.customers || [];
  // 12-features pack: semi-auto reminders (Everything plan) + deleted
  // customers with restore (Everything plan) + the free-plan khata meter.
  const rem = useQuery({
    queryKey: ['reminders'],
    queryFn: () => get<{ reminders: Reminder[] }>('/api/customers/reminders'),
    enabled: tab === 'reminders'
  });
  const delQ = useQuery({
    queryKey: ['customers-deleted'],
    queryFn: () => get<{ customers: Customer[] }>('/api/customers?deleted_only=1'),
    enabled: tab === 'deleted'
  });
  const usage = useQuery({ queryKey: ['khata-usage'], queryFn: () => get<KhataUsage>('/api/customers/khata-usage') });
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return all
      .filter((x) => (tab === 'owes' ? x.pending > 0 : true))
      .filter((x) => !term || x.name.toLowerCase().includes(term) || (x.phone || '').includes(term))
      .sort((a, b) => (tab === 'owes' ? b.pending - a.pending : a.name.localeCompare(b.name)));
  }, [all, q, tab]);
  const owed = all.reduce((s, x) => s + Math.max(0, x.pending), 0);
  const owers = all.filter((x) => x.pending > 0).length;

  return (
    <div className="page">
      <PageHeader
        title={t('Customers & udhaar', 'ग्राहक और उधार', 'Customers aur udhaar')}
        sub={c.data ? <>{t('To collect', 'वसूली बाकी', 'Vasooli baaki')} <Money value={owed} tone={owed ? 'owed' : undefined} /> {t(`from ${owers} of ${all.length} customers`, `${all.length} में से ${owers} ग्राहकों से`, `${all.length} me se ${owers} customers se`)}</> : ' '}
        actions={<>
          <ImportButton types={['customers']} />
          <ExportMenu path="/api/export/customers" name="customers" />
          <Button variant="primary" icon={<UserPlus size={16} />} onClick={() => setAdding(true)}>{t('Add customer', 'ग्राहक जोड़ें', 'Customer jodo')}</Button>
        </>}
      />
      {usage.data?.limit != null && (
        <div className="banner banner-info" style={{ marginBottom: 16 }}>
          <span className="grow">{t(`Udhaar entries this month: ${usage.data.used}/${usage.data.limit}`, `इस महीने उधार entries: ${usage.data.used}/${usage.data.limit}`, `Is mahine udhaar entries: ${usage.data.used}/${usage.data.limit}`)}</span>
          <span className="collect-bar" style={{ width: 120 }}><i style={{ width: `${Math.min(100, (usage.data.used / usage.data.limit) * 100)}%` }} /></span>
          {usage.data.remaining != null && usage.data.remaining <= 10 && <span>{t(`${usage.data.remaining} left — upgrade for unlimited`, `${usage.data.remaining} बाकी — unlimited के लिए upgrade करें`, `${usage.data.remaining} baaki — unlimited ke liye upgrade karo`)}</span>}
        </div>
      )}
      <section className="panel">
        <div style={{ padding: '0 16px' }}>
          <Tabs<F> label={t('Filter', 'छांटें', 'Filter')} value={tab} onChange={setTab} tabs={[
            { value: 'all', label: t('Everyone', 'सभी', 'Sab'), count: all.length },
            { value: 'owes', label: t('Owe you money', 'जिनसे लेना है', 'Jinse lena hai'), count: owers },
            { value: 'reminders', label: t('Reminders', 'Reminder', 'Reminders'), count: rem.data?.reminders.length },
            { value: 'deleted', label: t('Deleted', 'हटाए हुए', 'Deleted'), count: delQ.data?.customers.length }
          ]} />
        </div>
        {tab !== 'reminders' && tab !== 'deleted' && (
        <div className="toolbar"><div className="input-wrap"><Search size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Name or mobile', 'नाम या mobile', 'Naam ya mobile')} /></div></div>
        )}
        {tab === 'reminders' ? <RemindersPanel shop={me?.business?.name || 'BizYour'} />
          : tab === 'deleted' ? <DeletedPanel />
          : c.isLoading ? <SkelRows rows={8} /> : !rows.length ? (
          <Empty icon={<Users size={28} />} title={tab === 'owes' ? t('Nobody owes you money', 'किसी से कुछ लेना नहीं', 'Kisi se kuch lena nahi') : t('No customers yet', 'अभी कोई ग्राहक नहीं', 'Abhi koi customer nahi')}
            body={tab === 'owes' ? undefined : t('Add customers to track udhaar and send WhatsApp reminders.', 'उधार और WhatsApp reminder के लिए ग्राहक जोड़ें।', 'Udhaar aur WhatsApp reminder ke liye customer jodo.')} />
        ) : mobile ? (
          <div className="list">{rows.map((x) => (
            <Link key={x.id} to={`/customers/${x.id}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="avatar">{initials(x.name)}</span>
              <div className="grow" style={{ minWidth: 0 }}><div className="title ellipsis">{x.name}</div><div className="meta">{x.phone || '—'}</div></div>
              {x.pending > 0 ? <Money value={x.pending} tone="owed" /> : <span className="meta">{t('Settled', 'हिसाब साफ़', 'Hisaab saaf')}</span>}
            </Link>
          ))}</div>
        ) : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>{t('Customer', 'ग्राहक', 'Customer')}</th><th>{t('Mobile', 'मोबाइल', 'Mobile')}</th><th className="r">{t('Total billed', 'कुल बिल', 'Kul bill')}</th><th className="r">{t('Received', 'मिला', 'Mila')}</th><th className="r">{t('To collect', 'लेना है', 'Lena hai')}</th></tr></thead>
            <tbody>{rows.map((x) => (
              <tr key={x.id} className="clickable" tabIndex={0} onClick={() => nav(`/customers/${x.id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`/customers/${x.id}`)}>
                <td><span className="row" style={{ gap: 10 }}><span className="avatar">{initials(x.name)}</span><span className="primary">{x.name}</span></span></td>
                <td className="num muted">{x.phone || '—'}</td>
                <td className="r num">{rupees(x.total_billed)}</td>
                <td className="r num">{rupees(x.total_received)}</td>
                <td className="r">{x.pending > 0 ? <Money value={x.pending} tone="owed" /> : <span className="muted">—</span>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
      <CustomerForm open={adding} onClose={() => { setAdding(false); if (sp.get('new')) { sp.delete('new'); setSp(sp, { replace: true }); } }} onSaved={(id) => nav(`/customers/${id}`)} />
    </div>
  );
}

// 12-features pack: semi-auto reminders — customers with pending udhaar,
// oldest first, one-tap WhatsApp + SMS each. Nothing is auto-sent; every
// message opens with the text ready and the owner presses send.
function RemindersPanel({ shop }: { shop: string }) {
  const { t, err } = useI18n();
  const toast = useToast();
  const rem = useQuery({ queryKey: ['reminders'], queryFn: () => get<{ reminders: Reminder[] }>('/api/customers/reminders') });
  if (rem.isLoading) return <SkelRows rows={5} />;
  if (rem.error instanceof ApiError && rem.error.status === 403) return <div style={{ padding: 16 }}><PlanLockCard need="everything" feature={t('Udhaar reminders', 'उधार reminder', 'Udhaar reminders')} /></div>;
  if (rem.error) return <p className="muted" style={{ padding: 16 }}>{err(rem.error)}</p>;
  const rows = rem.data?.reminders || [];
  if (!rows.length) return <Empty icon={<Users size={28} />} title={t('Nobody owes you money', 'किसी से कुछ लेना नहीं', 'Kisi se kuch lena nahi')} />;
  const msgFor = (r: Reminder) => t(
    `Namaste ${r.name} ji, this is ${shop} — your udhaar of ${rupees(r.pending)} is still pending. Please pay when you can. Thank you!`,
    `नमस्ते ${r.name} जी, ${shop} की ओर से — आपका ${rupees(r.pending)} उधार अभी बाकी है। जब हो सके, दे दीजिए। धन्यवाद!`,
    `Namaste ${r.name} ji, ${shop} se — aapka ${rupees(r.pending)} udhaar abhi baaki hai. Jab ho sake, de dijiye. Dhanyavaad!`);
  return (
    <div className="list">{rows.map((r) => (
      <div key={r.id} className="list-row">
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="title ellipsis">{r.name}</div>
          <div className="meta">{r.phone || '—'}{r.oldest_due_date ? ` · ${t('oldest due', 'सबसे पुराना बाकी', 'sabse purana baaki')} ${r.oldest_due_date}` : ''} · {r.bill_count} {t('bills', 'बिल', 'bill')}</div>
        </div>
        <Money value={r.pending} tone="owed" />
        <Button size="sm" icon={<MessageCircle size={14} />} disabled={!r.phone} onClick={() => { if (!openWa(r.phone, msgFor(r))) toast({ text: t('No mobile number for this customer', 'इस ग्राहक का mobile number नहीं है', 'Is customer ka mobile number nahi hai'), tone: 'error' }); }}>{t('WhatsApp', 'WhatsApp', 'WhatsApp')}</Button>
        <Button size="sm" icon={<MessageSquare size={14} />} disabled={!r.phone} onClick={() => { const u = smsUrl(r.phone, msgFor(r)); if (u) window.location.href = u; }}>SMS</Button>
      </div>
    ))}</div>
  );
}

// 12-features pack: soft-deleted customers, with a Restore button.
function DeletedPanel() {
  const { t, err } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['customers-deleted'], queryFn: () => get<{ customers: Customer[] }>('/api/customers?deleted_only=1') });
  if (q.isLoading) return <SkelRows rows={5} />;
  if (q.error instanceof ApiError && q.error.status === 403) return <div style={{ padding: 16 }}><PlanLockCard need="everything" feature={t('Restore deleted customers', 'हटाए ग्राहक वापस लाएं', 'Deleted customers restore')} /></div>;
  if (q.error) return <p className="muted" style={{ padding: 16 }}>{err(q.error)}</p>;
  const rows = q.data?.customers || [];
  if (!rows.length) return <Empty icon={<Users size={28} />} title={t('No deleted customers', 'कोई हटाया ग्राहक नहीं', 'Koi hataya customer nahi')} />;
  return (
    <div className="list">{rows.map((x) => (
      <div key={x.id} className="list-row">
        <span className="avatar">{initials(x.name)}</span>
        <div className="grow" style={{ minWidth: 0 }}><div className="title ellipsis">{x.name}</div><div className="meta">{x.phone || '—'}</div></div>
        <Button size="sm" icon={<RotateCcw size={14} />} onClick={async () => {
          try {
            await post(`/api/customers/${x.id}/restore`);
            qc.invalidateQueries({ queryKey: ['customers'] });
            qc.invalidateQueries({ queryKey: ['customers-deleted'] });
            toast({ text: t(`${x.name} restored`, `${x.name} वापस आ गया`, `${x.name} wapas aa gaya`) });
          } catch (e) { toast({ text: err(e), tone: 'error' }); }
        }}>{t('Restore', 'वापस लाएं', 'Restore')}</Button>
      </div>
    ))}</div>
  );
}

export function CustomerForm({ open, onClose, onSaved, initial }: { open: boolean; onClose: () => void; onSaved?: (id: number) => void; initial?: Customer }) {
  const { t, err } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ name: '', phone: '', city: '', gstin: '', credit_limit: '', price_tier: 'retail' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (open) { setF({ name: initial?.name || '', phone: initial?.phone || '', city: initial?.city || '', gstin: initial?.gstin || '', credit_limit: initial?.credit_limit != null ? String(initial.credit_limit) : '', price_tier: initial?.price_tier || 'retail' }); setError(''); }
  }, [open, initial]);
  const submit = async () => {
    if (!f.name.trim()) { setError(t('Write the customer’s name.', 'ग्राहक का नाम लिखें।', 'Customer ka naam likho.')); return; }
    setBusy(true); setError('');
    try {
      let id = initial?.id;
      if (initial) await put(`/api/customers/${initial.id}`, f);
      else { const r = await post<{ customer: Customer }>('/api/customers', f); id = r.customer.id; }
      qc.invalidateQueries({ queryKey: ['customers'] });
      if (id) qc.invalidateQueries({ queryKey: ['customer', String(id)] });
      toast({ text: initial ? t('Customer updated', 'ग्राहक बदला', 'Customer update hua') : t('Customer added', 'ग्राहक जुड़ा', 'Customer juda') });
      onClose();
      if (id && onSaved) onSaved(id);
    } catch (e) { setError(err(e)); } finally { setBusy(false); }
  };
  return (
    <Drawer open={open} onClose={onClose} title={initial ? t('Edit customer', 'ग्राहक बदलें', 'Customer badlo') : t('Add customer', 'ग्राहक जोड़ें', 'Customer jodo')}
      footer={<><Button onClick={onClose}>{t('Close', 'बंद', 'Band')}</Button><Button variant="primary" loading={busy} onClick={submit}>{initial ? t('Save changes', 'बदलाव सेव करें', 'Badlav save karo') : t('Add customer', 'ग्राहक जोड़ें', 'Customer jodo')}</Button></>}>
      <form className="stack" style={{ gap: 16 }} onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label={t('Name', 'नाम', 'Naam')} error={error}>{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />}</Field>
        <Field label={t('Mobile', 'मोबाइल', 'Mobile')} hint={t('Needed for WhatsApp bills and reminders.', 'WhatsApp बिल और reminder के लिए।', 'WhatsApp bill aur reminder ke liye.')}>{(id) => <Input id={id} inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />}</Field>
        <Field label={t('City', 'शहर', 'Shehar')}>{(id) => <Input id={id} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />}</Field>
        <Field label="GSTIN" hint={t('Only for business customers.', 'सिर्फ़ business ग्राहक के लिए।', 'Sirf business customer ke liye.')}>{(id) => <Input id={id} value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} />}</Field>
        <Field label={t('Credit limit ₹ (optional)', 'क्रेडिट लिमिट ₹ (अगर हो)', 'Credit limit ₹ (optional)')} hint={t('Warns on a new bill when this customer crosses it — never blocks.', 'नए बिल पर चेतावनी देगा जब यह ग्राहक पार करे — रोकता नहीं।', 'Naye bill par warning dega jab ye customer paar kare — rokta nahi.')}>{(id) => <Input id={id} numeric inputMode="decimal" value={f.credit_limit} onChange={(e) => setF({ ...f, credit_limit: e.target.value.replace(/[^\d.]/g, '') })} />}</Field>
        <Field label={t('Default price tier', 'डिफ़ॉल्ट भाव', 'Default price tier')} hint={t('New bills for this customer start at this tier.', 'इस ग्राहक के नए बिल इसी भाव से शुरू होंगे।', 'Is customer ke naye bill isi bhaav se shuru honge.')}>{(id) => <Select id={id} value={f.price_tier} onChange={(e) => setF({ ...f, price_tier: e.target.value })}><option value="retail">{t('Retail', 'खुदरा', 'Retail')}</option><option value="wholesale">{t('Wholesale', 'थोक', 'Wholesale')}</option></Select>}</Field>
        <button type="submit" hidden />
      </form>
    </Drawer>
  );
}
