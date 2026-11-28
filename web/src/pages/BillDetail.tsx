import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, FileJson, IndianRupee, MessageCircle, PencilLine, Printer, Undo2 } from 'lucide-react';
import { download, get, post } from '../lib/api';
import { billShareMessage, fetchBillPdfUrl, hasPhone, openBillPdf, openWa } from '../lib/shareBill';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';
import { dateLabel, qty as fmtQty, rupees, todayStr } from '../lib/format';
import type { Customer, Invoice } from '../lib/types';
import { BillStatusBadge, Button, Drawer, Field, Input, Money, Segmented, SkelRows, useToast } from '../components/ui';
import { usePageTitle } from '../components/shell/AppShell';

interface Item { id: number; product_id: number; product_name: string; qty: number; sell_price: number; gst_rate: number; amount: number; hsn_code: string; p_unit: string; returned_qty: number; returnable_qty: number; profit?: number }
interface Detail {
  invoice: Invoice;
  business: { name: string; owner_name: string; phone: string; city: string; gstin: string; gst_enabled: boolean; upi_id: string };
  upi_qr: { payload: string; svg: string } | null;
  customer: Customer | null;
  items: Item[];
  payments: { id: number; amount: number; mode: string; date: string }[];
  returns: { id: number; date: string; total: number; reason?: string | null }[];
  returns_total: number; net_total: number; net_pending: number; profit?: number;
}

const maskGstin = (g: string) => g; // full GSTIN, same as the bill PDF
export default function BillDetailPage() {
  const { id } = useParams();
  const [sp, setSp] = useSearchParams();
  const { t, err } = useI18n();
  const { can } = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['invoice', id], queryFn: () => get<Detail>(`/api/invoices/${id}`) });
  const [pay, setPay] = useState(false);
  const [ret, setRet] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [reason, setReason] = useState('');
  // 12-features pack: one-tap WhatsApp update after a payment or a cancel
  // (manual wa.me, never auto-sent).
  const [updateNote, setUpdateNote] = useState<{ kind: 'cancel' | 'payment'; amount: number } | null>(null);
  const d = q.data;
  usePageTitle(d ? `${t('Bill', 'बिल', 'Bill')} #${d.invoice.bill_no}` : t('Bill', 'बिल', 'Bill'));

  const printPdf = () => { if (d) openBillPdf(d.invoice.id, d.invoice.bill_no).catch((e) => toast({ text: err(e), tone: 'error' })); };
  useEffect(() => {
    // ?print=1 (from the counter): open the same PDF the customer gets.
    if (d && sp.get('print') === '1') { sp.delete('print'); setSp(sp, { replace: true }); printPdf(); }
  }, [d]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['invoice', id] });
    ['invoices', 'customers', 'dash-summary', 'alerts', 'day-end', 'dash-finance', 'billing-products', 'returns'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    if (d?.customer) qc.invalidateQueries({ queryKey: ['customer', String(d.customer.id)] });
  };

  const [waBusy, setWaBusy] = useState(false);
  const [askPhone, setAskPhone] = useState(false);
  const [phoneVal, setPhoneVal] = useState('');
  const pdfUrlRef = useRef<string | undefined>(undefined);

  // WhatsApp par bill bhejo — seedha customer ki chat khulti hai, message
  // text ready milta hai, bas Send dabana hai. Text-only: wa.me se file
  // attach nahi ho sakti, isliye message me bill ki public PDF link hoti
  // hai — customer tap kare to PDF khul jati hai, bina login ke.
  const whatsapp = async () => {
    if (!d) return;
    setWaBusy(true);
    try {
      const shop = d.business.name || 'BizYour';
      const balance = d.net_pending ?? inv.pending_amount;
      // Public PDF link for the message (best-effort: the share still
      // works without it if the link fetch fails).
      let pdfUrl: string | undefined;
      try { pdfUrl = await fetchBillPdfUrl(inv.id); } catch { pdfUrl = undefined; }
      pdfUrlRef.current = pdfUrl;
      const msg = billShareMessage(t, { shop, customerName: inv.customer_name, billNo: inv.bill_no, total: inv.total, balance, attached: false, pdfUrl });
      if (hasPhone(d.customer?.phone)) {
        openWa(d.customer!.phone!, msg);
      } else {
        setAskPhone(true);
      }
    } catch (e) { toast({ text: err(e), tone: 'error' }); } finally { setWaBusy(false); }
  };
  const sendToNumber = () => {
    if (!d) return;
    const balance = d.net_pending ?? inv.pending_amount;
    const msg = billShareMessage(t, { shop: d.business.name || 'BizYour', customerName: inv.customer_name, billNo: inv.bill_no, total: inv.total, balance, attached: false, pdfUrl: pdfUrlRef.current });
    if (openWa(phoneVal, msg)) {
      setAskPhone(false);
    } else {
      toast({ text: t('Enter a valid mobile number', 'सही मोबाइल नंबर लिखें', 'Sahi mobile number likho'), tone: 'error' });
    }
  };

  if (q.isLoading) return <div className="page"><SkelRows rows={10} /></div>;
  if (!d) return <div className="page"><p>{err(q.error)}</p></div>;
  const inv = d.invoice;
  const words = { today: t('Today', 'आज', 'Aaj'), yesterday: t('Yesterday', 'कल', 'Kal') };
  const pending = d.net_pending ?? inv.pending_amount;
  const canReturn = !inv.cancelled && d.items.some((i) => i.returnable_qty > 0);

  return (
    <div className="page">
      <div className="no-print">
        <Link to="/bills" className="back-link"><ArrowLeft size={14} /> {t('Bills', 'बिल', 'Bills')}</Link>
        <header className="page-head" style={{ alignItems: 'center' }}>
          <div className="grow">
            <div className="row" style={{ gap: 12 }}>
              <h1>{t('Bill', 'बिल', 'Bill')} #{inv.bill_no}</h1>
              <BillStatusBadge status={inv.status} cancelled={inv.cancelled} />
            </div>
            <p className="page-sub">{inv.customer_name} · {dateLabel(inv.date, words)}</p>
          </div>
        </header>
      </div>

      {updateNote && (
        <div className="banner banner-info no-print" style={{ marginBottom: 16 }}>
          <span className="grow">
            {updateNote.kind === 'payment'
              ? t(`Payment of ${rupees(updateNote.amount)} recorded for bill #${inv.bill_no}. Balance now ${rupees(pending)}.`, `बिल #${inv.bill_no} पर ${rupees(updateNote.amount)} भुगतान दर्ज। अब बाकी ${rupees(pending)}।`, `Bill #${inv.bill_no} par ${rupees(updateNote.amount)} payment darj. Ab baaki ${rupees(pending)}.`)
              : t(`Bill #${inv.bill_no} (${rupees(updateNote.amount)}) is cancelled.`, `बिल #${inv.bill_no} (${rupees(updateNote.amount)}) रद्द हुआ।`, `Bill #${inv.bill_no} (${rupees(updateNote.amount)}) cancel hua.`)}
          </span>
          <Button size="sm" icon={<MessageCircle size={14} />} disabled={!d.customer?.phone} onClick={() => {
            const shop = d.business.name || 'BizYour';
            const msg = updateNote.kind === 'payment'
              ? t(`Namaste ${inv.customer_name} ji, this is ${shop} — your payment of ${rupees(updateNote.amount)} for bill #${inv.bill_no} is received. Thank you! Balance now: ${rupees(pending)}.`, `नमस्ते ${inv.customer_name} जी, ${shop} की ओर से — बिल #${inv.bill_no} पर आपका ${rupees(updateNote.amount)} भुगतान मिल गया। धन्यवाद! अब बाकी: ${rupees(pending)}।`, `Namaste ${inv.customer_name} ji, ${shop} se — bill #${inv.bill_no} par aapka ${rupees(updateNote.amount)} payment mil gaya. Dhanyavaad! Ab baaki: ${rupees(pending)}.`)
              : t(`Namaste ${inv.customer_name} ji, this is ${shop} — bill #${inv.bill_no} (${rupees(updateNote.amount)}) is cancelled. Please ignore the earlier bill.`, `नमस्ते ${inv.customer_name} जी, ${shop} की ओर से — बिल #${inv.bill_no} (${rupees(updateNote.amount)}) रद्द हुआ। पुराना बिल भूल जाएं।`, `Namaste ${inv.customer_name} ji, ${shop} se — bill #${inv.bill_no} (${rupees(updateNote.amount)}) cancel hua. Purana bill bhool jao.`);
            if (!openWa(d.customer!.phone!, msg)) toast({ text: t('No mobile number for this customer', 'इस ग्राहक का mobile number नहीं है', 'Is customer ka mobile number nahi hai'), tone: 'error' });
          }}>{t('Tell them on WhatsApp', 'WhatsApp पर बताएं', 'WhatsApp pe batao')}</Button>
          <Button size="sm" variant="ghost" onClick={() => setUpdateNote(null)}>{t('Dismiss', 'हटाएं', 'Hatao')}</Button>
        </div>
      )}

      <div className="detail-grid">
        <article className="invoice-doc" aria-label={t('Bill', 'बिल', 'Bill')}>
          <header className="doc-head">
            <div>
              <div className="doc-biz">{d.business.name}</div>
              <div className="doc-muted">{[d.business.city, d.business.phone].filter(Boolean).join(' · ')}</div>
              {d.business.gst_enabled && d.business.gstin && <div className="doc-muted">GSTIN {maskGstin(d.business.gstin)}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="doc-title">{d.business.gst_enabled ? t('Tax invoice', 'टैक्स इनवॉइस', 'Tax invoice') : t('Bill', 'बिल', 'Bill')}</div>
              <div className="doc-muted num">#{inv.bill_no} · {inv.date}</div>
              {inv.due_date && pending > 0 && <div className="doc-muted">{t('Pay by', 'कब तक', 'Kab tak')} {inv.due_date}</div>}
            </div>
          </header>
          <div className="doc-to">
            <span className="doc-muted">{t('Billed to', 'ग्राहक', 'Customer')}</span>
            <div style={{ fontWeight: 500 }}>{inv.customer_name}</div>
            {d.customer?.phone && <div className="doc-muted">{d.customer.phone}</div>}
            {d.customer?.gstin && <div className="doc-muted">GSTIN {maskGstin(d.customer.gstin)}</div>}
          </div>
          <table className="doc-table">
            <thead><tr><th>{t('Item', 'सामान', 'Saaman')}</th><th className="r">{t('Qty', 'मात्रा', 'Qty')}</th><th className="r">{t('Rate', 'भाव', 'Rate')}</th>{inv.gst_enabled && <th className="r">GST</th>}<th className="r">{t('Amount', 'रकम', 'Rakam')}</th>{d.profit != null && <th className="r">{t('Profit', 'लाभ', 'Profit')}</th>}</tr></thead>
            <tbody>{d.items.map((it) => (
              <tr key={it.id}>
                <td>{it.product_name}{it.hsn_code && <span className="doc-muted"> · HSN {it.hsn_code}</span>}{it.returned_qty > 0 && <span className="doc-muted"> · {fmtQty(it.returned_qty)} {t('returned', 'वापस', 'wapas')}</span>}</td>
                <td className="r num">{fmtQty(it.qty)} {it.p_unit}</td>
                <td className="r num">{rupees(it.sell_price)}</td>
                {inv.gst_enabled && <td className="r num">{it.gst_rate}%</td>}
                <td className="r num">{rupees(it.amount)}</td>
                {d.profit != null && <td className="r num">{it.profit != null ? rupees(it.profit) : '—'}</td>}
              </tr>
            ))}</tbody>
          </table>
          <div className="doc-foot">
            <div className="doc-qr">
              {d.upi_qr && (
                <>
                  <img src={`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(d.upi_qr.svg)))}`} alt={t('UPI QR for the balance', 'बाकी रकम का UPI QR', 'Baaki rakam ka UPI QR')} width={112} height={112} />
                  <span className="doc-muted">{t('Scan to pay', 'Scan करके pay करें', 'Scan karke pay karo')} {rupees(pending)}</span>
                </>
              )}
            </div>
            <dl className="doc-sums">
              <div><dt>{t('Items', 'सामान', 'Saaman')}</dt><dd className="num">{rupees(inv.subtotal)}</dd></div>
              {inv.discount > 0 && <div><dt>{t('Discount', 'छूट', 'Discount')}</dt><dd className="num">−{rupees(inv.discount)}</dd></div>}
              {inv.gst_enabled && <div className="doc-muted"><dt>{t('GST included', 'GST शामिल', 'GST shaamil')} (CGST {rupees(inv.gst_amount / 2, { paise: true })} + SGST {rupees(inv.gst_amount / 2, { paise: true })})</dt><dd className="num">{rupees(inv.gst_amount, { paise: true })}</dd></div>}
              <div className="doc-total"><dt>{t('Total', 'कुल', 'Kul')}</dt><dd className="num">{rupees(inv.total)}</dd></div>
              {d.profit != null && <div className={d.profit < 0 ? 'money-owed' : 'money-ok'}><dt>{t('Profit on this bill', 'इस बिल पर लाभ', 'Is bill par profit')}</dt><dd className="num">{rupees(d.profit)}</dd></div>}
              {d.returns_total > 0 && <div><dt>{t('Returned', 'वापसी', 'Wapsi')}</dt><dd className="num">−{rupees(d.returns_total)}</dd></div>}
              <div><dt>{t('Paid', 'मिला', 'Mila')}</dt><dd className="num">{rupees(inv.paid_amount)}</dd></div>
              <div className={pending > 0 ? 'money-owed' : ''}><dt>{t('Balance', 'बाकी', 'Baaki')}</dt><dd className="num">{rupees(pending)}</dd></div>
            </dl>
          </div>
          {inv.cancelled && <div className="doc-cancel">{t('Cancelled', 'रद्द', 'Cancel')}{inv.cancel_reason ? ` — ${inv.cancel_reason}` : ''}</div>}
          <p className="doc-thanks">{t('Thank you!', 'धन्यवाद!', 'Dhanyavaad!')}</p>
        </article>

        <aside className="detail-side no-print">
          <section className="panel panel-body stack">
            {!inv.cancelled && pending > 0 && <Button variant="primary" block icon={<IndianRupee size={16} />} onClick={() => setPay(true)}>{t('Record payment', 'भुगतान दर्ज करें', 'Payment likho')}</Button>}
            <Button block onClick={whatsapp} loading={waBusy}>{t('Send bill on WhatsApp', 'WhatsApp पर बिल भेजें', 'WhatsApp par bill bhejo')}</Button>
            {askPhone && (
              <div className="stack" style={{ gap: 8 }}>
                <p className="muted" style={{ fontSize: 13, margin: 0 }}>{t('No mobile number on this bill. Enter the customer’s number — the WhatsApp chat will open with the message ready.', 'इस बिल पर मोबाइल नंबर नहीं है। ग्राहक का नंबर लिखें — WhatsApp चैट मैसेज के साथ खुलेगी।', 'Is bill par mobile number nahi hai. Customer ka number likho — WhatsApp chat message ke saath khulegi.')}</p>
                <Input inputMode="tel" placeholder="98XXXXXXXX" value={phoneVal} onChange={(e) => setPhoneVal(e.target.value)} autoFocus />
                <Button variant="primary" block onClick={sendToNumber}>{t('Open WhatsApp', 'WhatsApp खोलें', 'WhatsApp kholo')}</Button>
              </div>
            )}
            <Button block icon={<Printer size={16} />} onClick={printPdf}>{t('Print or save PDF', 'प्रिंट या PDF', 'Print ya PDF')}</Button>
            {canReturn && <Button block icon={<Undo2 size={16} />} onClick={() => setRet(true)}>{t('Return items', 'सामान वापसी', 'Saaman wapsi')}</Button>}
            {!inv.cancelled && can.owner && inv.kind === 'sale' && (d.returns.length
              ? <p className="muted" style={{ fontSize: 12.5, margin: 0, textAlign: 'center' }}>{t('Bills with returned items can’t be edited.', 'वापसी वाले बिल नहीं बदलते।', 'Wapsi wale bill nahi badalte.')}</p>
              : <Link className="btn btn-secondary btn-block" to={`/pos?edit=${inv.id}`}><PencilLine size={16} /> {t('Edit bill', 'बिल बदलें', 'Bill badlo')}</Link>)}
            {!inv.cancelled && <Button variant="danger" block icon={<Ban size={16} />} onClick={() => setCancel(true)}>{t('Cancel bill', 'बिल रद्द करें', 'Bill cancel karo')}</Button>}
          </section>

          {d.payments.length > 0 && (
            <section className="panel">
              <header className="panel-head"><h2>{t('Payments', 'भुगतान', 'Payments')}</h2></header>
              <div className="list">{d.payments.map((p) => (
                <div key={p.id} className="list-row" style={{ cursor: 'default' }}>
                  <div className="grow"><div className="title">{p.mode}</div><div className="meta">{dateLabel(p.date, words)}</div></div>
                  <Money value={p.amount} tone="in" />
                </div>
              ))}</div>
            </section>
          )}
          {d.returns.length > 0 && (
            <section className="panel">
              <header className="panel-head"><h2>{t('Returns', 'वापसी', 'Wapsi')}</h2></header>
              <div className="list">{d.returns.map((r) => (
                <div key={r.id} className="list-row" style={{ cursor: 'default' }}>
                  <div className="grow"><div className="title">{dateLabel(r.date, words)}</div>{r.reason && <div className="meta">{r.reason}</div>}</div>
                  <Money value={r.total} />
                </div>
              ))}</div>
            </section>
          )}
          {inv.gst_enabled && can.billing && !inv.cancelled && (
            <section className="panel panel-body stack" style={{ gap: 8 }}>
              <div className="muted" style={{ fontSize: 13 }}>{t('For the GST portal', 'GST portal के लिए', 'GST portal ke liye')}</div>
              <Button size="sm" block icon={<FileJson size={14} />} onClick={() => download(`/api/invoices/${id}/eway-json`, `eway-${inv.bill_no}.json`).catch((e) => toast({ text: err(e), tone: 'error' }))}>{t('E-way bill JSON', 'E-way bill JSON', 'E-way bill JSON')}</Button>
              <Button size="sm" block icon={<FileJson size={14} />} onClick={() => download(`/api/invoices/${id}/einvoice-json`, `einvoice-${inv.bill_no}.json`).catch((e) => toast({ text: err(e), tone: 'error' }))}>{t('E-invoice JSON', 'E-invoice JSON', 'E-invoice JSON')}</Button>
            </section>
          )}
        </aside>
      </div>

      <PaymentDrawer open={pay} onClose={() => setPay(false)} max={pending} title={`${t('Payment for bill', 'बिल का भुगतान', 'Bill ka payment')} #${inv.bill_no}`}
        onSave={async (amount, mode, date) => { await post(`/api/invoices/${id}/payments`, { amount, mode, date }); toast({ text: t(`${rupees(amount)} recorded`, `${rupees(amount)} दर्ज हुआ`, `${rupees(amount)} likh diya`) }); setUpdateNote({ kind: 'payment', amount }); refresh(); }} />

      <ReturnDrawer open={ret} onClose={() => setRet(false)} items={d.items}
        onSave={async (items, reason) => { await post(`/api/invoices/${id}/returns`, { items, reason }); toast({ text: t('Return saved — stock added back', 'वापसी सेव — stock वापस जुड़ा', 'Wapsi save — stock wapas juda') }); refresh(); }} />

      <Drawer open={cancel} onClose={() => setCancel(false)} title={t('Cancel this bill?', 'यह बिल रद्द करें?', 'Ye bill cancel karein?')}
        footer={<><Button onClick={() => setCancel(false)}>{t('Keep bill', 'बिल रखें', 'Bill rakho')}</Button><CancelBtn id={id!} reason={reason} onDone={() => { setCancel(false); setReason(''); setUpdateNote({ kind: 'cancel', amount: inv.total }); refresh(); }} /></>}>
        <p className="muted" style={{ marginBottom: 16 }}>{t('Stock goes back and the bill stops counting in sales and udhaar. The bill number stays in your records marked as cancelled.', 'Stock वापस आएगा और बिल बिक्री व उधार में नहीं गिना जाएगा। बिल नंबर रद्द के रूप में रिकॉर्ड में रहेगा।', 'Stock wapas aayega aur bill bikri aur udhaar me nahi ginega. Bill number cancel ke roop me record me rahega.')}</p>
        <Field label={t('Reason', 'कारण', 'Kaaran')}>{(fid) => <Input id={fid} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('e.g. wrong items entered', 'जैसे गलत सामान', 'jaise galat saaman')} autoFocus />}</Field>
      </Drawer>
    </div>
  );
}

function CancelBtn({ id, reason: raw, onDone }: { id: string; reason: string; onDone: () => void }) {
  const { t, err } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button variant="danger" loading={busy} onClick={async () => {
      const reason = raw.trim();
      if (!reason) { toast({ text: t('Write a reason to cancel.', 'रद्द करने का कारण लिखें।', 'Cancel karne ka kaaran likho.'), tone: 'error' }); return; }
      setBusy(true);
      try { await post(`/api/invoices/${id}/cancel`, { reason }); toast({ text: t('Bill cancelled', 'बिल रद्द हुआ', 'Bill cancel hua') }); onDone(); }
      catch (e) { toast({ text: err(e), tone: 'error' }); } finally { setBusy(false); }
    }}>{t('Cancel bill', 'बिल रद्द करें', 'Bill cancel karo')}</Button>
  );
}

export function PaymentDrawer({ open, onClose, max, title, onSave, note }: {
  open: boolean; onClose: () => void; max: number; title: string; note?: string;
  onSave: (amount: number, mode: string, date: string) => Promise<void>;
}) {
  const { t, err } = useI18n();
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('Cash');
  const [date, setDate] = useState(todayStr());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setAmount(String(max || '')); setMode('Cash'); setDate(todayStr()); setError(''); } }, [open, max]);
  const n = Number(amount);
  const submit = async () => {
    if (!(n > 0)) { setError(t('Enter an amount.', 'रकम लिखें।', 'Rakam likho.')); return; }
    if (n > max + 0.001) { setError(t(`That’s more than the ${rupees(max)} due.`, `${rupees(max)} बाकी से ज़्यादा है।`, `${rupees(max)} baaki se zyada hai.`)); return; }
    setBusy(true); setError('');
    try { await onSave(n, mode, date); onClose(); } catch (e) { setError(err(e)); } finally { setBusy(false); }
  };
  return (
    <Drawer open={open} onClose={onClose} title={title}
      footer={<><Button onClick={onClose}>{t('Close', 'बंद', 'Band')}</Button><Button variant="primary" loading={busy} onClick={submit}>{t('Save payment', 'भुगतान सेव करें', 'Payment save karo')}</Button></>}>
      <div className="stack" style={{ gap: 18 }}>
        <div className="banner banner-info">{t('Due', 'बाकी', 'Baaki')}: <b className="num">{rupees(max)}</b>{note ? ` · ${note}` : ''}</div>
        <Field label={t('Amount received', 'मिली रकम', 'Mili rakam')} error={error}>
          {(id) => <Input id={id} size2="lg" numeric inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} autoFocus onFocus={(e) => e.target.select()} onKeyDown={(e) => e.key === 'Enter' && submit()} />}
        </Field>
        <Field label={t('How', 'कैसे', 'Kaise')}>
          {() => <Segmented label={t('Mode', 'तरीका', 'Mode')} value={mode} onChange={setMode} options={[{ value: 'Cash', label: t('Cash', 'नकद', 'Cash') }, { value: 'UPI', label: 'UPI' }, { value: 'Bank', label: t('Bank', 'बैंक', 'Bank') }]} />}
        </Field>
        <Field label={t('Date', 'तारीख', 'Date')}>{(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
      </div>
    </Drawer>
  );
}

function ReturnDrawer({ open, onClose, items, onSave }: { open: boolean; onClose: () => void; items: Item[]; onSave: (items: { invoice_item_id: number; qty: number }[], reason: string) => Promise<void> }) {
  const { t, err } = useI18n();
  const [qty, setQty] = useState<Record<number, string>>({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setQty({}); setReason(''); setError(''); } }, [open]);
  const chosen = items.map((i) => ({ i, n: Math.min(i.returnable_qty, Number(qty[i.id]) || 0) })).filter((x) => x.n > 0);
  const value = chosen.reduce((s, x) => s + x.n * x.i.sell_price, 0);
  return (
    <Drawer open={open} onClose={onClose} title={t('Return items', 'सामान वापसी', 'Saaman wapsi')}
      footer={<><Button onClick={onClose}>{t('Close', 'बंद', 'Band')}</Button><Button variant="primary" loading={busy} disabled={!chosen.length} onClick={async () => {
        setBusy(true); setError('');
        try { await onSave(chosen.map((x) => ({ invoice_item_id: x.i.id, qty: x.n })), reason); onClose(); } catch (e) { setError(err(e)); } finally { setBusy(false); }
      }}>{t('Save return', 'वापसी सेव करें', 'Wapsi save karo')} {value > 0 ? `· ${rupees(value)}` : ''}</Button></>}>
      <div className="stack" style={{ gap: 12 }}>
        <p className="muted">{t('Returned items go back into stock and reduce what this bill counts for.', 'वापस सामान stock में जुड़ेगा और बिल की रकम घटेगी।', 'Wapas saaman stock me judega aur bill ki rakam ghategi.')}</p>
        {items.map((i) => (
          <div key={i.id} className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <div className="grow"><div style={{ fontWeight: 500 }}>{i.product_name}</div><div className="muted" style={{ fontSize: 12 }}>{t('Can return', 'वापस हो सकता', 'Wapas ho sakta')} {fmtQty(i.returnable_qty)} · {rupees(i.sell_price)}</div></div>
            <Input numeric inputMode="decimal" style={{ width: 90 }} disabled={i.returnable_qty <= 0} placeholder="0" value={qty[i.id] || ''} onChange={(e) => setQty((m) => ({ ...m, [i.id]: e.target.value.replace(/[^\d.]/g, '') }))} aria-label={`${i.product_name} ${t('return qty', 'वापसी मात्रा', 'wapsi qty')}`} />
          </div>
        ))}
        <Field label={t('Reason (optional)', 'कारण (अगर हो)', 'Kaaran (optional)')}>{(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
        {error && <div className="banner banner-owed">{error}</div>}
      </div>
    </Drawer>
  );
}
