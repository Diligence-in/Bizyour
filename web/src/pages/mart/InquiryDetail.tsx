import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Check, MessageCircle, MessagesSquare, Share2, X } from 'lucide-react';
import { get, post } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { qty as fmtQty, round2, rupees } from '../../lib/format';
import { Badge, Button, Empty, Modal, Money, SkelRows, useToast } from '../../components/ui';
import { useIsMobile, usePageTitle } from '../../components/shell/AppShell';
import { quoteDaysLeft, quoteTags, termsText, useMartRefresh, type BuyerInquiryDetail, type BuyerQuote, type Inquiry, type SellerInquiryDetail } from './martApi';
import { InquiryBadge, OrderSteps, QuoteBadge, QuoteChat, TrustLine } from './martUi';

// One request, every quote side by side. A bulk request (same item sent to
// picked sellers) is several inquiries sharing a group_id — they are merged
// here so all quotes land in one comparison, as the buyer expects.

type Detail = BuyerInquiryDetail | SellerInquiryDetail;
interface Row extends BuyerQuote { inq: Inquiry }

export default function InquiryDetail() {
  const { id } = useParams();
  const { t, err } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const mobile = useIsMobile();
  const refresh = useMartRefresh();
  const main = useQuery({ queryKey: ['mart-inquiry', id], queryFn: () => get<Detail>(`/api/mart/inquiries/${id}`) });
  const all = useQuery({ queryKey: ['mart-inquiries'], queryFn: () => get<{ inquiries: Inquiry[] }>('/api/mart/inquiries'), enabled: main.data?.role === 'buyer' && !!main.data.inquiry.group_id });
  const siblingIds = useMemo(() => {
    const g = main.data?.inquiry.group_id;
    return g ? (all.data?.inquiries || []).filter((i) => i.group_id === g && String(i.id) !== id).map((i) => i.id) : [];
  }, [main.data, all.data, id]);
  const sib = useQueries({ queries: siblingIds.map((sid) => ({ queryKey: ['mart-inquiry', String(sid)], queryFn: () => get<BuyerInquiryDetail>(`/api/mart/inquiries/${sid}`) })) });
  const [sp] = useSearchParams();
  const [chat, setChat] = useState<number | null>(Number(sp.get('chat')) || null);
  const [accept, setAccept] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  usePageTitle(main.data ? main.data.inquiry.product : t('Request', 'Request', 'Request'));
  const days = (n: number) => (n === 1 ? t('1 day', '1 दिन', '1 din') : `${n} ${t('days', 'दिन', 'din')}`);

  if (main.isLoading) return <div className="page"><SkelRows rows={10} /></div>;
  if (!main.data) return <div className="page"><p>{err(main.error)}</p></div>;
  if (main.data.role === 'seller') return <Navigate to={`/mart/sell?lead=${id}`} replace />;

  const d = main.data;
  const details = [d, ...sib.map((s) => s.data).filter(Boolean) as BuyerInquiryDetail[]];
  const rows: Row[] = details.flatMap((x) => x.quotes.map((q) => ({ ...q, inq: x.inquiry })));
  const live = rows.filter((q) => q.status === 'sent' && q.inq.status === 'open').sort((a, b) => a.price - b.price);
  const others = rows.filter((q) => !live.includes(q));
  const order = details.map((x) => x.order).find(Boolean) || null;
  const tags = quoteTags(live);
  const inq = d.inquiry;
  const anyOpen = details.some((x) => x.inquiry.status === 'open');
  const groupSize = details.length;

  const doAccept = async () => {
    if (!accept) return;
    setBusy(true);
    try {
      const r = await post<{ order: { id: number; order_no: string } }>(`/api/mart/quotes/${accept.id}/accept`);
      refresh();
      toast({ text: t(`Order ${r.order.order_no} placed with ${accept.seller.name}`, `${accept.seller.name} को ऑर्डर ${r.order.order_no} दिया`, `${accept.seller.name} ko order ${r.order.order_no} diya`) });
      setAccept(null);
      nav(`/mart/orders?open=${r.order.id}`);
    } catch (e) { toast({ text: err(e), tone: 'error' }); } finally { setBusy(false); }
  };
  const decline = async (q: Row) => {
    try { await post(`/api/mart/quotes/${q.id}/decline`); refresh(); toast({ text: t(`Declined ${q.seller.name}’s quote`, `${q.seller.name} का quote मना किया`, `${q.seller.name} ka quote mana kiya`) }); }
    catch (e) { toast({ text: err(e), tone: 'error' }); }
  };
  const close = async () => {
    try { for (const x of details) if (x.inquiry.status === 'open') await post(`/api/mart/inquiries/${x.inquiry.id}/close`); refresh(); toast({ text: t('Request closed', 'Request बंद की', 'Request band ki') }); }
    catch (e) { toast({ text: err(e), tone: 'error' }); }
  };
  const share = async () => {
    try { const r = await get<{ wa_url: string }>(`/api/mart/inquiries/${inq.id}/share`); window.open(r.wa_url, '_blank', 'noopener'); }
    catch (e) { toast({ text: err(e), tone: 'error' }); }
  };

  const vsTarget = (p: number) => {
    if (inq.target_price == null) return null;
    const diff = round2(p - inq.target_price);
    if (diff === 0) return <span className="muted">{t('at your target', 'आपके भाव पर', 'aapke bhaav pe')}</span>;
    return diff < 0
      ? <span className="money-in">{rupees(-diff)} {t('under target', 'कम', 'kam')}</span>
      : <span className="money-owed">{rupees(diff)} {t('over target', 'ज़्यादा', 'zyada')}</span>;
  };
  const tagFor = (q: Row) => (
    <span className="qtags">
      {q.id === tags.best && <Badge tone="mart" plain>★ {t('Best value', 'सबसे फ़ायदेमंद', 'Best value')}</Badge>}
      {q.id === tags.cheapest && <Badge tone="in" plain>{t('Lowest price', 'सबसे सस्ता', 'Sabse sasta')}</Badge>}
      {q.id === tags.fastest && <Badge tone="info" plain>{t('Fastest', 'सबसे जल्दी', 'Sabse jaldi')}</Badge>}
    </span>
  );
  const moqWarn = (q: Row) => q.moq > 0 && q.inq.qty < q.moq;

  return (
    <div className="page mart-page">
      <Link to="/mart" className="back-link"><ArrowLeft size={14} /> {t('Business Mart', 'बिज़नेस मार्ट', 'Business Mart')}</Link>
      <header className="page-head">
        <div className="grow">
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}><h1>{fmtQty(inq.qty)} {inq.unit} {inq.product}</h1><InquiryBadge status={order ? 'ordered' : anyOpen ? 'open' : inq.status} newQuotes={live.length} /></div>
          <p className="page-sub">
            {[inq.category, inq.city, inq.need_by && `${t('by', 'तक', 'tak')} ${inq.need_by}`, inq.frequency !== 'One-time' && inq.frequency, inq.target_price != null && `${t('target', 'भाव', 'target')} ${rupees(inq.target_price)}/${inq.unit}`, !inq.show_name && t('name hidden', 'नाम छुपा', 'naam chhupa'), inq.verified_only && t('GST sellers only', 'सिर्फ़ GST', 'sirf GST')].filter(Boolean).join(' · ')}
          </p>
          {inq.notes && <p className="muted" style={{ marginTop: 4 }}>“{inq.notes}”</p>}
        </div>
        <div className="page-actions">
          {anyOpen && !inq.group_id && <Button icon={<Share2 size={16} />} onClick={share}>{t('Share on WhatsApp', 'WhatsApp पर भेजें', 'WhatsApp pe bhejo')}</Button>}
          {anyOpen && <Button variant="ghost" icon={<X size={16} />} onClick={close}>{t('Close request', 'Request बंद करें', 'Request band karo')}</Button>}
        </div>
      </header>

      {order && (
        <section className="panel panel-body order-card" style={{ marginBottom: 16 }}>
          <div className="grow">
            <div style={{ fontWeight: 600 }}>{t('Order', 'ऑर्डर', 'Order')} {order.order_no} · {order.other_party.name}</div>
            <div className="muted" style={{ fontSize: 13 }}>{fmtQty(order.qty)} {order.unit} × {rupees(order.price)} = <b className="num" style={{ color: 'var(--ink)' }}>{rupees(order.total)}</b> · {termsText(order)}</div>
          </div>
          <OrderSteps status={order.status} />
          <Link to={`/mart/orders?open=${order.id}`} className="btn btn-primary btn-sm">{t('Open order', 'ऑर्डर खोलें', 'Order kholo')}</Link>
        </section>
      )}

      {groupSize > 1 && <div className="banner banner-info" style={{ marginBottom: 16 }}>{t(`Sent privately to ${groupSize} sellers — all their quotes are compared here.`, `${groupSize} sellers को अलग से भेजी — सबके quote यहां एक साथ।`, `${groupSize} sellers ko alag se bheji — sabke quote yahan ek saath.`)}</div>}

      {live.length === 0 && !order ? (
        <section className="panel">
          <Empty icon={<MessagesSquare size={28} />} title={anyOpen ? t('Waiting for quotes', 'quotes का इंतज़ार', 'Quotes ka intezaar') : t('No live quotes', 'कोई चालू quote नहीं', 'Koi chalu quote nahi')}
            body={anyOpen ? t(`${inq.notified} sellers were told and ${inq.views || 0} have looked. Quotes appear here as they come in — you’ll also get a notification.`, `${inq.notified} sellers को खबर गई, ${inq.views || 0} ने देखा। quote आते ही यहां दिखेंगे।`, `${inq.notified} sellers ko khabar gayi, ${inq.views || 0} ne dekha. Quote aate hi yahan dikhenge.`) : undefined}
            action={anyOpen && !inq.group_id ? <Button icon={<MessageCircle size={16} />} onClick={share}>{t('Send to your own suppliers on WhatsApp', 'अपने सप्लायर को WhatsApp करें', 'Apne supplier ko WhatsApp karo')}</Button> : undefined} />
        </section>
      ) : live.length > 0 && (
        mobile ? (
          <div className="stack" style={{ gap: 12 }}>
            {live.map((q) => (
              <article key={q.id} className={`panel quote-card ${q.id === tags.best ? 'is-best' : ''}`}>
                <div className="panel-body stack" style={{ gap: 10 }}>
                  {tagFor(q)}
                  <div className="row-between"><Link to={`/mart/sellers/${q.seller_business_id}`} className="title" style={{ color: 'var(--ink)', fontWeight: 600 }}>{q.seller.name}</Link><span className="num" style={{ fontSize: 22, fontWeight: 600 }}>{rupees(q.price)}<span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>/{q.inq.unit}</span></span></div>
                  <TrustLine s={q.seller} />
                  <dl className="qfacts">
                    <div><dt>{t('Total', 'कुल', 'Kul')}</dt><dd className="num">{rupees(q.price * q.inq.qty)}</dd></div>
                    <div><dt>{t('Delivery', 'डिलीवरी', 'Delivery')}</dt><dd>{days(q.delivery_days)}</dd></div>
                    <div><dt>{t('Payment', 'भुगतान', 'Payment')}</dt><dd>{termsText(q)}</dd></div>
                    <div><dt>{t('Min. order', 'कम से कम', 'Kam se kam')}</dt><dd className={moqWarn(q) ? 'money-owed' : ''}>{q.moq ? `${fmtQty(q.moq)} ${q.inq.unit}` : '—'}</dd></div>
                  </dl>
                  {vsTarget(q.price)}
                  {q.note && <p className="muted" style={{ fontSize: 13 }}>“{q.note}”</p>}
                  <div className="row" style={{ gap: 8 }}>
                    <Button variant="primary" className="grow" icon={<Check size={16} />} disabled={moqWarn(q)} onClick={() => setAccept(q)}>{t('Accept', 'मंज़ूर', 'Accept')}</Button>
                    <Button icon={<MessagesSquare size={16} />} onClick={() => setChat(q.id)}>{q.messages || ''}</Button>
                    <Button variant="ghost" onClick={() => decline(q)} aria-label={t('Decline', 'मना करें', 'Mana karo')}><X size={16} /></Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <section className="panel compare-wrap">
            <table className="compare">
              <thead>
                <tr>
                  <th className="compare-label">{live.length === 1 ? t('1 quote', '1 quote', '1 quote') : t(`${live.length} quotes`, `${live.length} quotes`, `${live.length} quotes`)}</th>
                  {live.map((q) => (
                    <th key={q.id} className={q.id === tags.best ? 'is-best' : ''}>
                      {tagFor(q)}
                      <Link to={`/mart/sellers/${q.seller_business_id}`} className="compare-seller">{q.seller.name}</Link>
                      <TrustLine s={q.seller} compact />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="compare-price"><th>{t('Price', 'भाव', 'Bhaav')} / {inq.unit}</th>{live.map((q) => <td key={q.id} className={q.id === tags.best ? 'is-best' : ''}><span className="num">{rupees(q.price)}</span><span className="compare-sub">{vsTarget(q.price)}</span></td>)}</tr>
                <tr><th>{t('Total', 'कुल', 'Kul')} ({fmtQty(inq.qty)} {inq.unit})</th>{live.map((q) => <td key={q.id} className={`num ${q.id === tags.best ? 'is-best' : ''}`}>{rupees(q.price * q.inq.qty)}</td>)}</tr>
                <tr><th>{t('Delivery', 'डिलीवरी', 'Delivery')}</th>{live.map((q) => <td key={q.id} className={q.id === tags.best ? 'is-best' : ''}>{q.delivery_days === 0 ? t('Same day', 'उसी दिन', 'Usi din') : days(q.delivery_days)}</td>)}</tr>
                <tr><th>{t('Payment', 'भुगतान', 'Payment')}</th>{live.map((q) => <td key={q.id} className={q.id === tags.best ? 'is-best' : ''}>{termsText(q)}</td>)}</tr>
                <tr><th>{t('Minimum order', 'कम से कम ऑर्डर', 'Minimum order')}</th>{live.map((q) => <td key={q.id} className={q.id === tags.best ? 'is-best' : ''}>{q.moq ? <span className={moqWarn(q) ? 'money-owed' : ''}>{moqWarn(q) && <AlertTriangle size={13} style={{ verticalAlign: '-2px' }} />} {fmtQty(q.moq)} {inq.unit}</span> : <span className="muted">—</span>}</td>)}</tr>
                <tr><th>{t('Seller record', 'seller का रिकॉर्ड', 'Seller record')}</th>{live.map((q) => <td key={q.id} className={q.id === tags.best ? 'is-best' : ''}>{q.seller.deals} {t('deals', 'सौदे', 'deals')}{q.seller.repeat_buyers ? ` · ${q.seller.repeat_buyers} ${t('repeat buyers', 'दोबारा खरीदार', 'repeat buyers')}` : ''}<span className="compare-sub">{q.seller.city}{q.seller.since ? ` · ${t('since', 'से', 'since')} ${q.seller.since}` : ''}</span></td>)}</tr>
                <tr><th>{t('Valid for', 'कब तक मान्य', 'Kab tak valid')}</th>{live.map((q) => { const n = quoteDaysLeft(q); return <td key={q.id} className={q.id === tags.best ? 'is-best' : ''}><span className={n <= 1 ? 'money-warn' : ''}>{n <= 0 ? t('ends today', 'आज खत्म', 'aaj khatam') : `${n} ${t('more days', 'दिन और', 'din aur')}`}</span></td>; })}</tr>
                <tr><th>{t('Note', 'नोट', 'Note')}</th>{live.map((q) => <td key={q.id} className={`compare-note ${q.id === tags.best ? 'is-best' : ''}`}>{q.note || <span className="muted">—</span>}</td>)}</tr>
                <tr className="compare-actions"><th />{live.map((q) => (
                  <td key={q.id} className={q.id === tags.best ? 'is-best' : ''}>
                    <Button variant="primary" block icon={<Check size={16} />} disabled={moqWarn(q)} title={moqWarn(q) ? t('Your quantity is below this seller’s minimum', 'आपकी मात्रा इनके minimum से कम है', 'Aapki qty inke minimum se kam hai') : undefined} onClick={() => setAccept(q)}>{t('Accept', 'मंज़ूर करें', 'Accept karo')}</Button>
                    <div className="row" style={{ gap: 6, marginTop: 6 }}>
                      <Button size="sm" className="grow" icon={<MessagesSquare size={14} />} onClick={() => setChat(q.id)}>{t('Chat / counter', 'बात / मोल-भाव', 'Baat / mol-bhaav')}{q.messages ? ` (${q.messages})` : ''}</Button>
                      <Button size="sm" variant="ghost" onClick={() => decline(q)}>{t('Decline', 'मना', 'Mana')}</Button>
                    </div>
                  </td>
                ))}</tr>
              </tbody>
            </table>
            <p className="compare-foot muted">{t('Best value weighs price, delivery time, rating, GST and credit terms. Accepting places the order; other quotes on this request close automatically.', 'Best value = भाव, delivery, rating, GST और उधार मिलाकर। मंज़ूर करते ही ऑर्डर लगता है; बाकी quotes अपने आप बंद।', 'Best value = bhaav, delivery, rating, GST aur udhaar milakar. Accept karte hi order lagta hai; baaki quotes apne aap band.')}</p>
          </section>
        )
      )}

      {others.length > 0 && (
        <section className="panel" style={{ marginTop: 16 }}>
          <header className="panel-head"><h2>{t('Other quotes', 'बाकी quotes', 'Baaki quotes')}</h2></header>
          <div className="list">{others.map((q) => (
            <div key={q.id} className="list-row" style={{ cursor: 'default' }}>
              <div className="grow" style={{ minWidth: 0 }}><div className="title ellipsis">{q.seller.name}</div><div className="meta">{rupees(q.price)}/{q.inq.unit} · {days(q.delivery_days)} · {q.payment_terms}</div></div>
              <QuoteBadge status={q.status} />
              <Button size="sm" variant="ghost" icon={<MessagesSquare size={14} />} onClick={() => setChat(q.id)}>{q.messages || ''}</Button>
            </div>
          ))}</div>
        </section>
      )}

      <QuoteChat quoteId={chat} open={chat != null} onClose={() => setChat(null)} />

      <Modal open={!!accept} onClose={() => setAccept(null)} label={t('Confirm order', 'ऑर्डर पक्का करें', 'Order pakka karo')}>
        {accept && (
          <div style={{ padding: 24 }} className="stack">
            <h2 style={{ fontSize: 20 }}>{t(`Order from ${accept.seller.name}?`, `${accept.seller.name} को ऑर्डर दें?`, `${accept.seller.name} ko order dein?`)}</h2>
            <div className="accept-sum">
              <div className="row-between"><span>{fmtQty(accept.inq.qty)} {accept.inq.unit} × {rupees(accept.price)}</span><Money value={round2(accept.inq.qty * accept.price)} className="accept-total" /></div>
              <div className="muted" style={{ fontSize: 13 }}>{termsText(accept)} · {days(accept.delivery_days)} {t('to deliver', 'में डिलीवरी', 'me delivery')}</div>
            </div>
            <p className="muted" style={{ fontSize: 13 }}>{t('Payment is settled directly between you and the seller — BizYour keeps the record. When the goods arrive, mark the order received and it’s added to your purchases and stock.', 'भुगतान सीधे आप और seller के बीच — BizYour हिसाब रखता है। माल आने पर “मिल गया” दबाएं — खरीद और stock में जुड़ जाएगा।', 'Payment seedha aap aur seller ke beech — BizYour hisaab rakhta hai. Maal aane pe “mil gaya” dabao — khareed aur stock me jud jayega.')}</p>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={() => setAccept(null)}>{t('Not yet', 'अभी नहीं', 'Abhi nahi')}</Button>
              <Button variant="primary" loading={busy} onClick={doAccept}>{t('Place order', 'ऑर्डर दें', 'Order do')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
