import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, UserPlus, Users } from 'lucide-react';
import { get, post, put } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { initials, rupees } from '../lib/format';
import type { Customer } from '../lib/types';
import { Button, Drawer, Empty, Field, Input, Money, SkelRows, Tabs, useToast } from '../components/ui';
import { ExportMenu } from '../components/ExportMenu';
import { PageHeader, useIsMobile, usePageTitle } from '../components/shell/AppShell';

type F = 'all' | 'owes';

export default function CustomersPage() {
  const { t } = useI18n();
  const nav = useNavigate();
  const mobile = useIsMobile();
  const [sp, setSp] = useSearchParams();
  usePageTitle(t('Customers', 'ग्राहक', 'Customers'));
  const [tab, setTab] = useState<F>(sp.get('filter') === 'owes' ? 'owes' : 'all');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(sp.get('new') === '1');
  const c = useQuery({ queryKey: ['customers'], queryFn: () => get<{ customers: Customer[] }>('/api/customers') });
  const all = c.data?.customers || [];
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
          <ExportMenu path="/api/export/customers" name="customers" />
          <Button variant="primary" icon={<UserPlus size={16} />} onClick={() => setAdding(true)}>{t('Add customer', 'ग्राहक जोड़ें', 'Customer jodo')}</Button>
        </>}
      />
      <section className="panel">
        <div style={{ padding: '0 16px' }}>
          <Tabs<F> label={t('Filter', 'छांटें', 'Filter')} value={tab} onChange={setTab} tabs={[
            { value: 'all', label: t('Everyone', 'सभी', 'Sab'), count: all.length },
            { value: 'owes', label: t('Owe you money', 'जिनसे लेना है', 'Jinse lena hai'), count: owers }
          ]} />
        </div>
        <div className="toolbar"><div className="input-wrap"><Search size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Name or mobile', 'नाम या mobile', 'Naam ya mobile')} /></div></div>
        {c.isLoading ? <SkelRows rows={8} /> : !rows.length ? (
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

export function CustomerForm({ open, onClose, onSaved, initial }: { open: boolean; onClose: () => void; onSaved?: (id: number) => void; initial?: Customer }) {
  const { t, err } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ name: '', phone: '', city: '', gstin: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (open) { setF({ name: initial?.name || '', phone: initial?.phone || '', city: initial?.city || '', gstin: initial?.gstin || '' }); setError(''); }
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
        <button type="submit" hidden />
      </form>
    </Drawer>
  );
}
