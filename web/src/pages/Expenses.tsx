import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { del, get, post, put } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { dateLabel, rupees, todayStr } from '../lib/format';
import { EXPENSE_CATS, ymNow, ymRange } from '../lib/months';
import { Badge, Button, Drawer, Empty, Field, Input, Modal, Panel, Segmented, Select, SkelRows, useToast } from '../components/ui';
import { ExportMenu } from '../components/ExportMenu';
import { Bars, MonthNav } from '../components/MonthNav';
import { PageHeader, useIsMobile, usePageTitle } from '../components/shell/AppShell';

interface Expense { id: number; title: string; category: string; amount: number; date: string; payment_mode: string; notes: string }

export default function ExpensesPage() {
  const { t, err } = useI18n();
  const mobile = useIsMobile();
  const toast = useToast();
  const qc = useQueryClient();
  usePageTitle(t('Expenses', 'खर्चा', 'Kharcha'));
  const [ym, setYm] = useState(ymNow());
  const [edit, setEdit] = useState<Expense | 'new' | null>(null);
  const [gone, setGone] = useState<Expense | null>(null);
  const range = ymRange(ym);
  const q = useQuery({ queryKey: ['expenses', ym], queryFn: () => get<{ expenses: Expense[]; total: number }>(`/api/expenses?from=${range.from}&to=${range.to}`) });
  const rows = q.data?.expenses || [];
  const cat = (k: string) => { const c = EXPENSE_CATS[k]; return c ? t(c[0], c[1], c[2]) : k; };
  const byCat = Object.entries(rows.reduce<Record<string, number>>((m, e) => { m[e.category] = (m[e.category] || 0) + Number(e.amount); return m; }, {})).sort((a, b) => b[1] - a[1]);
  const words = { today: t('Today', 'आज', 'Aaj'), yesterday: t('Yesterday', 'कल', 'Kal') };
  const refresh = () => ['expenses', 'finance', 'summary'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  const remove = async () => {
    if (!gone) return;
    try { await del(`/api/expenses/${gone.id}`); refresh(); toast({ text: t('Expense deleted', 'खर्चा हटाया', 'Kharcha hataya') }); setGone(null); }
    catch (e) { toast({ text: err(e), tone: 'error' }); }
  };

  return (
    <div className="page">
      <PageHeader title={t('Expenses', 'खर्चा', 'Kharcha')}
        sub={t('Rent, salary, electricity — what the shop spends to run. Stock you buy is under Purchases.', 'किराया, तनख़्वाह, बिजली — दुकान चलाने का खर्चा। माल की खरीद Purchases में है।', 'Kiraya, tankhwah, bijli — dukaan chalane ka kharcha. Maal ki khareed Purchases me hai.')}
        actions={<>
          <ExportMenu path="/api/export/expenses" name="expenses" />
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEdit('new')}>{t('Add expense', 'खर्चा जोड़ें', 'Kharcha jodo')}</Button>
        </>} />
      <div className="toolbar">
        <MonthNav value={ym} onChange={setYm} />
        <span className="grow" />
        <span className="muted">{t('This month', 'इस महीने', 'Is mahine')} <b className="num" style={{ color: 'var(--ink)', fontSize: 20, marginLeft: 6 }}>{q.data ? rupees(q.data.total) : '—'}</b></span>
      </div>
      <div className="two-col" style={{ gridTemplateColumns: byCat.length && !mobile ? '1fr 2fr' : '1fr' }}>
        {byCat.length > 0 && <Panel title={t('Where it went', 'कहाँ गया', 'Kahan gaya')}><Bars rows={byCat.map(([k, v]) => ({ label: cat(k), value: v }))} /></Panel>}
        <section className="panel">
          {q.isLoading ? <SkelRows rows={5} /> : !rows.length ? (
            <Empty icon={<Wallet size={28} />} title={t('No expenses this month', 'इस महीने कोई खर्चा नहीं', 'Is mahine koi kharcha nahi')}
              body={t('Add rent, salary or any bill — your profit on the Home screen accounts for it.', 'किराया, तनख़्वाह या कोई भी बिल जोड़ें — Home पर मुनाफ़ा उसी हिसाब से दिखेगा।', 'Kiraya, tankhwah ya koi bill jodo — Home par munafa usi hisab se dikhega.')}
              action={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setEdit('new')}>{t('Add expense', 'खर्चा जोड़ें', 'Kharcha jodo')}</Button>} />
          ) : mobile ? (
            <div className="list">{rows.map((e) => (
              <button key={e.id} className="list-row" onClick={() => setEdit(e)}>
                <div className="grow" style={{ minWidth: 0 }}><div className="title ellipsis">{e.title}</div><div className="meta">{cat(e.category)} · {dateLabel(e.date, words)} · {e.payment_mode}</div></div>
                <span className="num" style={{ fontWeight: 500 }}>{rupees(e.amount)}</span>
              </button>
            ))}</div>
          ) : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>{t('Date', 'तारीख', 'Date')}</th><th>{t('What for', 'किसलिए', 'Kisliye')}</th><th>{t('Type', 'प्रकार', 'Type')}</th><th>{t('Paid by', 'कैसे दिया', 'Kaise diya')}</th><th className="r">{t('Amount', 'रकम', 'Rakam')}</th><th /></tr></thead>
              <tbody>{rows.map((e) => (
                <tr key={e.id}>
                  <td>{dateLabel(e.date, words)}</td>
                  <td className="primary">{e.title}{e.notes && <span className="sub">{e.notes}</span>}</td>
                  <td><Badge plain>{cat(e.category)}</Badge></td>
                  <td className="muted">{e.payment_mode}</td>
                  <td className="r num">{rupees(e.amount)}</td>
                  <td className="r" style={{ whiteSpace: 'nowrap' }}>
                    <button className="icon-btn icon-btn-sm" aria-label={t('Edit', 'बदलें', 'Badlo')} onClick={() => setEdit(e)}><Pencil size={15} /></button>
                    <button className="icon-btn icon-btn-sm" aria-label={t('Delete', 'हटाएं', 'Hatao')} onClick={() => setGone(e)}><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </section>
      </div>
      <ExpenseDrawer item={edit} onClose={() => setEdit(null)} onSaved={(d) => { if (d) setYm(d.slice(0, 7)); refresh(); }} onDelete={(e) => { setEdit(null); setGone(e); }} />
      <Modal open={!!gone} onClose={() => setGone(null)} label={t('Delete expense', 'खर्चा हटाएं', 'Kharcha hatao')}>
        <div className="stack" style={{ gap: 12, padding: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{t('Delete this expense?', 'यह खर्चा हटाएं?', 'Yeh kharcha hatao?')}</h2>
          <p className="muted" style={{ margin: 0 }}>{gone?.title} · {gone ? rupees(gone.amount) : ''}</p>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}><Button onClick={() => setGone(null)}>{t('Keep it', 'रहने दें', 'Rehne do')}</Button><Button variant="danger" onClick={remove}>{t('Delete', 'हटाएं', 'Hatao')}</Button></div>
        </div>
      </Modal>
    </div>
  );
}

function ExpenseDrawer({ item, onClose, onSaved, onDelete }: { item: Expense | 'new' | null; onClose: () => void; onSaved: (date?: string) => void; onDelete: (e: Expense) => void }) {
  const { t, err } = useI18n();
  const toast = useToast();
  const e = item && item !== 'new' ? item : null;
  const [title, setTitle] = useState(''); const [category, setCategory] = useState('Other'); const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr()); const [mode, setMode] = useState('Cash'); const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    if (!item) return;
    setTitle(e?.title || ''); setCategory(e?.category || 'Other'); setAmount(e ? String(e.amount) : ''); setDate(e?.date || todayStr());
    setMode(e?.payment_mode || 'Cash'); setNotes(e?.notes || ''); setError('');
  }, [item]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    if (!title.trim()) { setError(t('Say what the expense was for.', 'बताएं खर्चा किसलिए था।', 'Batao kharcha kisliye tha.')); return; }
    if (!(Number(amount) > 0)) { setError(t('Enter the amount.', 'रकम डालें।', 'Rakam daalo.')); return; }
    setBusy(true); setError('');
    try {
      const body = { title: title.trim(), category, amount: Number(amount), date, payment_mode: mode, notes: notes.trim() };
      if (e) await put(`/api/expenses/${e.id}`, body); else await post('/api/expenses', body);
      toast({ text: t('Expense saved', 'खर्चा सेव हुआ', 'Kharcha save hua') });
      onSaved(date); onClose();
    } catch (x) { setError(err(x)); } finally { setBusy(false); }
  };
  return (
    <Drawer open={!!item} onClose={onClose} title={e ? t('Edit expense', 'खर्चा बदलें', 'Kharcha badlo') : t('Add expense', 'खर्चा जोड़ें', 'Kharcha jodo')}
      footer={<>{e && <Button variant="ghost" icon={<Trash2 size={15} />} onClick={() => onDelete(e)}>{t('Delete', 'हटाएं', 'Hatao')}</Button>}<span className="grow" /><Button onClick={onClose}>{t('Cancel', 'रद्द', 'Cancel')}</Button><Button variant="primary" loading={busy} onClick={save}>{t('Save expense', 'खर्चा सेव करें', 'Kharcha save karo')}</Button></>}>
      <div className="stack" style={{ gap: 16 }}>
        <Field label={t('What was it for?', 'किसलिए?', 'Kisliye?')}>{(id) => <Input id={id} autoFocus value={title} onChange={(x) => setTitle(x.target.value)} placeholder={t('e.g. Shop rent', 'जैसे दुकान का किराया', 'jaise dukaan ka kiraya')} />}</Field>
        <div className="form-2">
          <Field label={t('Amount ₹', 'रकम ₹', 'Rakam ₹')}>{(id) => <Input id={id} numeric inputMode="decimal" value={amount} onChange={(x) => setAmount(x.target.value.replace(/[^\d.]/g, ''))} />}</Field>
          <Field label={t('Date', 'तारीख', 'Date')}>{(id) => <Input id={id} type="date" value={date} onChange={(x) => setDate(x.target.value)} />}</Field>
        </div>
        <Field label={t('Type', 'प्रकार', 'Type')}>{(id) => <Select id={id} value={category} onChange={(x) => setCategory(x.target.value)}>{Object.entries(EXPENSE_CATS).map(([k, v]) => <option key={k} value={k}>{t(v[0], v[1], v[2])}</option>)}</Select>}</Field>
        <Field label={t('Paid by', 'कैसे दिया', 'Kaise diya')}>{() => <Segmented label="mode" value={mode} onChange={setMode} options={[{ value: 'Cash', label: t('Cash', 'नकद', 'Cash') }, { value: 'UPI', label: 'UPI' }, { value: 'Bank', label: t('Bank', 'बैंक', 'Bank') }]} />}</Field>
        <Field label={t('Note', 'नोट', 'Note')} hint={t('Optional', 'चाहें तो', 'Agar chaho')}>{(id) => <Input id={id} value={notes} onChange={(x) => setNotes(x.target.value)} />}</Field>
        {error && <div className="banner banner-owed" role="alert">{error}</div>}
      </div>
    </Drawer>
  );
}
