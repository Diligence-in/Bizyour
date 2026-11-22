import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, FileJson, MessageCircle, Printer } from 'lucide-react';
import { get } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { qty as fmtQty, rupees, todayStr } from '../lib/format';
import { EXPENSE_CATS, monthLabel, ymNow } from '../lib/months';
import { Badge, Button, Input, Money, Panel, Segmented, Skel, SkelRows, Tabs, useToast } from '../components/ui';
import { ExportMenu } from '../components/ExportMenu';
import { Bars, Columns, MonthNav } from '../components/MonthNav';
import { PageHeader, usePageTitle } from '../components/shell/AppShell';

type Tab = 'overview' | 'monthly' | 'gst' | 'gstr1';
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function ReportsPage() {
  const { t } = useI18n();
  usePageTitle(t('Reports & GST', 'रिपोर्ट और GST', 'Report aur GST'));
  const [tab, setTab] = useState<Tab>('overview');
  return (
    <div className="page">
      <PageHeader title={t('Reports & GST', 'रिपोर्ट और GST', 'Report aur GST')} sub={t('How the shop is doing, and the GST numbers ready to file.', 'दुकान कैसी चल रही है, और GST के आँकड़े फ़ाइल करने के लिए तैयार।', 'Dukaan kaisi chal rahi hai, aur GST ke aankde file karne ke liye taiyaar.')} />
      <Tabs label="report" value={tab} onChange={setTab} tabs={[
        { value: 'overview', label: t('Overview', 'ओवरव्यू', 'Overview') },
        { value: 'monthly', label: t('Month by month', 'महीना-दर-महीना', 'Mahina-dar-mahina') },
        { value: 'gst', label: 'GST' },
        { value: 'gstr1', label: 'GSTR-1' }
      ]} />
      <div style={{ marginTop: 16 }}>
        {tab === 'overview' && <Overview />}
        {tab === 'monthly' && <Monthly />}
        {tab === 'gst' && <Gst />}
        {tab === 'gstr1' && <Gstr1 />}
      </div>
    </div>
  );
}

/* ---------- overview ---------- */
interface Summary { sale_total: number; bills_count: number; gross_profit: number; expenses_total: number; net_profit: number; pending_collection: number; pending_supplier: number; stock_value: number }
interface Pending { customers: { id: number; name: string; phone: string; pending: number }[]; suppliers: { id: number; name: string; phone: string; pending: number }[] }

function Overview() {
  const { t, err } = useI18n();
  const toast = useToast();
  const [preset, setPreset] = useState<'today' | 'week' | 'month' | 'lastmonth' | 'custom'>('month');
  const [cf, setCf] = useState(todayStr().slice(0, 8) + '01'); const [ct, setCt] = useState(todayStr());
  const now = new Date();
  const range = (() => {
    const today = iso(now);
    if (preset === 'today') return { from: today, to: today };
    if (preset === 'week') { const dow = (now.getDay() + 6) % 7; return { from: iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow)), to: today }; }
    if (preset === 'lastmonth') return { from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: iso(new Date(now.getFullYear(), now.getMonth(), 0)) };
    if (preset === 'custom') return cf && ct && cf <= ct ? { from: cf, to: ct } : { from: today.slice(0, 8) + '01', to: today };
    return { from: today.slice(0, 8) + '01', to: today };
  })();
  const qs = `from=${range.from}&to=${range.to}`;
  const sum = useQuery({ queryKey: ['summary', qs], queryFn: () => get<Summary>(`/api/reports/summary?${qs}`) });
  const daily = useQuery({ queryKey: ['summary', 'daily', qs], queryFn: () => get<{ date: string; total: number }[]>(`/api/reports/daily-sales?${qs}`) });
  const cats = useQuery({ queryKey: ['summary', 'cats', qs], queryFn: () => get<{ category: string; total: number }[]>(`/api/reports/expense-categories?${qs}`) });
  const pend = useQuery({ queryKey: ['summary', 'pending'], queryFn: () => get<Pending>('/api/reports/pending') });
  const s = sum.data;
  const catName = (k: string) => { const c = EXPENSE_CATS[k]; return c ? t(c[0], c[1], c[2]) : k; };
  const remind = async (id: number) => {
    try { const r = await get<{ url: string }>(`/api/customers/${id}/reminder-link`); window.open(r.url, '_blank', 'noopener'); }
    catch (e) { toast({ text: err(e), tone: 'error' }); }
  };
  const dayEnd = async () => {
    try { const r = await get<{ url: string }>('/api/reports/day-end/whatsapp-link'); window.open(r.url, '_blank', 'noopener'); }
    catch (e) { toast({ text: err(e), tone: 'error' }); }
  };
  const net = s?.net_profit ?? 0;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <Segmented label="range" value={preset} onChange={setPreset} options={[
          { value: 'today', label: t('Today', 'आज', 'Aaj') }, { value: 'week', label: t('This week', 'इस हफ़्ते', 'Is hafte') },
          { value: 'month', label: t('This month', 'इस महीने', 'Is mahine') }, { value: 'lastmonth', label: t('Last month', 'पिछला महीना', 'Pichla mahina') },
          { value: 'custom', label: t('Pick dates', 'तारीख़ चुनें', 'Date chuno') }]} />
        {preset === 'custom' && <><Input type="date" aria-label="From" value={cf} onChange={(e) => setCf(e.target.value)} style={{ width: 150 }} /><span className="muted">→</span><Input type="date" aria-label="To" value={ct} onChange={(e) => setCt(e.target.value)} style={{ width: 150 }} /></>}
        <span className="grow" />
        <Button icon={<MessageCircle size={15} />} onClick={dayEnd}>{t('Send day-end summary', 'दिन का हिसाब भेजें', 'Din ka hisab bhejo')}</Button>
      </div>
      <div className="ledger-strip" style={{ marginBottom: 0 }}>
        <Cell label={t('Sale', 'बिक्री', 'Bikri')} loading={sum.isLoading} value={rupees(s?.sale_total)} note={`${s?.bills_count ?? 0} ${t('bills', 'बिल', 'bills')}`} />
        <Cell label={t('Gross profit', 'कमाई (खर्चे से पहले)', 'Kamai (kharche se pehle)')} loading={sum.isLoading} value={rupees(s?.gross_profit)} note={t('Sale − cost of goods', 'बिक्री − माल की लागत', 'Bikri − maal ki laagat')} />
        <Cell label={t('Expenses', 'खर्चा', 'Kharcha')} loading={sum.isLoading} value={rupees(s?.expenses_total)} />
        <Cell label={t('Net profit', 'असली मुनाफ़ा', 'Asli munafa')} loading={sum.isLoading} value={<span className={net < 0 ? 'amt-neg' : 'amt-pos'}>{rupees(net)}</span>} />
      </div>
      <div className="ledger-strip" style={{ marginBottom: 0 }}>
        <Cell label={t('To collect', 'लेना है', 'Lena hai')} loading={sum.isLoading} value={rupees(s?.pending_collection)} note={t('Customer udhaar', 'ग्राहकों का उधार', 'Customer udhaar')} />
        <Cell label={t('To pay', 'देना है', 'Dena hai')} loading={sum.isLoading} value={rupees(s?.pending_supplier)} note={t('To suppliers', 'सप्लायर को', 'Supplier ko')} />
        <Cell label={t('Stock value', 'माल की कीमत', 'Maal ki keemat')} loading={sum.isLoading} value={rupees(s?.stock_value)} note={t('At buying price', 'खरीद भाव पर', 'Khareed bhaav par')} />
      </div>
      <div className="two-col">
        <Panel title={t('Daily sale', 'रोज़ की बिक्री', 'Roz ki bikri')}>{daily.isLoading ? <Skel h={150} /> : <Columns days={daily.data || []} />}</Panel>
        <Panel title={t('Expenses by type', 'खर्चा किस पर', 'Kharcha kis par')}>
          {cats.isLoading ? <SkelRows rows={3} /> : cats.data?.length ? <Bars rows={cats.data.map((c) => ({ label: catName(c.category), value: c.total }))} /> : <p className="muted" style={{ margin: 0 }}>{t('No expenses in this period.', 'इस समय में कोई खर्चा नहीं।', 'Is samay me koi kharcha nahi.')}</p>}
        </Panel>
      </div>
      <div className="two-col">
        <Panel title={t('Customers who owe you', 'जिनसे लेना है', 'Jinse lena hai')} bodyClass="">
          {pend.isLoading ? <div className="panel-body"><SkelRows rows={3} /></div> : !pend.data?.customers.length ? <p className="muted panel-body" style={{ margin: 0 }}>{t('No customer has pending credit.', 'किसी ग्राहक का उधार बाकी नहीं।', 'Kisi customer ka udhaar baaki nahi.')}</p> : (
            <div className="list">{pend.data.customers.slice(0, 12).map((c) => (
              <div key={c.id} className="list-row">
                <div className="grow" style={{ minWidth: 0 }}><div className="title ellipsis">{c.name}</div>{c.phone && <div className="meta">{c.phone}</div>}</div>
                <Money value={c.pending} tone="owed" />
                <Button size="sm" icon={<MessageCircle size={14} />} onClick={() => remind(c.id)}>{t('Remind', 'याद दिलाएं', 'Yaad dilao')}</Button>
              </div>))}</div>
          )}
        </Panel>
        <Panel title={t('Suppliers you owe', 'जिन्हें देना है', 'Jinhe dena hai')} bodyClass="">
          {pend.isLoading ? <div className="panel-body"><SkelRows rows={3} /></div> : !pend.data?.suppliers.length ? <p className="muted panel-body" style={{ margin: 0 }}>{t('Nothing pending to any supplier.', 'किसी सप्लायर को कुछ देना बाकी नहीं।', 'Kisi supplier ko kuch dena baaki nahi.')}</p> : (
            <div className="list">{pend.data.suppliers.slice(0, 12).map((c) => (
              <div key={c.id} className="list-row"><div className="grow" style={{ minWidth: 0 }}><div className="title ellipsis">{c.name}</div>{c.phone && <div className="meta">{c.phone}</div>}</div><Money value={c.pending} tone="warn" /></div>))}</div>
          )}
        </Panel>
      </div>
      <ReportCard />
    </div>
  );
}

function Cell({ label, value, note, loading }: { label: string; value: React.ReactNode; note?: string; loading?: boolean }) {
  return <div className="strip-cell"><span className="strip-label">{label}</span><span className="strip-value">{loading ? <Skel w={110} h={30} /> : value}</span><span className="strip-note">{loading ? '' : note}</span></div>;
}

interface Card {
  sale: number; bills_count: number; cogs: number; expenses: number; net: number; returns_total: number; udhaar_diya: number; vasuli: number; total_pending: number;
  stock_value: number; stock_value_label: string; top_products: { name: string; amount: number }[]; top_pending_customers: { name: string; pending: number }[];
}
function ReportCard() {
  const { t, err } = useI18n();
  const toast = useToast();
  const [ym, setYm] = useState(ymNow());
  const q = useQuery({ queryKey: ['summary', 'card', ym], queryFn: () => get<{ report_card: Card }>(`/api/reports/report-card?month=${ym}`) });
  const c = q.data?.report_card;
  const share = async () => {
    try { const r = await get<{ url: string }>(`/api/reports/report-card/whatsapp-link?month=${ym}`); window.open(r.url, '_blank', 'noopener'); }
    catch (e) { toast({ text: err(e), tone: 'error' }); }
  };
  return (
    <Panel title={t('Monthly report card', 'महीने का रिपोर्ट कार्ड', 'Mahine ka report card')}
      action={<div className="row" style={{ gap: 8 }}><MonthNav value={ym} onChange={setYm} /><Button size="sm" icon={<MessageCircle size={14} />} onClick={share}>{t('Send to my WhatsApp', 'मेरे WhatsApp पर भेजें', 'Mere WhatsApp par bhejo')}</Button></div>}>
      {!c ? <SkelRows rows={5} /> : (
        <div className="two-col">
          <div className="sum-lines">
            <Line l={`${t('Total sale', 'कुल बिक्री', 'Kul bikri')} (${c.bills_count} ${t('bills', 'बिल', 'bills')})`} v={rupees(c.sale)} />
            <Line l={t('Cost of goods', 'माल की लागत', 'Maal ki laagat')} v={rupees(c.cogs)} />
            <Line l={t('Expenses', 'खर्चा', 'Kharcha')} v={rupees(c.expenses)} />
            <Line l={t('Net profit', 'असली मुनाफ़ा', 'Asli munafa')} v={<span className={c.net < 0 ? 'amt-neg' : 'amt-pos'}>{rupees(c.net)}</span>} total />
            {Number(c.returns_total) > 0 && <Line l={t('Returns', 'वापसी', 'Wapsi')} v={rupees(c.returns_total)} />}
            <Line l={t('Udhaar given this month', 'इस महीने उधार दिया', 'Is mahine udhaar diya')} v={rupees(c.udhaar_diya)} />
            <Line l={t('Collected this month', 'इस महीने वसूली', 'Is mahine vasuli')} v={rupees(c.vasuli)} />
            <Line l={t('Total udhaar pending', 'कुल बाकी उधार', 'Kul baaki udhaar')} v={rupees(c.total_pending)} />
          </div>
          <div className="stack" style={{ gap: 16 }}>
            <div><div className="field-label" style={{ marginBottom: 6 }}>{t('Top selling', 'सबसे ज़्यादा बिका', 'Sabse zyada bika')}</div>
              {c.top_products.length ? <Bars rows={c.top_products.map((p) => ({ label: p.name, value: p.amount }))} /> : <p className="muted" style={{ margin: 0 }}>{t('No sales this month.', 'इस महीने कोई बिक्री नहीं।', 'Is mahine koi bikri nahi.')}</p>}</div>
            <div><div className="field-label" style={{ marginBottom: 6 }}>{t('Biggest udhaar', 'सबसे ज़्यादा उधार', 'Sabse zyada udhaar')}</div>
              {c.top_pending_customers.length ? <Bars rows={c.top_pending_customers.map((p) => ({ label: p.name, value: p.pending }))} /> : <p className="muted" style={{ margin: 0 }}>{t('No pending udhaar.', 'कोई उधार बाकी नहीं।', 'Koi udhaar baaki nahi.')}</p>}</div>
          </div>
        </div>
      )}
    </Panel>
  );
}
const Line = ({ l, v, total }: { l: React.ReactNode; v: React.ReactNode; total?: boolean }) => <div className={`sum-line${total ? ' total' : ''}`}><span>{l}</span><span className="num">{v}</span></div>;

/* ---------- month by month ---------- */
function Monthly() {
  const { t, lang } = useI18n();
  const [ym, setYm] = useState(ymNow());
  const q = useQuery({ queryKey: ['summary', 'monthly', ym], queryFn: () => get<{ month: string; summary: { sale_total: number; bills_count: number; expenses_total: number; net_profit: number }; months: { month: string; sale_total: number; expenses_total: number; net_profit: number }[] }>(`/api/reports/monthly?month=${ym}`) });
  const r = q.data;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="toolbar" style={{ marginBottom: 0 }}><MonthNav value={ym} onChange={setYm} /></div>
      <div className="two-col">
        <Panel title={monthLabel(ym, lang)}>
          {!r ? <SkelRows rows={3} /> : <div className="sum-lines">
            <Line l={`${t('Sale', 'बिक्री', 'Bikri')} (${r.summary.bills_count} ${t('bills', 'बिल', 'bills')})`} v={rupees(r.summary.sale_total)} />
            <Line l={t('Expenses', 'खर्चा', 'Kharcha')} v={rupees(r.summary.expenses_total)} />
            <Line l={t('Net profit', 'असली मुनाफ़ा', 'Asli munafa')} v={<span className={r.summary.net_profit < 0 ? 'amt-neg' : 'amt-pos'}>{rupees(r.summary.net_profit)}</span>} total />
          </div>}
        </Panel>
        <Panel title={t('Last months', 'पिछले महीने', 'Pichle mahine')} bodyClass="">
          {!r ? <div className="panel-body"><SkelRows rows={4} /></div> : (
            <div className="table-wrap"><table className="table table-dense">
              <thead><tr><th>{t('Month', 'महीना', 'Mahina')}</th><th className="r">{t('Sale', 'बिक्री', 'Bikri')}</th><th className="r">{t('Expenses', 'खर्चा', 'Kharcha')}</th><th className="r">{t('Net', 'मुनाफ़ा', 'Munafa')}</th></tr></thead>
              <tbody>{[...r.months].reverse().map((m) => (
                <tr key={m.month} style={m.month === r.month ? { background: 'var(--accent-tint)' } : undefined}>
                  <td className={m.month === r.month ? 'primary' : ''}>{monthLabel(m.month, lang)}</td>
                  <td className="r num">{rupees(m.sale_total)}</td><td className="r num">{rupees(m.expenses_total)}</td>
                  <td className={`r num ${m.net_profit < 0 ? 'amt-neg' : 'amt-pos'}`}>{rupees(m.net_profit)}</td>
                </tr>))}</tbody>
            </table></div>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ---------- GST ---------- */
interface GstRep {
  gst_enabled: boolean; month: string; from: string; to: string; gstin?: string; bills_count: number; total_sales: number; taxable_value: number; output_gst: number; cgst: number; sgst: number;
  returns_count: number; returns_total: number; returns_gst: number; input_gst: number; net_gst_payable: number;
  by_rate: { rate: number; amount: number; taxable_value: number; gst: number; cgst: number; sgst: number }[];
}
function GstOff() {
  const { t } = useI18n();
  return <div className="banner banner-info">{t('GST is off for this shop, so there is no GST report. Turn it on in Settings → Shop.', 'इस दुकान में GST बंद है, इसलिए GST रिपोर्ट नहीं है। Settings → दुकान में चालू करें।', 'Is dukaan me GST band hai, isliye GST report nahi hai. Settings → Dukaan me chalu karo.')}</div>;
}
function Gst() {
  const { t, lang } = useI18n();
  const [ym, setYm] = useState(ymNow());
  const q = useQuery({ queryKey: ['summary', 'gst', ym], queryFn: () => get<GstRep>(`/api/reports/gst?month=${ym}`) });
  const r = q.data;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="toolbar no-print" style={{ marginBottom: 0 }}><MonthNav value={ym} onChange={setYm} /><span className="grow" />{r?.gst_enabled && <Button icon={<Printer size={15} />} onClick={() => window.print()}>{t('Print', 'प्रिंट', 'Print')}</Button>}</div>
      {!r ? <SkelRows rows={6} /> : !r.gst_enabled ? <GstOff /> : (
        <>
          <Panel title={`${t('GST report', 'GST रिपोर्ट', 'GST report')} — ${monthLabel(ym, lang)}`}>
            <div className="sum-lines">
              <Line l={`${t('Total sale', 'कुल बिक्री', 'Kul bikri')} (${r.bills_count} ${t('bills', 'बिल', 'bills')})`} v={rupees(r.total_sales)} />
              <Line l={t('Taxable value (without GST)', 'Taxable value (GST हटाकर)', 'Taxable value (GST hatake)')} v={rupees(r.taxable_value)} />
              <Line l={t('GST collected on sales', 'बिक्री पर वसूला GST', 'Bikri par vasula GST')} v={rupees(r.output_gst)} />
              <Line l="· CGST" v={rupees(r.cgst)} /><Line l="· SGST" v={rupees(r.sgst)} />
              {r.returns_count > 0 && <Line l={`${t('Returns / credit notes', 'वापसी / credit notes', 'Wapsi / credit notes')} (${r.returns_count})`} v={`−${rupees(r.returns_total)} · GST −${rupees(r.returns_gst)}`} />}
              <Line l={t('GST paid on purchases', 'खरीद पर दिया GST', 'Khareed par diya GST')} v={rupees(r.input_gst)} />
              <Line l={t('GST to pay (collected − paid)', 'देने वाला GST (वसूला − दिया)', 'Dene wala GST (vasula − diya)')} v={rupees(r.net_gst_payable)} total />
            </div>
            {r.returns_count > 0 && <p className="muted" style={{ marginBottom: 0 }}>{t('Sale and GST above are already after this month’s returns.', 'ऊपर की बिक्री और GST इस महीने की वापसी घटाकर है।', 'Upar ki bikri aur GST is mahine ki wapsi ghatake hai.')}</p>}
          </Panel>
          <Panel title={t('By GST rate', 'GST दर के हिसाब से', 'GST dar ke hisab se')} bodyClass="">
            {r.by_rate.length ? (
              <div className="table-wrap"><table className="table table-dense">
                <thead><tr><th>GST %</th><th className="r">{t('Amount (with GST)', 'रकम (GST सहित)', 'Rakam (GST sahit)')}</th><th className="r">Taxable</th><th className="r">GST</th><th className="r">CGST</th><th className="r">SGST</th></tr></thead>
                <tbody>{r.by_rate.map((x) => <tr key={x.rate}><td className="primary">{Number(x.rate)}%</td><td className="r num">{rupees(x.amount)}</td><td className="r num">{rupees(x.taxable_value)}</td><td className="r num">{rupees(x.gst)}</td><td className="r num">{rupees(x.cgst)}</td><td className="r num">{rupees(x.sgst)}</td></tr>)}</tbody>
              </table></div>
            ) : <p className="muted panel-body" style={{ margin: 0 }}>{t('No GST bills this month.', 'इस महीने कोई GST बिल नहीं।', 'Is mahine koi GST bill nahi.')}</p>}
          </Panel>
        </>
      )}
    </div>
  );
}

/* ---------- GSTR-1 ---------- */
interface G1 {
  gst_enabled: boolean; bills_count: number; total_sales: number; taxable_value: number; output_gst: number;
  b2b: { invoices: number; value: number; tax: number }; b2c: { invoices: number; value: number; tax: number };
  credit_notes?: { count: number; total_value: number; tax: number; notes: { return_no: number; date: string; bill_no: number; taxable_value: number; gst_amount: number; total: number }[] };
  hsn_summary?: { hsn_code: string; description: string; qty: number; taxable_value: number; total_tax: number }[];
  readiness?: { business_gstin_missing?: boolean; products_missing_hsn?: number; products_missing_hsn_names?: string[]; customers_invoiced_without_gstin?: number; customers_with_invalid_gstin?: number };
  note?: string;
}
function Gstr1() {
  const { t } = useI18n();
  const [ym, setYm] = useState(ymNow());
  const q = useQuery({ queryKey: ['summary', 'gstr1', ym], queryFn: () => get<G1>(`/api/reports/gstr1?month=${ym}`) });
  const r = q.data;
  const rd = r?.readiness || {};
  const warns: string[] = [];
  if (rd.business_gstin_missing) warns.push(t('Your GSTIN is not set in Settings — the file will have a blank seller GSTIN.', 'आपका GSTIN Settings में नहीं भरा है — फ़ाइल में seller GSTIN खाली जाएगा।', 'Aapka GSTIN Settings me nahi bhara hai — file me seller GSTIN khaali jayega.'));
  if ((rd.products_missing_hsn || 0) > 0) warns.push(t(`${rd.products_missing_hsn} product(s) have no HSN code${rd.products_missing_hsn_names?.length ? ': ' + rd.products_missing_hsn_names.join(', ') : ''} — add them in Products before filing.`, `${rd.products_missing_hsn} सामान पर HSN code नहीं है — filing से पहले Products में भरें।`, `${rd.products_missing_hsn} saaman par HSN code nahi hai — filing se pehle Products me bharo.`));
  if ((rd.customers_invoiced_without_gstin || 0) > 0) warns.push(t(`${rd.customers_invoiced_without_gstin} customer(s) went to B2C without a GSTIN — add GSTINs for business buyers.`, `${rd.customers_invoiced_without_gstin} ग्राहक बिना GSTIN के B2C में गए — business ग्राहक का GSTIN भरें।`, `${rd.customers_invoiced_without_gstin} customer bina GSTIN ke B2C me gaye — business customer ka GSTIN bharo.`));
  if ((rd.customers_with_invalid_gstin || 0) > 0) warns.push(t(`${rd.customers_with_invalid_gstin} customer GSTIN(s) look invalid and were counted as B2C.`, `${rd.customers_with_invalid_gstin} ग्राहक का GSTIN गलत लग रहा है — B2C में गिना गया।`, `${rd.customers_with_invalid_gstin} customer ka GSTIN galat lag raha hai — B2C me gina gaya.`));
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <MonthNav value={ym} onChange={setYm} /><span className="grow" />
        {r?.gst_enabled && <ExportMenu path={`/api/reports/gstr1/download?month=${ym}`} name={`gstr1-register-${ym}`} label={t('Download', 'डाउनलोड', 'Download')} extras={[{ label: t('Portal file (JSON)', 'पोर्टल फ़ाइल (JSON)', 'Portal file (JSON)'), path: `/api/reports/gstr1/download?format=json&month=${ym}`, file: `gstr1-${ym}.json`, icon: <FileJson size={16} /> }]} />}
      </div>
      {!r ? <SkelRows rows={6} /> : !r.gst_enabled ? <GstOff /> : (
        <>
          {warns.length ? <div className="banner banner-warn" role="status"><AlertTriangle size={16} style={{ flex: 'none' }} /><div className="stack" style={{ gap: 4 }}>{warns.map((w) => <span key={w}>{w}</span>)}</div></div>
            : <div className="banner banner-info"><CheckCircle2 size={16} style={{ flex: 'none' }} />{t('Ready to file — GSTIN and HSN codes are complete.', 'फ़ाइल करने के लिए तैयार — GSTIN और HSN पूरे हैं।', 'File karne ke liye taiyaar — GSTIN aur HSN poore hain.')}</div>}
          <Panel title={t('Summary', 'सारांश', 'Summary')}>
            <div className="sum-lines">
              <Line l={`${t('Total sale', 'कुल बिक्री', 'Kul bikri')} (${r.bills_count} ${t('bills', 'बिल', 'bills')})`} v={rupees(r.total_sales)} />
              <Line l="Taxable value" v={rupees(r.taxable_value)} /><Line l="Output GST" v={rupees(r.output_gst)} />
              <Line l={`B2B · ${r.b2b.invoices} ${t('bills to customers with GSTIN', 'बिल (GSTIN वाले ग्राहक)', 'bills (GSTIN wale customer)')}`} v={`${rupees(r.b2b.value)} · GST ${rupees(r.b2b.tax)}`} />
              <Line l={`B2C · ${r.b2c.invoices} ${t('bills', 'बिल', 'bills')}`} v={`${rupees(r.b2c.value)} · GST ${rupees(r.b2c.tax)}`} />
              {r.credit_notes && r.credit_notes.count > 0 && <Line l={`${t('Credit notes', 'Credit notes', 'Credit notes')} (${r.credit_notes.count})`} v={`−${rupees(r.credit_notes.total_value)} · GST −${rupees(r.credit_notes.tax)}`} />}
            </div>
          </Panel>
          {r.credit_notes && r.credit_notes.count > 0 && (
            <Panel title="Credit notes" bodyClass=""><div className="table-wrap"><table className="table table-dense">
              <thead><tr><th>Credit note</th><th>{t('Date', 'तारीख', 'Date')}</th><th>{t('Bill', 'बिल', 'Bill')}</th><th className="r">Taxable</th><th className="r">GST</th><th className="r">{t('Total', 'कुल', 'Kul')}</th></tr></thead>
              <tbody>{r.credit_notes.notes.map((n) => <tr key={n.return_no}><td className="primary">CN{n.return_no}</td><td>{n.date}</td><td>#{n.bill_no}</td><td className="r num">{rupees(n.taxable_value)}</td><td className="r num">{rupees(n.gst_amount)}</td><td className="r num">{rupees(n.total)}</td></tr>)}</tbody>
            </table></div></Panel>
          )}
          {!!r.hsn_summary?.length && (
            <Panel title={t('HSN summary', 'HSN सारांश', 'HSN summary')} bodyClass=""><div className="table-wrap"><table className="table table-dense">
              <thead><tr><th>HSN</th><th>{t('Item', 'सामान', 'Saaman')}</th><th className="r">{t('Qty', 'मात्रा', 'Qty')}</th><th className="r">Taxable</th><th className="r">GST</th></tr></thead>
              <tbody>{r.hsn_summary.map((h, i) => <tr key={i}><td className="num">{h.hsn_code || <Badge tone="warn" plain>{t('missing', 'खाली', 'khaali')}</Badge>}</td><td className="primary">{h.description}</td><td className="r num">{fmtQty(h.qty)}</td><td className="r num">{rupees(h.taxable_value)}</td><td className="r num">{rupees(h.total_tax)}</td></tr>)}</tbody>
            </table></div></Panel>
          )}
          {r.note && <p className="muted" style={{ margin: 0 }}>{r.note}</p>}
        </>
      )}
    </div>
  );
}
