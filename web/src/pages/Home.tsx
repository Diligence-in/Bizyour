import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, ChevronRight, PackageX, Plus, ShoppingCart, Sparkles, Truck, Users } from 'lucide-react';
import { get } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';
import { dateLabel, daysFromToday, longToday, rupees, todayStr } from '../lib/format';
import type { Invoice } from '../lib/types';
import { Badge, BillStatusBadge, Button, Money, Skel } from '../components/ui';
import { PageHeader, usePageTitle } from '../components/shell/AppShell';

// Home answers three questions, in this order:
//   1. How is today going?        → the ledger strip (4 figures, each a link)
//   2. What needs my attention?   → one prioritised list
//   3. What happened recently?    → last 7 days + latest bills

interface Summary { todays_sale: number; todays_bills: number; total_pending_collection: number; pending_customer_count: number; recent_bills: Invoice[] }
interface Finance { todays_expense: number; todays_cogs: number; todays_gross_profit: number; todays_net_profit: number }
interface DayEnd { collections: { cash: number; upi: number; other: number; total: number; count: number }; new_credit_given: number }
interface DueGroup { customer_id?: number; customer_name?: string; supplier_id?: number; supplier_name?: string; amount: number; oldest_due_date: string; bill_count: number }
interface Alerts { customer_due: { overdue: DueGroup[]; due_today: DueGroup[]; due_soon: DueGroup[] }; supplier_due: { overdue: DueGroup[]; due_today: DueGroup[]; due_soon: DueGroup[] }; low_stock: { product_id: number; name: string; stock_qty: number; low_stock_limit: number }[] }
interface Onboarding { steps: { key: string; title_en: string; title_hi: string; desc_en: string; desc_hi: string; done: boolean; target: string }[]; dismissed?: boolean; show?: boolean }

export function HomePage() {
  const { t, lang } = useI18n();
  const { me, can } = useSession();
  usePageTitle(t('Home', 'होम', 'Home'));

  const summary = useQuery({ queryKey: ['dash-summary'], queryFn: () => get<Summary>('/api/dashboard-summary') });
  const finance = useQuery({ queryKey: ['dash-finance'], queryFn: () => get<Finance>('/api/dashboard-finance'), enabled: can.finance });
  const dayEnd = useQuery({ queryKey: ['day-end'], queryFn: () => get<DayEnd>('/api/reports/day-end'), enabled: can.finance });
  const alerts = useQuery({ queryKey: ['alerts'], queryFn: () => get<Alerts>('/api/alerts'), enabled: can.billing });
  const week = useQuery({
    queryKey: ['daily-sales-7'],
    queryFn: () => {
      const to = todayStr();
      const d = new Date(); d.setDate(d.getDate() - 6);
      const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return get<{ date: string; total: number; bills: number }[]>(`/api/reports/daily-sales?from=${from}&to=${to}`);
    },
    enabled: can.finance
  });
  const onboarding = useQuery({ queryKey: ['onboarding'], queryFn: () => get<Onboarding>('/api/onboarding'), staleTime: 120_000 });

  const s = summary.data;
  const f = finance.data;
  const de = dayEnd.data;
  const words = { today: t('Today', 'आज', 'Aaj'), yesterday: t('Yesterday', 'कल', 'Kal') };
  const nextStep = onboarding.data?.steps?.find((x) => !x.done);

  return (
    <div className="page">
      <PageHeader
        title={longToday(lang)}
        sub={me?.business?.name}
        actions={can.billing && <Link to="/pos" className="btn btn-primary hide-mobile"><Plus size={16} /> {t('New bill', 'नया बिल', 'Naya bill')}</Link>}
      />

      {/* 1. Today */}
      <section className="ledger-strip" aria-label={t('Today', 'आज', 'Aaj')}>
        <StripCell to="/bills" label={t('Sold today', 'आज की बिक्री', 'Aaj ki bikri')} loading={summary.isLoading}
          value={<Money value={s?.todays_sale || 0} />}
          note={s ? t(`${s.todays_bills} bills`, `${s.todays_bills} बिल`, `${s.todays_bills} bill`) : ''} />
        {can.finance && (
          <StripCell to="/bills" label={t('Money received', 'आज मिला', 'Aaj mila')} loading={dayEnd.isLoading}
            value={<Money value={de?.collections.total || 0} tone="in" />}
            note={de ? `Cash ${rupees(de.collections.cash)} · UPI ${rupees(de.collections.upi)}` : ''} />
        )}
        {can.finance && (
          <StripCell to="/reports" label={t('Profit today', 'आज का मुनाफ़ा', 'Aaj ka munafa')} loading={finance.isLoading}
            value={<Money value={f?.todays_net_profit || 0} tone="auto" sign />}
            note={f ? t(`after ${rupees(f.todays_expense)} expenses`, `${rupees(f.todays_expense)} खर्चे के बाद`, `${rupees(f.todays_expense)} kharche ke baad`) : ''} />
        )}
        <StripCell to="/customers?filter=owes" label={t('To collect', 'वसूली बाकी', 'Vasooli baaki')} loading={summary.isLoading}
          value={<Money value={s?.total_pending_collection || 0} tone={s?.total_pending_collection ? 'owed' : undefined} />}
          note={s ? (s.pending_customer_count === 1 ? t('from 1 customer', '1 ग्राहक से', '1 customer se') : t(`from ${s.pending_customer_count} customers`, `${s.pending_customer_count} ग्राहकों से`, `${s.pending_customer_count} customers se`)) : ''} />
      </section>

      <div className="home-grid">
        {/* 2. Attention */}
        <section className="panel">
          <header className="panel-head"><h2>{t('Needs your attention', 'ध्यान दें', 'Dhyan do')}</h2></header>
          <AttentionList alerts={alerts.data} loading={alerts.isLoading} canStock={can.stock} canMart={can.mart}
            nextStep={nextStep ? { title: lang === 'en' ? nextStep.title_en : nextStep.title_hi, desc: lang === 'en' ? nextStep.desc_en : nextStep.desc_hi, target: nextStep.target } : undefined} />
        </section>

        {/* 3. Recent */}
        <div className="stack" style={{ gap: 16 }}>
          {can.finance && (
            <section className="panel">
              <header className="panel-head"><h2>{t('Last 7 days', 'पिछले 7 दिन', 'Pichhle 7 din')}</h2>
                <span className="muted num" style={{ fontSize: 13 }}>{week.data ? rupees(week.data.reduce((a, d) => a + d.total, 0)) : ''}</span></header>
              <div className="panel-body"><WeekBars days={week.data} /></div>
            </section>
          )}
          <section className="panel">
            <header className="panel-head"><h2>{t('Latest bills', 'ताज़ा बिल', 'Taaza bill')}</h2><Link to="/bills" className="btn btn-ghost btn-sm">{t('All bills', 'सभी बिल', 'Sab bill')}</Link></header>
            {summary.isLoading ? <div className="panel-body"><Skel h={120} /></div> : (
              <div className="list">
                {(s?.recent_bills || []).slice(0, 6).map((b) => (
                  <Link key={b.id} to={`/bills/${b.id}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="title ellipsis">{b.customer_name}</div>
                      <div className="meta">#{b.bill_no} · {dateLabel(b.date, words)}{b.payment_mode ? ` · ${b.payment_mode}` : ''}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="num" style={{ fontWeight: 500 }}>{rupees(b.total)}</div>
                      <BillStatusBadge status={b.status} cancelled={b.cancelled} />
                    </div>
                  </Link>
                ))}
                {s && !s.recent_bills.length && <p className="muted" style={{ padding: 16 }}>{t('No bills yet. Press N to make the first one.', 'अभी कोई बिल नहीं। पहला बिल बनाएं।', 'Abhi koi bill nahi. Pehla bill banao.')}</p>}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function StripCell({ label, value, note, to, href, loading }: { label: string; value: React.ReactNode; note?: string; to?: string; href?: string; loading?: boolean }) {
  const inner = (
    <>
      <span className="strip-label">{label}</span>
      <span className="strip-value">{loading ? <Skel w={110} h={30} /> : value}</span>
      <span className="strip-note">{loading ? '' : note}</span>
    </>
  );
  if (href) return <a className="strip-cell" href={href}>{inner}</a>;
  return <Link className="strip-cell" to={to || '/'}>{inner}</Link>;
}

function AttentionList({ alerts, loading, canStock, canMart, nextStep }: {
  alerts?: Alerts; loading: boolean; canStock: boolean; canMart: boolean; nextStep?: { title: string; desc: string; target: string };
}) {
  const { t } = useI18n();
  if (loading) return <div className="panel-body stack"><Skel h={44} /><Skel h={44} /><Skel h={44} /></div>;
  const rows: React.ReactNode[] = [];
  const due = alerts?.customer_due;
  const fmtDays = (d: string) => {
    const n = -daysFromToday(d);
    return n > 0 ? t(`${n} days late`, `${n} दिन देर`, `${n} din late`) : n === 0 ? t('due today', 'आज देना है', 'aaj dena hai') : t(`due in ${-n} days`, `${-n} दिन में`, `${-n} din me`);
  };
  [...(due?.overdue || []), ...(due?.due_today || [])].forEach((g) => rows.push(
    <Link key={`c${g.customer_id}`} to={`/customers/${g.customer_id}`} className="att-row">
      <span className="att-icon att-owed"><AlertTriangle size={16} /></span>
      <span className="grow"><span className="att-title">{g.customer_name}</span><span className="att-meta">{fmtDays(g.oldest_due_date)} · {g.bill_count} {t('bills', 'बिल', 'bill')}</span></span>
      <Money value={g.amount} tone="owed" /><ChevronRight size={16} className="muted" />
    </Link>
  ));
  (due?.due_soon || []).slice(0, 3).forEach((g) => rows.push(
    <Link key={`cs${g.customer_id}`} to={`/customers/${g.customer_id}`} className="att-row">
      <span className="att-icon att-warn"><CalendarClock size={16} /></span>
      <span className="grow"><span className="att-title">{g.customer_name}</span><span className="att-meta">{fmtDays(g.oldest_due_date)}</span></span>
      <Money value={g.amount} /><ChevronRight size={16} className="muted" />
    </Link>
  ));
  const sup = alerts?.supplier_due;
  if (canStock) [...(sup?.overdue || []), ...(sup?.due_today || [])].forEach((g) => rows.push(
    <Link key={`s${g.supplier_id}`} to="/suppliers" className="att-row">
      <span className="att-icon att-warn"><Truck size={16} /></span>
      <span className="grow"><span className="att-title">{t('Pay', 'भुगतान', 'Pay karo')} {g.supplier_name}</span><span className="att-meta">{fmtDays(g.oldest_due_date)}</span></span>
      <Money value={g.amount} /><ChevronRight size={16} className="muted" />
    </Link>
  ));
  const low = alerts?.low_stock || [];
  if (low.length) rows.push(
    <div key="low" className="att-row att-row-static">
      <span className="att-icon att-warn"><PackageX size={16} /></span>
      <span className="grow">
        <span className="att-title">{t(`${low.length} products running low`, `${low.length} सामान कम हैं`, `${low.length} saaman kam hai`)}</span>
        <span className="att-meta">{low.slice(0, 4).map((p) => `${p.name} (${p.stock_qty})`).join(', ')}{low.length > 4 ? '…' : ''}</span>
      </span>
      <span className="row" style={{ gap: 6 }}>
        {canStock && <Link to="/products?filter=low" className="btn btn-secondary btn-sm">{t('View', 'देखें', 'Dekho')}</Link>}
        {canMart && <Link to="/mart" className="btn btn-mart btn-sm"><ShoppingCart size={14} /> {t('Restock on Mart', 'Mart से मंगाएं', 'Mart se mangao')}</Link>}
      </span>
    </div>
  );
  if (nextStep) rows.push(
    <Link key="ob" to={({ settings: '/settings', products: '/products', customers: '/customers', billing: '/pos', expenses: '/expenses', reports: '/reports' } as Record<string, string>)[nextStep.target] || '/'} className="att-row">
      <span className="att-icon att-info"><Sparkles size={16} /></span>
      <span className="grow"><span className="att-title">{nextStep.title}</span><span className="att-meta">{nextStep.desc}</span></span>
      <Badge tone="accent" plain>{t('Setup', 'सेटअप', 'Setup')}</Badge>
    </Link>
  );
  if (!rows.length) return (
    <div className="empty" style={{ padding: 32 }}>
      <Users size={28} />
      <h3>{t('All clear', 'सब ठीक है', 'Sab theek hai')}</h3>
      <p>{t('No overdue payments and nothing low on stock.', 'कोई बकाया देर से नहीं, कोई सामान कम नहीं।', 'Koi payment late nahi, koi saaman kam nahi.')}</p>
      <Link to="/customers"><Button variant="ghost" size="sm">{t('See all customers', 'सभी ग्राहक', 'Sab customers')}</Button></Link>
    </div>
  );
  return <div className="att-list">{rows}</div>;
}

function WeekBars({ days }: { days?: { date: string; total: number; bills: number }[] }) {
  const { t, lang } = useI18n();
  if (!days) return <Skel h={120} />;
  const max = Math.max(1, ...days.map((d) => d.total));
  const today = todayStr();
  const dayName = new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'short' });
  return (
    <div className="week" role="img" aria-label={t('Sales for the last 7 days', 'पिछले 7 दिन की बिक्री', 'Pichhle 7 din ki bikri')}>
      {days.map((d) => (
        <div key={d.date} className={`week-col ${d.date === today ? 'is-today' : ''}`} title={`${d.date}: ${rupees(d.total)} · ${d.bills} bills`}>
          <span className="week-amt num">{d.total ? rupees(d.total) : ''}</span>
          <span className="week-bar" style={{ height: `${Math.max(2, (d.total / max) * 100)}%` }} />
          <span className="week-day">{d.date === today ? t('Today', 'आज', 'Aaj') : dayName.format(new Date(`${d.date}T00:00:00`))}</span>
        </div>
      ))}
    </div>
  );
}
