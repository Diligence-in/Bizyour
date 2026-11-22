import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { monthLabel, ymNow, ymShift } from '../lib/months';

// ‹ November 2026 › — steps one month at a time; the next arrow stops at the current month.
export function MonthNav({ value, onChange }: { value: string; onChange: (ym: string) => void }) {
  const { t, lang } = useI18n();
  return (
    <div className="month-nav">
      <button className="icon-btn" aria-label={t('Previous month', 'पिछला महीना', 'Pichla mahina')} onClick={() => onChange(ymShift(value, -1))}><ChevronLeft size={18} /></button>
      <span className="month-nav-label">{monthLabel(value, lang)}</span>
      <button className="icon-btn" aria-label={t('Next month', 'अगला महीना', 'Agla mahina')} disabled={value >= ymNow()} onClick={() => onChange(ymShift(value, 1))}><ChevronRight size={18} /></button>
    </div>
  );
}

export function Bars({ rows, tone }: { rows: { label: string; value: number }[]; tone?: 'mart' }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="bars">{rows.map((r) => (
      <div key={r.label} className="bar-row">
        <span className="bar-name ellipsis">{r.label}</span>
        <span className="bar-track"><span className={`bar-fill${tone ? ` bar-${tone}` : ''}`} style={{ width: `${Math.max(3, Math.round((r.value / max) * 100))}%` }} /></span>
        <span className="bar-val num">{r.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
      </div>
    ))}</div>
  );
}

// Column chart for day-by-day sales.
export function Columns({ days }: { days: { date: string; total: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.total));
  const every = days.length > 16 ? Math.ceil(days.length / 10) : 1;
  return (
    <div className="cols" role="img" aria-label="Daily sales">
      {days.map((d, i) => (
        <div key={d.date} className="col" title={`${d.date}: ₹${d.total.toLocaleString('en-IN')}`}>
          <span className="col-bar" style={{ height: `${d.total ? Math.max(3, Math.round((d.total / max) * 100)) : 0}%` }} />
          <span className="col-lab">{i % every === 0 ? Number(d.date.slice(8)) : ''}</span>
        </div>
      ))}
    </div>
  );
}
