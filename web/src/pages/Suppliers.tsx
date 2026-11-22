import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Factory, Phone, Plus, Search, ShoppingCart } from 'lucide-react';
import { get, post, put } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';
import { initials, rupees } from '../lib/format';
import type { Supplier } from '../lib/types';
import { Button, Drawer, Empty, Field, Input, Money, SkelRows, useToast } from '../components/ui';
import { ExportMenu } from '../components/ExportMenu';
import { PageHeader, useIsMobile, usePageTitle } from '../components/shell/AppShell';

export default function SuppliersPage() {
  const { t } = useI18n();
  const { can } = useSession();
  const mobile = useIsMobile();
  usePageTitle(t('Suppliers', 'सप्लायर', 'Supplier'));
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Supplier | 'new' | null>(null);
  const s = useQuery({ queryKey: ['suppliers'], queryFn: () => get<{ suppliers: Supplier[] }>('/api/suppliers') });
  const all = s.data?.suppliers || [];
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return all.filter((x) => !term || x.name.toLowerCase().includes(term) || (x.phone || '').includes(term)).sort((a, b) => b.pending - a.pending || a.name.localeCompare(b.name));
  }, [all, q]);
  const owe = all.reduce((a, x) => a + x.pending, 0);

  return (
    <div className="page">
      <PageHeader
        title={t('Suppliers', 'सप्लायर', 'Supplier')}
        sub={s.data ? <>{t('You owe', 'देना है', 'Dena hai')} <Money value={owe} tone={owe ? 'warn' : undefined} /> · {t(`${all.length} suppliers`, `${all.length} सप्लायर`, `${all.length} supplier`)}</> : ' '}
        actions={<>
          {can.mart && <Link className="btn btn-secondary hide-mobile" to="/mart/browse?tab=sellers"><ShoppingCart size={16} /> {t('Find new suppliers', 'नए सप्लायर खोजें', 'Naye supplier khojo')}</Link>}
          <ExportMenu path="/api/export/suppliers" name="suppliers" />
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEdit('new')}>{t('Add supplier', 'सप्लायर जोड़ें', 'Supplier jodo')}</Button>
        </>}
      />
      <section className="panel">
        <div className="toolbar"><div className="input-wrap"><Search size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Name or mobile', 'नाम या mobile', 'Naam ya mobile')} /></div></div>
        {s.isLoading ? <SkelRows /> : !rows.length ? (
          <Empty icon={<Factory size={28} />} title={t('No suppliers yet', 'अभी कोई सप्लायर नहीं', 'Abhi koi supplier nahi')} body={t('Suppliers are added when you record a purchase, or add one here.', 'खरीद दर्ज करते समय सप्लायर जुड़ते हैं, या यहां जोड़ें।', 'Khareed likhte waqt supplier judte hain, ya yahan jodo.')} />
        ) : mobile ? (
          <div className="list">{rows.map((x) => (
            <button key={x.id} className="list-row" onClick={() => setEdit(x)}>
              <span className="avatar">{initials(x.name)}</span>
              <div className="grow" style={{ minWidth: 0 }}><div className="title ellipsis">{x.name}</div><div className="meta">{x.phone || '—'}</div></div>
              {x.pending > 0 ? <Money value={x.pending} tone="warn" /> : <span className="meta">{t('Settled', 'हिसाब साफ़', 'Hisaab saaf')}</span>}
            </button>
          ))}</div>
        ) : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>{t('Supplier', 'सप्लायर', 'Supplier')}</th><th>{t('Mobile', 'मोबाइल', 'Mobile')}</th><th className="r">{t('Bought', 'खरीदा', 'Khareeda')}</th><th className="r">{t('Paid', 'दिया', 'Diya')}</th><th className="r">{t('You owe', 'देना है', 'Dena hai')}</th></tr></thead>
            <tbody>{rows.map((x) => (
              <tr key={x.id} className="clickable" tabIndex={0} onClick={() => setEdit(x)} onKeyDown={(e) => e.key === 'Enter' && setEdit(x)}>
                <td><span className="row" style={{ gap: 10 }}><span className="avatar">{initials(x.name)}</span><span className="primary">{x.name}</span></span></td>
                <td className="num muted">{x.phone || '—'}</td>
                <td className="r num">{rupees(x.total_purchased)}</td>
                <td className="r num">{rupees(x.total_paid)}</td>
                <td className="r">{x.pending > 0 ? <Money value={x.pending} tone="warn" /> : <span className="muted">—</span>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
      <SupplierDrawer value={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

function SupplierDrawer({ value, onClose }: { value: Supplier | 'new' | null; onClose: () => void }) {
  const { t, err } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const s = value && value !== 'new' ? value : null;
  const [f, setF] = useState({ name: '', phone: '', city: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (value) { setF({ name: s?.name || '', phone: s?.phone || '', city: s?.city || '' }); setError(''); } }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    if (!f.name.trim()) { setError(t('Write the supplier’s name.', 'सप्लायर का नाम लिखें।', 'Supplier ka naam likho.')); return; }
    setBusy(true); setError('');
    try {
      if (s) await put(`/api/suppliers/${s.id}`, f); else await post('/api/suppliers', f);
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      toast({ text: s ? t('Supplier saved', 'सप्लायर सेव हुआ', 'Supplier save hua') : t('Supplier added', 'सप्लायर जुड़ा', 'Supplier juda') });
      onClose();
    } catch (e) { setError(err(e)); } finally { setBusy(false); }
  };
  return (
    <Drawer open={!!value} onClose={onClose} title={s ? s.name : t('Add supplier', 'सप्लायर जोड़ें', 'Supplier jodo')}
      footer={<><Button onClick={onClose}>{t('Close', 'बंद', 'Band')}</Button><Button variant="primary" loading={busy} onClick={save}>{s ? t('Save changes', 'बदलाव सेव करें', 'Badlav save karo') : t('Add supplier', 'सप्लायर जोड़ें', 'Supplier jodo')}</Button></>}>
      <form className="stack" style={{ gap: 16 }} onSubmit={(e) => { e.preventDefault(); save(); }}>
        {s && (
          <div className="mini-stats">
            <div><span className="strip-label">{t('Bought', 'खरीदा', 'Khareeda')}</span><span className="num mini-big">{rupees(s.total_purchased)}</span></div>
            <div><span className="strip-label">{t('Paid', 'दिया', 'Diya')}</span><span className="num mini-big">{rupees(s.total_paid)}</span></div>
            <div><span className="strip-label">{t('You owe', 'देना है', 'Dena hai')}</span><Money value={s.pending} tone={s.pending ? 'warn' : undefined} className="mini-big" /></div>
          </div>
        )}
        {s && s.pending > 0 && <p className="muted" style={{ fontSize: 13 }}>{t('To pay, open the purchase in', 'भुगतान के लिए खरीद खोलें:', 'Payment ke liye khareed kholo:')} <Link to="/purchases" onClick={onClose}>{t('Purchases', 'खरीद', 'Khareed')}</Link>.</p>}
        {s?.phone && <a href={`tel:${s.phone}`} className="row" style={{ gap: 6 }}><Phone size={14} /> {s.phone}</a>}
        <Field label={t('Name', 'नाम', 'Naam')} error={error}>{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus={!s} />}</Field>
        <Field label={t('Mobile', 'मोबाइल', 'Mobile')}>{(id) => <Input id={id} inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />}</Field>
        <Field label={t('City', 'शहर', 'Shehar')}>{(id) => <Input id={id} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />}</Field>
        <button type="submit" hidden />
      </form>
    </Drawer>
  );
}
