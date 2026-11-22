import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Ban, CheckCircle2, MessageCircle, PackageCheck, Phone, Repeat2, Star, Truck } from 'lucide-react';
import { get, post } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useSession } from '../../lib/session';
import { dateLabel, qty as fmtQty, rupees, todayStr } from '../../lib/format';
import { Button, Drawer, Empty, Field, Input, Money, Segmented, SkelRows, Tabs, useToast } from '../../components/ui';
import { PageHeader, useIsMobile, usePageTitle } from '../../components/shell/AppShell';
import { termsText, useMartRefresh, useMartSummary, type Order } from './martApi';
import { OrderSteps } from './martUi';

type Tab = 'buyer' | 'seller' | 'report';
interface Report {
  orders: { order_id: number; order_no: string; product: string; qty: number; unit: string; buy_rate: number; total: number; seller_name: string; sell_price: number | null; margin_per_unit: number | null; expected_margin: number | null; delivered_at: string }[];
  totals: { delivered_orders: number; spend_delivered: number; spend_all: number; expected_margin: number; margin_known_orders: number };
}

export default function MartOrders() {
  const { t } = useI18n();
  const nav = useNavigate();
  const mobile = useIsMobile();
  const [sp, setSp] = useSearchParams();
  usePageTitle(t('Mart orders', 'मार्ट ऑर्डर', 'Mart orders'));
  const { me } = useSession();
  // Selling-side data (summary, report) waits for the workspace setup;
  // buyer orders work on the account alone.
  const wsActive = !!me?.business?.workspace_active;
  const sum = useMartSummary(wsActive);
  const isSeller = !!sum.data?.selling.is_seller;
  const [tab, setTab] = useState<Tab>((sp.get('tab') as Tab) || 'buyer');
  const role = tab === 'seller' ? 'seller' : 'buyer';
  const list = useQuery({ queryKey: ['mart-orders', role], queryFn: () => get<{ orders: Order[] }>(`/api/mart/orders?role=${role}`), enabled: tab !== 'report' });
  const report = useQuery({ queryKey: ['mart-report'], queryFn: () => get<Report>('/api/mart/report'), enabled: tab === 'report' && wsActive });
  const openId = Number(sp.get('open')) || null;
  const words = { today: t('Today', 'आज', 'Aaj'), yesterday: t('Yesterday', 'कल', 'Kal') };
  const rows = list.data?.orders || [];

  return (
    <div className="page mart-page">
      <PageHeader title={t('Mart orders', 'मार्ट ऑर्डर', 'Mart orders')} sub={t('Every order you placed or received on Business Mart.', 'Business Mart पर दिए और मिले सभी ऑर्डर।', 'Business Mart pe diye aur mile sab order.')} />
      <section className="panel">
        <div style={{ padding: '0 16px' }}>
          <Tabs<Tab> label={t('Orders', 'ऑर्डर', 'Orders')} value={tab} onChange={(v) => { setTab(v); sp.set('tab', v); sp.delete('open'); setSp(sp, { replace: true }); }} tabs={[
            { value: 'buyer', label: t('I bought', 'मैंने खरीदा', 'Maine khareeda'), count: sum.data?.buying.active_orders || undefined },
            ...(isSeller ? [{ value: 'seller' as Tab, label: t('I sold', 'मैंने बेचा', 'Maine becha'), count: sum.data?.selling.active_orders || undefined }] : []),
            { value: 'report', label: t('Margins', 'मुनाफ़ा', 'Munafa') }
          ]} />
        </div>
        {tab === 'report' ? <ReportView r={report.data} loading={report.isLoading} /> : list.isLoading ? <SkelRows rows={6} /> : !rows.length ? (
          <Empty icon={<Truck size={28} />} title={role === 'buyer' ? t('No orders yet', 'अभी कोई ऑर्डर नहीं', 'Abhi koi order nahi') : t('No sales yet', 'अभी कोई बिक्री नहीं', 'Abhi koi bikri nahi')}
            body={role === 'buyer' ? t('Accept a quote on one of your requests to place an order.', 'किसी request का quote मंज़ूर करें — ऑर्डर लग जाएगा।', 'Kisi request ka quote accept karo — order lag jayega.') : t('Send quotes on your leads — won quotes become orders here.', 'Leads पर quote भेजें — जीते quotes यहां ऑर्डर बनेंगे।', 'Leads pe quote bhejo — jeete quotes yahan order banenge.')}
            action={<Button variant="primary" onClick={() => nav(role === 'buyer' ? '/mart' : '/mart/sell')}>{role === 'buyer' ? t('Go to Mart', 'मार्ट पर जाएं', 'Mart pe jao') : t('See leads', 'Leads देखें', 'Leads dekho')}</Button>} />
        ) : mobile ? (
          <div className="list">{rows.map((o) => (
            <button key={o.id} className="list-row" style={{ flexWrap: 'wrap' }} onClick={() => { sp.set('open', String(o.id)); setSp(sp); }}>
              <div className="grow" style={{ minWidth: 0 }}><div className="title ellipsis">{o.product}</div><div className="meta">{o.order_no} · {o.other_party.name}</div></div>
              <Money value={o.total} />
              <div style={{ flexBasis: '100%' }}><OrderSteps status={o.status} /></div>
            </button>
          ))}</div>
        ) : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>{t('Order', 'ऑर्डर', 'Order')}</th><th>{t('Item', 'सामान', 'Saaman')}</th><th>{role === 'buyer' ? t('Seller', 'Seller', 'Seller') : t('Buyer', 'Buyer', 'Buyer')}</th><th className="r">{t('Total', 'कुल', 'Kul')}</th><th>{t('Progress', 'स्थिति', 'Status')}</th></tr></thead>
            <tbody>{rows.map((o) => (
              <tr key={o.id} className="clickable" tabIndex={0} onClick={() => { sp.set('open', String(o.id)); setSp(sp); }} onKeyDown={(e) => { if (e.key === 'Enter') { sp.set('open', String(o.id)); setSp(sp); } }}>
                <td><span className="primary num">{o.order_no}</span><span className="sub">{dateLabel(o.created_at.slice(0, 10), words)}</span></td>
                <td><span className="primary">{o.product}</span><span className="sub">{fmtQty(o.qty)} {o.unit} × {rupees(o.price)}</span></td>
                <td>{o.other_party.name}<span className="sub">{o.other_party.city}</span></td>
                <td className="r num">{rupees(o.total)}</td>
                <td><OrderSteps status={o.status} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
      <OrderDrawer id={openId} role={role} onClose={() => { sp.delete('open'); setSp(sp, { replace: true }); }} />
    </div>
  );
}

function ReportView({ r, loading }: { r?: Report; loading: boolean }) {
  const { t } = useI18n();
  if (loading || !r) return <SkelRows rows={5} />;
  return (
    <div className="panel-body stack" style={{ gap: 16 }}>
      <div className="mini-stats">
        <div><span className="strip-label">{t('Received orders', 'मिले ऑर्डर', 'Mile order')}</span><span className="mini-big num">{r.totals.delivered_orders}</span></div>
        <div><span className="strip-label">{t('Spent', 'खर्च', 'Kharch')}</span><span className="mini-big num">{rupees(r.totals.spend_delivered)}</span></div>
        <div><span className="strip-label">{t('Expected margin', 'अनुमानित मुनाफ़ा', 'Anumaanit munafa')}</span><Money value={r.totals.expected_margin} tone="auto" className="mini-big" /></div>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>{t('Margin is an estimate: today’s selling price in your Products minus what you paid on Mart, times quantity.', 'मुनाफ़ा अनुमान है: आज का बिक्री भाव − Mart पर दिया भाव, × मात्रा।', 'Munafa anumaan hai: aaj ka bikri bhaav − Mart pe diya bhaav, × qty.')}</p>
      {!r.orders.length ? <p className="muted">{t('Shows up after your first order is received.', 'पहला ऑर्डर मिलने के बाद दिखेगा।', 'Pehla order milne ke baad dikhega.')}</p> : (
        <div className="table-wrap"><table className="table table-dense">
          <thead><tr><th>{t('Item', 'सामान', 'Saaman')}</th><th>{t('Seller', 'Seller', 'Seller')}</th><th className="r">{t('Bought at', 'खरीद भाव', 'Khareed bhaav')}</th><th className="r">{t('Selling at', 'बिक्री भाव', 'Bikri bhaav')}</th><th className="r">{t('Expected margin', 'अनुमानित मुनाफ़ा', 'Anumaanit munafa')}</th></tr></thead>
          <tbody>{r.orders.map((o) => (
            <tr key={o.order_id}><td><span className="primary">{o.product}</span><span className="sub">{o.order_no} · {fmtQty(o.qty)} {o.unit}</span></td><td>{o.seller_name}</td><td className="r num">{rupees(o.buy_rate)}</td>
              <td className="r num">{o.sell_price != null ? rupees(o.sell_price) : <Link to="/products">{t('set price', 'भाव डालें', 'bhaav daalo')}</Link>}</td>
              <td className="r">{o.expected_margin != null ? <Money value={o.expected_margin} tone="auto" /> : <span className="muted">—</span>}</td></tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}

export function OrderDrawer({ id, role, onClose }: { id: number | null; role: 'buyer' | 'seller'; onClose: () => void }) {
  const { t, err } = useI18n();
  const toast = useToast();
  const nav = useNavigate();
  const refresh = useMartRefresh();
  // There is no single-order GET; the order comes from the role's list (both
  // sides' lists are tried so a deep link works whichever side you are).
  const lb = useQuery({ queryKey: ['mart-orders', 'buyer'], queryFn: () => get<{ orders: Order[] }>('/api/mart/orders?role=buyer'), enabled: !!id });
  const ls = useQuery({ queryKey: ['mart-orders', 'seller'], queryFn: () => get<{ orders: Order[] }>('/api/mart/orders?role=seller'), enabled: !!id && role === 'seller' });
  const o = [...(lb.data?.orders || []), ...(ls.data?.orders || [])].find((x) => x.id === id) || null;
  const [mode, setMode] = useState<'none' | 'receive' | 'dispatch' | 'rate' | 'cancel'>('none');
  const [paid, setPaid] = useState('');
  const [payMode, setPayMode] = useState('Cash');
  const [exp, setExp] = useState('');
  const [via, setVia] = useState('');
  const [stars, setStars] = useState(0);
  const [review, setReview] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setMode('none'); setPaid(''); setPayMode('Cash'); setExp(''); setVia(''); setStars(0); setReview(''); }, [id]);

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try { await fn(); refresh(); toast({ text: msg }); setMode('none'); }
    catch (e) { toast({ text: err(e), tone: 'error' }); } finally { setBusy(false); }
  };
  const wa = async () => {
    try { const r = await get<{ url: string }>(`/api/mart/orders/${id}/whatsapp-link`); window.open(r.url, '_blank', 'noopener'); }
    catch (e) { toast({ text: err(e), tone: 'error' }); }
  };

  if (!id) return null;
  const buyer = o?.role === 'buyer';
  const openStatus = o && ['placed', 'confirmed', 'dispatched'].includes(o.status);
  return (
    <Drawer open={!!id} onClose={onClose} title={o ? `${o.order_no} · ${o.product}` : t('Order', 'ऑर्डर', 'Order')}
      footer={o && mode === 'none' ? (
        <>
          {o.other_party.phone && <Button icon={<MessageCircle size={16} />} onClick={wa} style={{ marginRight: 'auto' }}>WhatsApp</Button>}
          {buyer && o.status === 'placed' && <Button variant="ghost" icon={<Ban size={16} />} onClick={() => setMode('cancel')}>{t('Cancel', 'रद्द', 'Cancel')}</Button>}
          {!buyer && ['placed', 'confirmed'].includes(o.status) && <Button variant="ghost" icon={<Ban size={16} />} onClick={() => setMode('cancel')}>{t('Cancel', 'रद्द', 'Cancel')}</Button>}
          {buyer && openStatus && <Button variant="primary" icon={<PackageCheck size={16} />} onClick={() => { setPaid(''); setMode('receive'); }}>{t('Goods received', 'माल मिल गया', 'Maal mil gaya')}</Button>}
          {!buyer && o.status === 'placed' && <Button variant="primary" icon={<CheckCircle2 size={16} />} loading={busy} onClick={() => act(() => post(`/api/mart/orders/${o.id}/status`, { status: 'confirmed' }), t('Order confirmed — buyer notified', 'ऑर्डर पक्का — buyer को खबर गई', 'Order pakka — buyer ko khabar gayi'))}>{t('Confirm order', 'ऑर्डर पक्का करें', 'Order pakka karo')}</Button>}
          {!buyer && o.status === 'confirmed' && <Button variant="primary" icon={<Truck size={16} />} onClick={() => setMode('dispatch')}>{t('Mark dispatched', 'भेज दिया', 'Bhej diya')}</Button>}
          {buyer && o.status === 'delivered' && !o.rating && <Button icon={<Star size={16} />} onClick={() => setMode('rate')}>{t('Rate seller', 'rating दें', 'Rating do')}</Button>}
          {buyer && o.status === 'delivered' && <Button variant="primary" icon={<Repeat2 size={16} />} loading={busy} onClick={async () => {
            setBusy(true);
            try { const r = await post<{ inquiry: { id: number } }>(`/api/mart/orders/${o.id}/repeat`); refresh(); toast({ text: t('Repeat request sent to the same seller', 'उसी seller को दोबारा request गई', 'Usi seller ko dobara request gayi') }); onClose(); nav(`/mart/requests/${r.inquiry.id}`); }
            catch (e) { toast({ text: err(e), tone: 'error' }); } finally { setBusy(false); }
          }}>{t('Order again', 'फिर से मंगाएं', 'Phir se mangao')}</Button>}
        </>
      ) : undefined}>
      {!o ? <SkelRows rows={6} /> : (
        <div className="stack" style={{ gap: 18 }}>
          <OrderSteps status={o.status} />
          <div className="mini-stats">
            <div><span className="strip-label">{t('Quantity', 'मात्रा', 'Qty')}</span><span className="mini-big num">{fmtQty(o.qty)} <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>{o.unit}</span></span></div>
            <div><span className="strip-label">{t('Rate', 'भाव', 'Rate')}</span><span className="mini-big num">{rupees(o.price)}</span></div>
            <div><span className="strip-label">{t('Total', 'कुल', 'Kul')}</span><span className="mini-big num">{rupees(o.total)}</span></div>
          </div>
          <dl className="kv">
            <div><dt>{buyer ? t('Seller', 'Seller', 'Seller') : t('Buyer', 'Buyer', 'Buyer')}</dt><dd><b>{o.other_party.name}</b>{o.other_party.city ? `, ${o.other_party.city}` : ''}{o.other_party.phone && <> · <a href={`tel:${o.other_party.phone}`}><Phone size={12} /> {o.other_party.phone}</a></>}</dd></div>
            <div><dt>{t('Payment', 'भुगतान', 'Payment')}</dt><dd>{termsText(o)}</dd></div>
            <div><dt>{t('Delivery', 'डिलीवरी', 'Delivery')}</dt><dd>{o.expected_delivery_date ? `${t('expected', 'उम्मीद', 'expected')} ${o.expected_delivery_date}` : (o.delivery_days === 1 ? t('1 day from order', '1 दिन में', '1 din me') : `${o.delivery_days} ${t('days from order', 'दिन में', 'din me')}`)}{o.transporter_name ? ` · ${t('via', 'से', 'via')} ${o.transporter_name}` : ''}</dd></div>
            {o.purchase_id && <div><dt>{t('In your books', 'आपके हिसाब में', 'Aapke hisaab me')}</dt><dd><Link to="/purchases">{t(`Purchase ${o.order_no} — stock added`, `खरीद ${o.order_no} — stock जुड़ा`, `Khareed ${o.order_no} — stock juda`)}</Link></dd></div>}
            {o.rating && <div><dt>{t('Rating', 'Rating', 'Rating')}</dt><dd>{'★'.repeat(o.rating)}{'☆'.repeat(5 - o.rating)}{o.review ? ` — “${o.review}”` : ''}</dd></div>}
          </dl>
          <Link to={`/mart/requests/${o.inquiry_id}`} className="muted" style={{ fontSize: 13 }}>{buyer ? t('See the request and all quotes', 'request और सारे quotes देखें', 'Request aur saare quotes dekho') : t('See the buyer’s request', 'buyer की request देखें', 'Buyer ki request dekho')}</Link>

          {mode === 'receive' && (
            <div className="action-box">
              <h3>{t('Goods received?', 'माल मिल गया?', 'Maal mil gaya?')}</h3>
              <p className="muted" style={{ fontSize: 13 }}>{t(`This adds a purchase from ${o.other_party.name} (bill no. ${o.order_no}) and raises stock of ${o.product} by ${fmtQty(o.qty)} ${o.unit}.`, `${o.other_party.name} से खरीद जुड़ेगी (बिल ${o.order_no}) और ${o.product} का stock ${fmtQty(o.qty)} ${o.unit} बढ़ेगा।`, `${o.other_party.name} se khareed judegi (bill ${o.order_no}) aur ${o.product} ka stock ${fmtQty(o.qty)} ${o.unit} badhega.`)}</p>
              <div className="form-2">
                <Field label={t('Paid already ₹', 'दे दिया ₹', 'De diya ₹')} hint={t(`The rest shows as “to pay” for ${o.other_party.name}.`, `बाकी ${o.other_party.name} को “देना है” में दिखेगा।`, `Baaki ${o.other_party.name} ko “dena hai” me dikhega.`)}>{(fid) => <Input id={fid} numeric inputMode="decimal" placeholder="0" value={paid} onChange={(e) => setPaid(e.target.value.replace(/[^\d.]/g, ''))} autoFocus />}</Field>
                <Field label={t('How', 'कैसे', 'Kaise')}>{() => <Segmented label="mode" value={payMode} onChange={setPayMode} options={[{ value: 'Cash', label: t('Cash', 'नकद', 'Cash') }, { value: 'UPI', label: 'UPI' }, { value: 'Bank', label: t('Bank', 'बैंक', 'Bank') }]} />}</Field>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                <Button onClick={() => setMode('none')}>{t('Back', 'वापस', 'Wapas')}</Button>
                <Button variant="primary" loading={busy} onClick={() => act(() => post(`/api/mart/orders/${o.id}/receive`, { paid_amount: Number(paid) || 0, paid_mode: payMode }), t('Received — purchase and stock updated', 'मिल गया — खरीद और stock अपडेट', 'Mil gaya — khareed aur stock update'))}>{t('Yes, add to my stock', 'हां, stock में जोड़ें', 'Haan, stock me jodo')}</Button>
              </div>
            </div>
          )}
          {mode === 'dispatch' && (
            <div className="action-box">
              <h3>{t('Dispatch details', 'भेजने की जानकारी', 'Bhejne ki jaankari')}</h3>
              <div className="form-2">
                <Field label={t('Expected delivery', 'कब पहुंचेगा', 'Kab pahunchega')}>{(fid) => <Input id={fid} type="date" min={todayStr()} value={exp} onChange={(e) => setExp(e.target.value)} />}</Field>
                <Field label={t('Transporter (optional)', 'ट्रांसपोर्ट (अगर)', 'Transport (optional)')}>{(fid) => <Input id={fid} value={via} onChange={(e) => setVia(e.target.value)} />}</Field>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                <Button onClick={() => setMode('none')}>{t('Back', 'वापस', 'Wapas')}</Button>
                <Button variant="primary" loading={busy} onClick={() => act(() => post(`/api/mart/orders/${o.id}/status`, { status: 'dispatched', expected_delivery_date: exp || undefined, transporter_name: via }), t('Marked dispatched — buyer notified', 'भेज दिया — buyer को खबर गई', 'Bhej diya — buyer ko khabar gayi'))}>{t('Mark dispatched', 'भेज दिया', 'Bhej diya')}</Button>
              </div>
            </div>
          )}
          {mode === 'rate' && (
            <div className="action-box">
              <h3>{t(`Rate ${o.other_party.name}`, `${o.other_party.name} को rating दें`, `${o.other_party.name} ko rating do`)}</h3>
              <div className="stars" role="radiogroup" aria-label={t('Rating', 'Rating', 'Rating')}>
                {[1, 2, 3, 4, 5].map((n) => <button key={n} role="radio" aria-checked={stars === n} aria-label={`${n}`} className={n <= stars ? 'on' : ''} onClick={() => setStars(n)}><Star size={26} fill={n <= stars ? 'currentColor' : 'none'} /></button>)}
              </div>
              <Field label={t('A line about quality or delivery (optional)', 'quality या delivery पर एक लाइन (अगर)', 'Quality ya delivery pe ek line (optional)')}>{(fid) => <Input id={fid} value={review} onChange={(e) => setReview(e.target.value)} />}</Field>
              <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                <Button onClick={() => setMode('none')}>{t('Back', 'वापस', 'Wapas')}</Button>
                <Button variant="primary" disabled={!stars} loading={busy} onClick={() => act(() => post(`/api/mart/orders/${o.id}/rate`, { rating: stars, review }), t('Thanks — rating saved', 'धन्यवाद — rating सेव', 'Shukriya — rating save'))}>{t('Save rating', 'rating सेव करें', 'Rating save karo')}</Button>
              </div>
            </div>
          )}
          {mode === 'cancel' && (
            <div className="action-box action-box-danger">
              <h3>{t('Cancel this order?', 'ऑर्डर रद्द करें?', 'Order cancel karein?')}</h3>
              <p className="muted" style={{ fontSize: 13 }}>{buyer ? t('The request opens again and the other sellers’ quotes become live.', 'request फिर खुल जाएगी और बाकी sellers के quote चालू होंगे।', 'Request phir khul jayegi aur baaki sellers ke quote chalu honge.') : t('The buyer is notified and their request opens again for other sellers.', 'buyer को खबर जाएगी और उनकी request दूसरों के लिए फिर खुलेगी।', 'Buyer ko khabar jayegi aur unki request doosron ke liye phir khulegi.')}</p>
              <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                <Button onClick={() => setMode('none')}>{t('Keep order', 'ऑर्डर रखें', 'Order rakho')}</Button>
                <Button variant="danger" loading={busy} onClick={() => act(() => post(`/api/mart/orders/${o.id}/status`, { status: 'cancelled' }), t('Order cancelled', 'ऑर्डर रद्द', 'Order cancel'))}>{t('Cancel order', 'ऑर्डर रद्द करें', 'Order cancel karo')}</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
