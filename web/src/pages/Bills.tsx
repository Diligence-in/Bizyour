import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, ReceiptText, Search } from 'lucide-react';
import { get } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';
import { dateLabel, daysFromToday, rupees } from '../lib/format';
import type { Invoice } from '../lib/types';
import { BillStatusBadge, Empty, Money, SkelRows, Tabs } from '../components/ui';
import { ExportMenu } from '../components/ExportMenu';
import { ImportButton } from '../components/ImportData';
import { PageHeader, useIsMobile, usePageTitle } from '../components/shell/AppShell';

type Filter = 'all' | 'unpaid' | 'today' | 'returns';
interface ReturnRow { id: number; return_no?: number; invoice_id: number; bill_no?: number; customer_name?: string; date: string; total: number; reason?: string | null }

export default function BillsPage() {
  const { t } = useI18n();
  const { can } = useSession();
  const nav = useNavigate();
  const mobile = useIsMobile();
  usePageTitle(t('Bills', 'बिल', 'Bills'));
  const [tab, setTab] = useState<Filter>('all');
  const [q, setQ] = useState('');

  const inv = useQuery({ queryKey: ['invoices'], queryFn: () => get<{ invoices: Invoice[] }>('/api/invoices') });
  const rets = useQuery({ queryKey: ['returns'], queryFn: () => get<{ returns: ReturnRow[] }>('/api/returns'), enabled: tab === 'returns' });
  const today = new Date().toISOString().slice(0, 10);
  const words = { today: t('Today', 'आज', 'Aaj'), yesterday: t('Yesterday', 'कल', 'Kal') };

  const all = inv.data?.invoices || [];
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return all.filter((b) => {
      if (tab === 'unpaid' && (b.status === 'paid' || b.cancelled)) return false;
      if (tab === 'today' && b.date !== today) return false;
      if (!term) return true;
      return b.customer_name.toLowerCase().includes(term) || String(b.bill_no) === term.replace('#', '');
    });
  }, [all, tab, q, today]);
  const counts = { unpaid: all.filter((b) => b.status !== 'paid' && !b.cancelled).length, today: all.filter((b) => b.date === today).length };
  const totals = rows.filter((b) => !b.cancelled).reduce((a, b) => ({ total: a.total + b.total, pending: a.pending + b.pending_amount }), { total: 0, pending: 0 });

  return (
    <div className="page">
      <PageHeader
        title={t('Bills', 'बिल', 'Bills')}
        sub={inv.data ? t(`${rows.length} bills · ${rupees(totals.total)} · ${rupees(totals.pending)} unpaid`, `${rows.length} बिल · ${rupees(totals.total)} · ${rupees(totals.pending)} बाकी`, `${rows.length} bill · ${rupees(totals.total)} · ${rupees(totals.pending)} baaki`) : ' '}
        actions={<>
          <ImportButton types={['customers', 'products']} label={t('Import old udhaar', 'पुराना उधार इम्पोर्ट करें', 'Purana udhaar import karo')} />
          {can.finance && <ExportMenu path="/api/export/sales" name="sales" />}
          <Link to="/pos" className="btn btn-primary"><Plus size={16} /> {t('New bill', 'नया बिल', 'Naya bill')}</Link>
        </>}
      />
      <section className="panel">
        <div style={{ padding: '0 16px' }}>
          <Tabs<Filter> label={t('Filter bills', 'बिल छांटें', 'Bill filter')} value={tab} onChange={setTab} tabs={[
            { value: 'all', label: t('All', 'सभी', 'Sab') },
            { value: 'unpaid', label: t('Unpaid', 'बाकी', 'Baaki'), count: counts.unpaid },
            { value: 'today', label: t('Today', 'आज', 'Aaj'), count: counts.today },
            { value: 'returns', label: t('Returns', 'वापसी', 'Wapsi') }
          ]} />
        </div>
        {tab !== 'returns' && (
          <div className="toolbar">
            <div className="input-wrap"><Search size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Customer name or bill number', 'ग्राहक या बिल नंबर', 'Customer ya bill number')} /></div>
          </div>
        )}
        {tab === 'returns' ? (
          rets.isLoading ? <SkelRows /> : !(rets.data?.returns || []).length ? (
            <Empty icon={<ReceiptText size={28} />} title={t('No returns yet', 'अभी कोई वापसी नहीं', 'Abhi koi wapsi nahi')} body={t('Open a bill and choose “Return items” when a customer brings goods back.', 'ग्राहक सामान लौटाए तो बिल खोलकर “वापसी” चुनें।', 'Customer saaman lautaye to bill kholkar “Wapsi” chuno.')} />
          ) : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>{t('Date', 'तारीख', 'Date')}</th><th>{t('Against bill', 'बिल', 'Bill')}</th><th>{t('Customer', 'ग्राहक', 'Customer')}</th><th className="r">{t('Amount', 'रकम', 'Rakam')}</th></tr></thead>
              <tbody>{rets.data!.returns.map((r) => (
                <tr key={r.id} className="clickable" tabIndex={0} onClick={() => nav(`/bills/${r.invoice_id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`/bills/${r.invoice_id}`)}>
                  <td>{dateLabel(r.date, words)}</td><td className="num">#{r.bill_no ?? r.invoice_id}</td><td>{r.customer_name || '—'}</td><td className="r"><Money value={r.total} /></td>
                </tr>
              ))}</tbody>
            </table></div>
          )
        ) : inv.isLoading ? <SkelRows rows={8} /> : !rows.length ? (
          <Empty icon={<ReceiptText size={28} />} title={q ? t('No bills match', 'कोई बिल नहीं मिला', 'Koi bill nahi mila') : t('No bills here', 'यहां कोई बिल नहीं', 'Yahan koi bill nahi')}
            action={<Link to="/pos" className="btn btn-primary"><Plus size={16} /> {t('New bill', 'नया बिल', 'Naya bill')}</Link>} />
        ) : mobile ? (
          <div className="list">{rows.map((b) => (
            <Link key={b.id} to={`/bills/${b.id}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="title ellipsis">{b.customer_name}</div>
                <div className="meta">#{b.bill_no} · {dateLabel(b.date, words)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="num" style={{ fontWeight: 500 }}>{rupees(b.total)}</div>
                {b.pending_amount > 0 && !b.cancelled ? <Money value={b.pending_amount} tone="owed" className="meta" /> : <BillStatusBadge status={b.status} cancelled={b.cancelled} />}
              </div>
            </Link>
          ))}</div>
        ) : (
          <div className="table-wrap"><table className="table">
            <thead><tr>
              <th style={{ width: 80 }}>{t('Bill', 'बिल', 'Bill')}</th><th>{t('Date', 'तारीख', 'Date')}</th><th>{t('Customer', 'ग्राहक', 'Customer')}</th>
              <th className="r">{t('Total', 'कुल', 'Kul')}</th><th className="r">{t('Unpaid', 'बाकी', 'Baaki')}</th><th>{t('Status', 'स्थिति', 'Status')}</th>
            </tr></thead>
            <tbody>{rows.map((b) => {
              const overdue = !!b.due_date && b.pending_amount > 0 && daysFromToday(b.due_date) < 0;
              return (
                <tr key={b.id} className="clickable" tabIndex={0} onClick={() => nav(`/bills/${b.id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`/bills/${b.id}`)}>
                  <td className="num primary">#{b.bill_no}</td>
                  <td>{dateLabel(b.date, words)}</td>
                  <td><span className="primary">{b.customer_name}</span>{b.kind === 'opening' && <span className="sub">{t('Opening balance', 'पुराना बाकी', 'Purana baaki')}</span>}</td>
                  <td className="r num">{rupees(b.total)}</td>
                  <td className="r">{b.pending_amount > 0 && !b.cancelled ? <Money value={b.pending_amount} tone="owed" /> : <span className="muted">—</span>}</td>
                  <td><BillStatusBadge status={b.status} cancelled={b.cancelled} overdue={overdue} /></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
