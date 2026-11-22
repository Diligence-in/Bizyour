// Indian number formatting (lakh/crore grouping) and dates.

const inr0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₹1,23,456 — paise shown only when the amount has them. */
export function rupees(n: number | null | undefined, opts: { paise?: boolean; sign?: boolean } = {}): string {
  const v = Number(n || 0);
  const abs = Math.abs(v);
  const hasPaise = Math.round(abs * 100) % 100 !== 0;
  const body = (opts.paise || hasPaise ? inr2 : inr0).format(abs);
  const sign = v < 0 ? '−' : opts.sign && v > 0 ? '+' : '';
  return `${sign}₹${body}`;
}

/** Compact for tight spots: ₹1.2L, ₹3.4Cr. */
export function rupeesCompact(n: number): string {
  const v = Math.abs(Number(n || 0));
  const sign = n < 0 ? '−' : '';
  if (v >= 1e7) return `${sign}₹${(v / 1e7).toFixed(v >= 1e8 ? 0 : 1)}Cr`;
  if (v >= 1e5) return `${sign}₹${(v / 1e5).toFixed(v >= 1e6 ? 0 : 1)}L`;
  return rupees(n);
}

export function qty(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000);
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** GST part of a GST-inclusive amount — same formula as the server. */
export const gstPart = (amount: number, rate: number) => (rate > 0 ? (amount * rate) / (100 + rate) : 0);

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const dShort = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const dLong = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function parseDate(s: string): Date { return new Date(`${s.slice(0, 10)}T00:00:00`); }

/** "Today", "Yesterday", "18 Nov", or "18 Nov 2025" for other years. */
export function dateLabel(s: string | null | undefined, words?: { today: string; yesterday: string }): string {
  if (!s) return '—';
  const d = parseDate(s);
  const t = parseDate(todayStr());
  const diff = Math.round((t.getTime() - d.getTime()) / 86400000);
  if (words && diff === 0) return words.today;
  if (words && diff === 1) return words.yesterday;
  return d.getFullYear() === t.getFullYear() ? dShort.format(d) : dLong.format(d);
}
export const longToday = (lang = 'en') => new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

export function daysFromToday(s: string): number {
  return Math.round((parseDate(s).getTime() - parseDate(todayStr()).getTime()) / 86400000);
}

export function initials(name: string): string {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');
}

/** Same normalisation as the server's wa.me links: 10-digit → 91XXXXXXXXXX. */
export function waPhone(raw: string): string {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = '91' + d;
  return d.length >= 11 ? d : '';
}
