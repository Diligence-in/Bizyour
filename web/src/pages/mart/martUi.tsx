import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Check, Send, Star, Store } from 'lucide-react';
import { get, post, put } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useSession } from '../../lib/session';
import { dateLabel, rupees } from '../../lib/format';
import { Badge, Button, Drawer, Field, Input, Select, useToast } from '../../components/ui';
import {
  useMartProfile, useMartRefresh, useMeta,
  type Inquiry, type Message, type OrderStatus, type Quote, type QuoteStatus, type SellerCard
} from './martApi';

/* ---------- trust line for a seller ---------- */
// Honest by design: "Verified" here means the server's own rule (a real-
// format GSTIN + phone + city on file) — the tooltip says exactly that.
export function TrustLine({ s, compact }: { s: Pick<SellerCard, 'verified' | 'gst_registered' | 'rating' | 'ratings_count' | 'deals' | 'city'> & { ratings_count?: number; deals?: number }; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <span className="trust">
      {s.verified
        ? <span className="trust-chip trust-ok" title={t('GSTIN in the right format, phone and city on file. Not checked with the GST portal.', 'सही format का GSTIN, फ़ोन और शहर दर्ज है। GST portal से जांच नहीं हुई।', 'Sahi format ka GSTIN, phone aur shehar darj hai. GST portal se check nahi hua.')}><BadgeCheck size={13} /> {t('Verified details', 'जानकारी पूरी', 'Details verified')}</span>
        : s.gst_registered ? <span className="trust-chip" title={t('Has entered a GSTIN', 'GSTIN डाला है', 'GSTIN daala hai')}>GST</span> : null}
      {s.rating != null
        ? <span className="trust-rating"><Star size={12} fill="currentColor" /> {s.rating.toFixed(1)}{!compact && s.ratings_count ? <span className="muted"> ({s.ratings_count})</span> : null}</span>
        : !compact && <span className="muted">{t('No ratings yet', 'अभी rating नहीं', 'Abhi rating nahi')}</span>}
      {!compact && typeof s.deals === 'number' && <span className="muted">{s.deals} {t('deals', 'सौदे', 'deals')}</span>}
      {!compact && s.city && <span className="muted">{s.city}</span>}
    </span>
  );
}

export function InquiryBadge({ status, newQuotes }: { status: Inquiry['status']; newQuotes?: number }) {
  const { t } = useI18n();
  if (status === 'ordered') return <Badge tone="in">{t('Ordered', 'ऑर्डर हुआ', 'Order hua')}</Badge>;
  if (status === 'closed') return <Badge>{t('Closed', 'बंद', 'Band')}</Badge>;
  if (status === 'expired') return <Badge>{t('Expired', 'समय खत्म', 'Expire')}</Badge>;
  if (newQuotes) return <Badge tone="mart">{newQuotes === 1 ? t('1 quote to review', '1 quote देखें', '1 quote dekho') : t(`${newQuotes} quotes to review`, `${newQuotes} quote देखें`, `${newQuotes} quote dekho`)}</Badge>;
  return <Badge tone="info">{t('Waiting for quotes', 'quote का इंतज़ार', 'Quote ka intezaar')}</Badge>;
}

export function QuoteBadge({ status }: { status: QuoteStatus }) {
  const { t } = useI18n();
  const m: Record<QuoteStatus, [string, string, string, 'in' | 'owed' | 'warn' | 'info' | 'mart' | undefined]> = {
    sent: ['Waiting for buyer', 'buyer का इंतज़ार', 'Buyer ka intezaar', 'info'],
    accepted: ['Won', 'जीता', 'Jeeta', 'in'],
    declined: ['Not selected', 'नहीं चुना', 'Nahi chuna', undefined],
    closed: ['Closed', 'बंद', 'Band', undefined],
    withdrawn: ['Withdrawn', 'वापस लिया', 'Wapas liya', undefined],
    cancelled: ['Order cancelled', 'ऑर्डर रद्द', 'Order cancel', 'owed'],
    expired: ['Expired', 'समय खत्म', 'Expire', 'warn']
  };
  const [en, hi, hg, tone] = m[status] || m.sent;
  return <Badge tone={tone}>{t(en, hi, hg)}</Badge>;
}

export function OrderSteps({ status }: { status: OrderStatus }) {
  const { t } = useI18n();
  const steps: [OrderStatus, string][] = [
    ['placed', t('Placed', 'लगा', 'Laga')], ['confirmed', t('Confirmed', 'पक्का', 'Pakka')],
    ['dispatched', t('Dispatched', 'भेजा', 'Bheja')], ['delivered', t('Received', 'मिला', 'Mila')]
  ];
  if (status === 'cancelled') return <Badge tone="owed">{t('Cancelled', 'रद्द', 'Cancel')}</Badge>;
  const at = steps.findIndex(([s]) => s === status);
  return (
    <ol className="steps" aria-label={t('Order progress', 'ऑर्डर की स्थिति', 'Order progress')}>
      {steps.map(([s, label], i) => (
        <li key={s} className={i < at ? 'done' : i === at ? 'now' : ''} aria-current={i === at ? 'step' : undefined}>
          <span className="dot">{i < at || (i === at && s === 'delivered') ? <Check size={11} strokeWidth={3} /> : null}</span>{label}
        </li>
      ))}
    </ol>
  );
}

/* ---------- chat + counter-offer on one quote (both sides) ---------- */
export function QuoteChat({ quoteId, open, onClose, title }: { quoteId: number | null; open: boolean; onClose: () => void; title?: string }) {
  const { t, err } = useI18n();
  const toast = useToast();
  const refresh = useMartRefresh();
  const q = useQuery({
    queryKey: ['mart-chat', quoteId],
    queryFn: () => get<{ side: 'buyer' | 'seller'; quote: Quote; inquiry: Inquiry; seller: { name: string }; buyer: { name: string }; messages: Message[] }>(`/api/mart/quotes/${quoteId}/messages`),
    enabled: open && !!quoteId, refetchInterval: open ? 8000 : false
  });
  const [text, setText] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) { setText(''); setPrice(''); } }, [open, quoteId]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [q.data?.messages.length]);
  const d = q.data;
  const live = d && d.quote.status === 'sent' && d.inquiry.status === 'open';
  const other = d ? (d.side === 'buyer' ? d.seller.name : d.buyer.name) : '';

  const send = async (counter?: boolean) => {
    if (!d) return;
    const n = Number(price);
    if (counter && !(n > 0)) { toast({ text: t('Enter the price you want.', 'जो भाव चाहिए वो लिखें।', 'Jo bhaav chahiye woh likho.'), tone: 'error' }); return; }
    if (!counter && !text.trim()) return;
    setBusy(true);
    try {
      if (counter && d.side === 'seller') {
        await put(`/api/mart/quotes/${d.quote.id}`, { price: n });
        if (text.trim()) await post(`/api/mart/quotes/${d.quote.id}/messages`, { body: text.trim() });
      } else {
        await post(`/api/mart/quotes/${d.quote.id}/messages`, counter ? { counter_price: n, body: text.trim() || undefined } : { body: text.trim() });
      }
      setText(''); setPrice('');
      refresh();
    } catch (e) { toast({ text: err(e), tone: 'error' }); } finally { setBusy(false); }
  };

  return (
    <Drawer open={open} onClose={onClose} title={title || (d ? `${other} · ${d.inquiry.product}` : t('Messages', 'बातचीत', 'Baat-cheet'))}
      footer={d && (
        <div className="chat-compose">
          {live && (
            <div className="row" style={{ gap: 8 }}>
              <span className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{d.side === 'buyer' ? t('Counter at', 'मेरा भाव', 'Mera bhaav') : t('New price', 'नया भाव', 'Naya bhaav')} ₹</span>
              <Input numeric inputMode="decimal" style={{ width: 110 }} placeholder={String(d.quote.price)} value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} aria-label={d.side === 'buyer' ? t('Counter price', 'मेरा भाव', 'Mera bhaav') : t('New price', 'नया भाव', 'Naya bhaav')} />
              <span className="muted" style={{ fontSize: 13 }}>/{d.inquiry.unit}</span>
              <Button size="sm" variant="mart" disabled={!price} loading={busy} onClick={() => send(true)}>{d.side === 'buyer' ? t('Send counter-offer', 'counter-offer भेजें', 'Counter-offer bhejo') : t('Update price', 'भाव बदलें', 'Bhaav badlo')}</Button>
            </div>
          )}
          <div className="row" style={{ gap: 8, width: '100%' }}>
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Write a message…', 'संदेश लिखें…', 'Message likho…')} aria-label={t('Message', 'संदेश', 'Message')}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(false); } }} />
            <Button variant="primary" icon={<Send size={15} />} loading={busy && !price} disabled={!text.trim()} onClick={() => send(false)}>{t('Send', 'भेजें', 'Bhejo')}</Button>
          </div>
        </div>
      )}>
      {!d ? <p className="muted">{t('Loading…', 'लोड हो रहा है…', 'Load ho raha hai…')}</p> : (
        <div className="stack" style={{ gap: 12 }}>
          <div className="chat-quote">
            <div><span className="muted">{t('Current quote', 'अभी का भाव', 'Abhi ka bhaav')}</span> <b className="num">{rupees(d.quote.price)}/{d.inquiry.unit}</b> · {d.quote.delivery_days === 1 ? t('1 day', '1 दिन', '1 din') : `${d.quote.delivery_days} ${t('days', 'दिन', 'din')}`} · {d.quote.payment_terms}</div>
            <QuoteBadge status={d.quote.status} />
          </div>
          {d.messages.length === 0 && <p className="muted" style={{ textAlign: 'center', padding: 24 }}>{t('No messages yet. Ask about quality, packing or delivery — or send a counter-offer.', 'अभी कोई संदेश नहीं। quality, packing या delivery पूछें — या counter-offer भेजें।', 'Abhi koi message nahi. Quality, packing ya delivery poocho — ya counter-offer bhejo.')}</p>}
          <div className="chat">
            {d.messages.map((m) => (
              <div key={m.id} className={`bubble ${m.mine ? 'mine' : ''} ${m.kind !== 'text' ? 'bubble-offer' : ''}`}>
                {m.kind === 'counter' && <span className="bubble-tag">{t('Counter-offer', 'counter-offer', 'Counter-offer')} · {rupees(m.amount || 0)}/{d.inquiry.unit}</span>}
                {m.kind === 'update' && <span className="bubble-tag">{t('Price updated', 'भाव बदला', 'Bhaav badla')} · {rupees(m.amount || 0)}/{d.inquiry.unit}</span>}
                <span>{m.body}</span>
                <time className="bubble-time">{dateLabel(m.created_at.slice(0, 10), { today: t('Today', 'आज', 'Aaj'), yesterday: t('Yesterday', 'कल', 'Kal') })} {m.created_at.slice(11, 16)}</time>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        </div>
      )}
    </Drawer>
  );
}

/* ---------- post an inquiry (open, targeted, or to picked sellers) ---------- */
export interface InquiryPrefill {
  product?: string; category?: string; qty?: number; unit?: string; target_price?: number | null;
  product_id?: number; source?: 'manual' | 'stock' | 'listing' | 'reorder'; target_business_id?: number; target_name?: string;
}

export function PostInquiry({ open, onClose, prefill }: { open: boolean; onClose: () => void; prefill?: InquiryPrefill }) {
  const { t, err } = useI18n();
  const { me } = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const refresh = useMartRefresh();
  const meta = useMeta();
  const prof = useMartProfile();
  const city0 = prof.data?.profile.city || me?.business?.city || '';
  const blank = { product: '', category: '', qty: '', unit: 'kg', target_price: '', city: city0, need_by: '', frequency: 'One-time', notes: '', show_name: true, verified_only: false };
  const [f, setF] = useState(blank);
  const [who, setWho] = useState<'all' | 'pick'>('all');
  const [picked, setPicked] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    setError(''); setPicked([]); setWho('all');
    setF({
      ...blank,
      product: prefill?.product || '', category: prefill?.category || '', qty: prefill?.qty ? String(prefill.qty) : '',
      unit: prefill?.unit || 'kg', target_price: prefill?.target_price ? String(prefill.target_price) : '', city: city0
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefill, city0]);

  const preview = useQuery({
    queryKey: ['mart-match', f.category, f.city, f.verified_only],
    queryFn: () => get<{ count: number; sellers: SellerCard[] }>(`/api/mart/match-preview?category=${encodeURIComponent(f.category)}&city=${encodeURIComponent(f.city)}&verified_only=${f.verified_only ? 1 : 0}`),
    enabled: open && !!f.category
  });
  const sellers = useQuery({
    queryKey: ['mart-sellers', 'cat', f.category],
    queryFn: () => get<{ sellers: SellerCard[] }>(`/api/mart/sellers?category=${encodeURIComponent(f.category)}`),
    enabled: open && who === 'pick' && !!f.category
  });
  const pickable = useMemo(() => (sellers.data?.sellers || []).filter((s) => !s.mine), [sellers.data]);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const direct = !!prefill?.target_business_id;

  const submit = async () => {
    if (!f.product.trim()) { setError(t('What do you need?', 'क्या चाहिए?', 'Kya chahiye?')); return; }
    if (!f.category) { setError(t('Pick a category so the right sellers are told.', 'श्रेणी चुनें ताकि सही sellers को खबर जाए।', 'Category chuno taaki sahi sellers ko khabar jaaye.')); return; }
    if (!(Number(f.qty) > 0)) { setError(t('How much do you need?', 'कितना चाहिए?', 'Kitna chahiye?')); return; }
    if (!f.city.trim()) { setError(t('Which city should it be delivered to?', 'किस शहर में delivery?', 'Kis shehar me delivery?')); return; }
    if (who === 'pick' && !picked.length) { setError(t('Pick at least one seller.', 'कम से कम एक seller चुनें।', 'Kam se kam ek seller chuno.')); return; }
    setBusy(true); setError('');
    const body: Record<string, unknown> = {
      product: f.product.trim(), category: f.category, qty: Number(f.qty), unit: f.unit, target_price: f.target_price === '' ? null : Number(f.target_price),
      city: f.city.trim(), need_by: f.need_by || null, frequency: f.frequency, notes: f.notes.trim(), show_name: f.show_name, verified_only: f.verified_only
    };
    try {
      let goId: number;
      let n: number;
      if (who === 'pick') {
        const r = await post<{ inquiries: Inquiry[]; notified: number }>('/api/mart/inquiries/bulk', { ...body, seller_ids: picked });
        goId = r.inquiries[0].id; n = r.notified;
      } else {
        const r = await post<{ inquiry: Inquiry; notified: number }>('/api/mart/inquiries', {
          ...body, product_id: prefill?.product_id, source: prefill?.source || 'manual', target_business_id: prefill?.target_business_id
        });
        goId = r.inquiry.id; n = r.notified;
      }
      refresh();
      toast({ text: t(`Request posted — ${n} sellers told`, `Request डाली — ${n} sellers को खबर गई`, `Request daali — ${n} sellers ko khabar gayi`) });
      onClose();
      nav(`/mart/requests/${goId}`);
    } catch (e) { setError(err(e)); } finally { setBusy(false); }
  };

  const count = preview.data?.count ?? 0;
  return (
    <Drawer open={open} onClose={onClose} wide title={direct ? t(`Ask ${prefill?.target_name} for a quote`, `${prefill?.target_name} से भाव मांगें`, `${prefill?.target_name} se bhaav maango`) : t('Ask sellers for quotes', 'sellers से भाव मांगें', 'Sellers se bhaav maango')}
      footer={<>
        <span className="grow muted" style={{ fontSize: 13 }}>
          {who === 'pick' ? t(`${picked.length} sellers picked`, `${picked.length} sellers चुने`, `${picked.length} sellers chune`)
            : f.category ? t(`${count + (direct ? 1 : 0)} sellers will be told`, `${count + (direct ? 1 : 0)} sellers को खबर जाएगी`, `${count + (direct ? 1 : 0)} sellers ko khabar jayegi`) : ''}
        </span>
        <Button onClick={onClose}>{t('Close', 'बंद', 'Band')}</Button>
        <Button variant="primary" loading={busy} onClick={submit}>{t('Post request', 'Request डालें', 'Request daalo')}</Button>
      </>}>
      <form className="stack" style={{ gap: 16 }} onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label={t('What do you need?', 'क्या चाहिए?', 'Kya chahiye?')}>{(id) => <Input id={id} value={f.product} onChange={set('product')} placeholder={t('e.g. Sona Masoori rice, 25 kg bags', 'जैसे Sona Masoori चावल, 25 kg बोरी', 'jaise Sona Masoori chawal, 25 kg bori')} autoFocus />}</Field>
        <div className="form-3">
          <Field label={t('Category', 'श्रेणी', 'Category')}>{(id) => <Select id={id} value={f.category} onChange={set('category')}><option value="">{t('Choose…', 'चुनें…', 'Chuno…')}</option>{(meta.data?.categories || []).map((c) => <option key={c}>{c}</option>)}</Select>}</Field>
          <Field label={t('Quantity', 'मात्रा', 'Qty')}>{(id) => <Input id={id} numeric inputMode="decimal" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value.replace(/[^\d.]/g, '') })} />}</Field>
          <Field label={t('Unit', 'इकाई', 'Unit')}>{(id) => <Select id={id} value={f.unit} onChange={set('unit')}>{Array.from(new Set([...(meta.data?.units || []), f.unit])).map((u) => <option key={u}>{u}</option>)}</Select>}</Field>
        </div>
        <div className="form-3">
          <Field label={t('Target price ₹ (optional)', 'मनचाहा भाव ₹ (अगर)', 'Target bhaav ₹ (optional)')} hint={f.unit ? `${t('per', 'प्रति', 'per')} ${f.unit}` : undefined}>{(id) => <Input id={id} numeric inputMode="decimal" value={f.target_price} onChange={(e) => setF({ ...f, target_price: e.target.value.replace(/[^\d.]/g, '') })} />}</Field>
          <Field label={t('Deliver to', 'कहां पहुंचाएं', 'Kahan pahunchao')}>{(id) => <Input id={id} value={f.city} onChange={set('city')} />}</Field>
          <Field label={t('Needed by (optional)', 'कब तक (अगर)', 'Kab tak (optional)')}>{(id) => <Input id={id} type="date" value={f.need_by} onChange={set('need_by')} />}</Field>
        </div>
        <div className="form-2">
          <Field label={t('How often', 'कितनी बार', 'Kitni baar')}>{(id) => <Select id={id} value={f.frequency} onChange={set('frequency')}>{(meta.data?.frequencies || ['One-time']).map((x) => <option key={x}>{x}</option>)}</Select>}</Field>
          <Field label={t('Quality / packing notes', 'quality / packing', 'Quality / packing')}>{(id) => <Input id={id} value={f.notes} onChange={set('notes')} />}</Field>
        </div>
        <div className="toggles">
          <label className="check"><input type="checkbox" checked={!f.show_name} onChange={(e) => setF({ ...f, show_name: !e.target.checked })} /> <span><b>{t('Hide my shop name', 'दुकान का नाम छुपाएं', 'Dukaan ka naam chhupao')}</b><br /><span className="muted">{t(`Sellers see “A business in ${f.city || 'your city'}” until you order.`, `ऑर्डर तक sellers को “${f.city || 'आपके शहर'} का एक business” दिखेगा।`, `Order tak sellers ko “${f.city || 'aapke shehar'} ka ek business” dikhega.`)}</span></span></label>
          <label className="check"><input type="checkbox" checked={f.verified_only} onChange={(e) => setF({ ...f, verified_only: e.target.checked })} /> <span><b>{t('Only sellers with GST', 'सिर्फ़ GST वाले sellers', 'Sirf GST wale sellers')}</b><br /><span className="muted">{t('Sellers without a GSTIN can’t quote.', 'बिना GSTIN वाले quote नहीं कर पाएंगे।', 'Bina GSTIN wale quote nahi kar payenge.')}</span></span></label>
        </div>

        {!direct && f.category && (
          <div className="who">
            <div className="field-label">{t('Who should get this request?', 'यह request किसे भेजें?', 'Ye request kise bhejein?')}</div>
            <label className="check"><input type="radio" name="who" checked={who === 'all'} onChange={() => setWho('all')} /> <span><b>{t(`All matching sellers (${count})`, `सभी मेल खाते sellers (${count})`, `Sab matching sellers (${count})`)}</b><br /><span className="muted">{t(`Sellers of ${f.category} who deliver to ${f.city || 'your city'}. Anyone else can still see it on Mart.`, `${f.category} बेचने वाले जो ${f.city || 'आपके शहर'} में देते हैं। बाकी भी Mart पर देख सकते हैं।`, `${f.category} bechne wale jo ${f.city || 'aapke shehar'} me dete hain. Baaki bhi Mart pe dekh sakte hain.`)}</span>
              {!!preview.data?.sellers.length && <span className="match-names">{preview.data.sellers.slice(0, 5).map((s) => s.name).join(', ')}{count > 5 ? '…' : ''}</span>}</span></label>
            <label className="check"><input type="radio" name="who" checked={who === 'pick'} onChange={() => setWho('pick')} /> <span><b>{t('Only sellers I pick', 'सिर्फ़ मेरे चुने sellers', 'Sirf mere chune sellers')}</b><br /><span className="muted">{t('Each gets a private copy; you compare all quotes together.', 'हर एक को अलग copy; सारे quote एक साथ compare करें।', 'Har ek ko alag copy; saare quote ek saath compare karo.')}</span></span></label>
            {who === 'pick' && (
              <div className="pick-list">
                {sellers.isLoading && <span className="muted">{t('Loading sellers…', 'sellers लोड हो रहे हैं…', 'Sellers load ho rahe hain…')}</span>}
                {!sellers.isLoading && !pickable.length && <span className="muted">{t('No sellers in this category yet.', 'इस श्रेणी में अभी कोई seller नहीं।', 'Is category me abhi koi seller nahi.')}</span>}
                {pickable.map((s) => (
                  <label key={s.business_id} className="pick">
                    <input type="checkbox" checked={picked.includes(s.business_id)} onChange={(e) => setPicked((p) => e.target.checked ? [...p, s.business_id] : p.filter((x) => x !== s.business_id))} />
                    <Store size={15} className="muted" /> <span className="grow"><b>{s.name}</b> <TrustLine s={s} compact /></span><span className="muted">{s.city}{s.is_favourite ? ' · ★' : ''}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
        {direct && <div className="banner banner-info">{t(`${prefill?.target_name} gets this request directly. Other matching sellers can quote too.`, `${prefill?.target_name} को सीधे जाएगी। बाकी matching sellers भी quote कर सकते हैं।`, `${prefill?.target_name} ko seedhe jayegi. Baaki matching sellers bhi quote kar sakte hain.`)}</div>}
        {error && <div className="banner banner-owed" role="alert">{error}</div>}
        <button type="submit" hidden />
      </form>
    </Drawer>
  );
}
