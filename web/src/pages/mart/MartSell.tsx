import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Camera, EyeOff, ImageOff, MessagesSquare, Pencil, Plus, Send, Store, Tag, Target, Trash2, Undo2 } from 'lucide-react';
import { del, get, post, put } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useSession } from '../../lib/session';
import { dateLabel, qty as fmtQty, round2, rupees } from '../../lib/format';
import type { Product } from '../../lib/types';
import { Badge, Button, Drawer, Empty, Field, Input, Select, SkelRows, Tabs, useToast } from '../../components/ui';
import { PageHeader, useIsMobile, usePageTitle } from '../../components/shell/AppShell';
import {
  resizeImage, termsText, useMartProfile, useMartRefresh, useMartSummary, useMeta,
  type Lead, type Listing, type MartProfile, type SellerInquiryDetail, type SentQuote
} from './martApi';
import { QuoteBadge, QuoteChat } from './martUi';

// Selling on Mart: a lead inbox (like IndiaMART's lead manager, but free and
// matched on category + delivery city), a fast quote composer, quotes sent,
// a catalog, and the seller profile buyers see.

type Tab = 'leads' | 'sent' | 'catalog' | 'profile';

export default function MartSell() {
  const { t } = useI18n();
  const { me } = useSession();
  const [sp, setSp] = useSearchParams();
  usePageTitle(t('Sell on Mart', 'मार्ट पर बेचें', 'Mart pe becho'));
  // Two-stage workflow: selling needs an ACTIVE workspace. Buying is
  // already open; this whole page waits for the shop setup.
  const wsActive = !!me?.business?.workspace_active;
  const prof = useMartProfile();
  const sum = useMartSummary(wsActive);
  const isSeller = !!prof.data?.profile.is_seller;
  const [tab, setTab] = useState<Tab>((sp.get('tab') as Tab) || 'leads');
  const lead = Number(sp.get('lead')) || null;
  useEffect(() => { if (prof.data && !isSeller && tab !== 'profile') setTab('profile'); }, [prof.data, isSeller, tab]);

  const s = sum.data?.selling;
  return (
    <div className="page mart-page">
      <PageHeader
        title={t('Sell to businesses', 'businesses को बेचें', 'Businesses ko becho')}
        sub={isSeller
          ? t(`${s?.quotes_sent ?? 0} ${s?.quotes_sent === 1 ? 'quote' : 'quotes'} sent · ${s?.won ?? 0} won · ${rupees(s?.sales ?? 0)} sold on Mart`, `${s?.quotes_sent ?? 0} quote भेजे · ${s?.won ?? 0} जीते · Mart पर ${rupees(s?.sales ?? 0)} बेचा`, `${s?.quotes_sent ?? 0} quote bheje · ${s?.won ?? 0} jeete · Mart pe ${rupees(s?.sales ?? 0)} becha`)
          : t('Get purchase requests from shops that need what you sell.', 'जो दुकानें आपका सामान ढूंढ रही हैं उनकी requests पाएं।', 'Jo dukaanein aapka saaman dhoondh rahi hain unki requests paao.')}
      />
      {!wsActive ? (
        <section className="panel">
          <Empty
            icon={<Store size={28} />}
            title={t('Set up your shop first', 'पहले दुकान setup करें', 'Pehle dukaan setup karo')}
            body={t('Selling on the Mart — leads, quotes, your catalog — opens the moment your shop setup is done. Buying is already open.', 'Mart पर बेचना — leads, quotes, आपका catalog — दुकान setup होते ही खुल जाएगा। खरीद अभी से खुली है।', 'Mart pe bechna — leads, quotes, aapka catalog — dukaan setup hote hi khul jayega. Khareed abhi se khuli hai.')}
            action={<Link to="/setup" className="btn btn-primary">{t('Set up my shop', 'दुकान setup करें', 'Dukaan setup karo')}</Link>}
          />
        </section>
      ) : (
      <section className="panel">
        <div style={{ padding: '0 16px' }}>
          <Tabs<Tab> label={t('Selling', 'बिक्री', 'Bikri')} value={tab} onChange={(v) => { setTab(v); sp.set('tab', v); setSp(sp, { replace: true }); }} tabs={[
            ...(isSeller ? [
              { value: 'leads' as Tab, label: t('Leads', 'Leads', 'Leads'), count: s?.new_leads || undefined },
              { value: 'sent' as Tab, label: t('Quotes sent', 'भेजे quotes', 'Bheje quotes') },
              { value: 'catalog' as Tab, label: t('My catalog', 'मेरा catalog', 'Mera catalog') }
            ] : []),
            { value: 'profile', label: isSeller ? t('Seller profile', 'Seller profile', 'Seller profile') : t('Start selling', 'बेचना शुरू करें', 'Bechna shuru karo') }
          ]} />
        </div>
        {tab === 'leads' && isSeller && <Leads onOpen={(id) => { sp.set('lead', String(id)); setSp(sp); }} />}
        {tab === 'sent' && isSeller && <Sent onOpen={(id) => { sp.set('lead', String(id)); setSp(sp); }} />}
        {tab === 'catalog' && isSeller && <Catalog />}
        {tab === 'profile' && <ProfileForm p={prof.data?.profile} loading={prof.isLoading} />}
      </section>
      )}
      <LeadDrawer id={lead} openChat={sp.get('chat') === '1'} onClose={() => { sp.delete('lead'); sp.delete('chat'); setSp(sp, { replace: true }); }} />
    </div>
  );
}

function Leads({ onOpen }: { onOpen: (id: number) => void }) {
  const { t } = useI18n();
  const mobile = useIsMobile();
  const [scope, setScope] = useState<'matched' | 'all'>('matched');
  const q = useQuery({ queryKey: ['mart-leads', scope], queryFn: () => get<{ leads: Lead[] }>(`/api/mart/leads?scope=${scope}`) });
  const rows = q.data?.leads || [];
  const fresh = rows.filter((l) => !l.my_quote).length;
  const words = { today: t('Today', 'आज', 'Aaj'), yesterday: t('Yesterday', 'कल', 'Kal') };
  return (
    <>
      <div className="toolbar">
        <div className="segmented" role="group">
          <button aria-pressed={scope === 'matched'} onClick={() => setScope('matched')}>{t('Matched to me', 'मेरे लिए', 'Mere liye')}</button>
          <button aria-pressed={scope === 'all'} onClick={() => setScope('all')}>{t('All open requests', 'सभी खुली requests', 'Sab khuli requests')}</button>
        </div>
        <span className="muted" style={{ fontSize: 13 }}>{q.data ? t(`${fresh} without your quote`, `${fresh} पर आपका quote नहीं`, `${fresh} pe aapka quote nahi`) : ''}</span>
      </div>
      {q.isLoading ? <SkelRows /> : !rows.length ? (
        <Empty icon={<Target size={28} />} title={t('No open leads right now', 'अभी कोई lead नहीं', 'Abhi koi lead nahi')}
          body={scope === 'matched' ? t('Leads match your categories and delivery cities. Add more in your seller profile to see more.', 'Leads आपकी श्रेणी और delivery शहरों से मिलती हैं। ज़्यादा के लिए profile में जोड़ें।', 'Leads aapki category aur delivery shehar se milti hain. Zyada ke liye profile me jodo.') : undefined} />
      ) : (
        <div className="list">{rows.map((l) => (
          <button key={l.id} className="list-row lead-row" onClick={() => onOpen(l.id)}>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="title">{fmtQty(l.qty)} {l.unit} {l.product}</div>
              <div className="meta">
                {l.buyer.name}{l.buyer.verified ? ' ✓' : ''} · {l.city}{l.need_by ? ` · ${t('by', 'तक', 'tak')} ${l.need_by}` : ''}{l.target_price != null ? ` · ${t('target', 'भाव', 'target')} ${rupees(l.target_price)}/${l.unit}` : ''}
                {!mobile && ` · ${dateLabel(l.created_at.slice(0, 10), words)}`}
              </div>
            </div>
            <span className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {l.direct && <Badge tone="mart">{t('Asked you', 'आपसे मांगा', 'Aapse maanga')}</Badge>}
              {l.my_quote ? <QuoteBadge status={l.my_quote.status} /> : l.quotes_count === 0 ? <Badge tone="mart">{t('New — be first to quote', 'नई — पहले quote करें', 'Nayi — pehle quote karo')}</Badge> : <Badge tone="accent">{(l.quotes_count === 1 ? t('1 quote so far', 'अब तक 1 quote', 'Ab tak 1 quote') : t(`${l.quotes_count} quotes so far`, `अब तक ${l.quotes_count} quote`, `Ab tak ${l.quotes_count} quote`))}</Badge>}
              {l.verified_only && <Badge plain>GST</Badge>}
            </span>
          </button>
        ))}</div>
      )}
    </>
  );
}

function Sent({ onOpen }: { onOpen: (inquiryId: number) => void }) {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['mart-sent'], queryFn: () => get<{ quotes: SentQuote[] }>('/api/mart/quotes-sent') });
  const rows = q.data?.quotes || [];
  if (q.isLoading) return <SkelRows />;
  if (!rows.length) return <Empty icon={<Send size={28} />} title={t('No quotes sent yet', 'अभी कोई quote नहीं भेजा', 'Abhi koi quote nahi bheja')} body={t('Open a lead and send your price — it takes under a minute.', 'Lead खोलें और भाव भेजें — एक मिनट से कम।', 'Lead kholo aur bhaav bhejo — ek minute se kam.')} />;
  return (
    <div className="table-wrap"><table className="table">
      <thead><tr><th>{t('Request', 'Request', 'Request')}</th><th>{t('Buyer', 'Buyer', 'Buyer')}</th><th className="r">{t('Your price', 'आपका भाव', 'Aapka bhaav')}</th><th>{t('Status', 'स्थिति', 'Status')}</th></tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.id} className="clickable" tabIndex={0} onClick={() => onOpen(r.inquiry_id)} onKeyDown={(e) => e.key === 'Enter' && onOpen(r.inquiry_id)}>
          <td><span className="primary">{fmtQty(r.inquiry.qty)} {r.inquiry.unit} {r.inquiry.product}</span><span className="sub">{r.inquiry.city}</span></td>
          <td>{r.buyer.name}</td>
          <td className="r num">{rupees(r.price)}/{r.inquiry.unit}<span className="sub">{rupees(round2(r.price * r.inquiry.qty))}</span></td>
          <td>{r.order ? <Badge tone="in">{r.order.order_no} · {r.order.status}</Badge> : <QuoteBadge status={r.status} />}</td>
        </tr>
      ))}</tbody>
    </table></div>
  );
}

function LeadDrawer({ id, onClose, openChat }: { id: number | null; onClose: () => void; openChat?: boolean }) {
  const { t, err } = useI18n();
  const toast = useToast();
  const refresh = useMartRefresh();
  const meta = useMeta();
  const q = useQuery({ queryKey: ['mart-inquiry', String(id)], queryFn: () => get<SellerInquiryDetail>(`/api/mart/inquiries/${id}`), enabled: !!id });
  const d = q.data?.role === 'seller' ? q.data : null;
  const mine = d?.my_quote || null;
  const [f, setF] = useState({ price: '', delivery_days: '2', payment_terms: '', advance_percent: '', credit_days: '', moq: '', valid_days: '3', note: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [chat, setChat] = useState(false);
  useEffect(() => { if (openChat && mine) setChat(true); }, [openChat, mine?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!d) return;
    setError('');
    setF(mine
      ? { price: String(mine.price), delivery_days: String(mine.delivery_days), payment_terms: mine.payment_terms, advance_percent: mine.advance_percent == null ? '' : String(mine.advance_percent), credit_days: mine.credit_days == null ? '' : String(mine.credit_days), moq: mine.moq ? String(mine.moq) : '', valid_days: String(mine.valid_days), note: mine.note || '' }
      : { price: '', delivery_days: '2', payment_terms: meta.data?.payment_terms[0] || 'Cash on delivery', advance_percent: '', credit_days: '', moq: '', valid_days: '3', note: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.inquiry.id, mine?.id, mine?.updated_at, meta.data]);
  const n = (v: string) => v.replace(/[^\d.]/g, '');
  const price = Number(f.price);
  const live = mine?.status === 'sent';
  const canEdit = d?.can_quote && (!mine || ['sent', 'declined', 'closed', 'expired', 'withdrawn'].includes(mine.status));

  const submit = async () => {
    if (!d) return;
    if (!(price > 0)) { setError(t('Enter your price.', 'अपना भाव लिखें।', 'Apna bhaav likho.')); return; }
    setBusy(true); setError('');
    const body = { price, delivery_days: Number(f.delivery_days) || 0, payment_terms: f.payment_terms, advance_percent: f.advance_percent, credit_days: f.credit_days, moq: f.moq, valid_days: f.valid_days, note: f.note };
    try {
      if (live) await put(`/api/mart/quotes/${mine!.id}`, body);
      else await post(`/api/mart/inquiries/${d.inquiry.id}/quotes`, body);
      refresh();
      toast({ text: live ? t('Quote updated — buyer notified', 'quote बदला — buyer को खबर गई', 'Quote badla — buyer ko khabar gayi') : t('Quote sent — buyer notified', 'quote भेजा — buyer को खबर गई', 'Quote bheja — buyer ko khabar gayi') });
    } catch (e) { setError(err(e)); } finally { setBusy(false); }
  };
  const withdraw = async () => {
    try { await post(`/api/mart/quotes/${mine!.id}/withdraw`); refresh(); toast({ text: t('Quote withdrawn', 'quote वापस लिया', 'Quote wapas liya') }); }
    catch (e) { toast({ text: err(e), tone: 'error' }); }
  };
  const reason = d?.cannot_quote_reason;
  return (
    <>
      <Drawer open={!!id && !chat} onClose={onClose} wide title={d ? `${fmtQty(d.inquiry.qty)} ${d.inquiry.unit} ${d.inquiry.product}` : t('Lead', 'Lead', 'Lead')}
        footer={d && canEdit ? <>
          {mine && <Button icon={<MessagesSquare size={16} />} onClick={() => setChat(true)} style={{ marginRight: 'auto' }}>{t('Chat with buyer', 'buyer से बात', 'Buyer se baat')}</Button>}
          {live && <Button variant="ghost" icon={<Undo2 size={16} />} onClick={withdraw}>{t('Withdraw', 'वापस लें', 'Wapas lo')}</Button>}
          <Button variant="primary" icon={<Send size={16} />} loading={busy} onClick={submit}>{live ? t('Update quote', 'quote बदलें', 'Quote badlo') : t('Send quote', 'quote भेजें', 'Quote bhejo')}{price > 0 && d ? ` · ${rupees(round2(price * d.inquiry.qty))}` : ''}</Button>
        </> : d && mine ? <Button icon={<MessagesSquare size={16} />} onClick={() => setChat(true)}>{t('Chat with buyer', 'buyer से बात', 'Buyer se baat')}</Button> : undefined}>
        {!d ? <SkelRows rows={6} /> : (
          <div className="stack" style={{ gap: 18 }}>
            <div className="lead-head">
              <div><span className="strip-label">{t('Buyer', 'Buyer', 'Buyer')}</span><div style={{ fontWeight: 600 }}>{d.buyer.name} {d.buyer.hidden && <EyeOff size={13} className="muted" />}</div><div className="muted" style={{ fontSize: 13 }}>{[d.buyer.verified ? t('verified details', 'जानकारी पूरी', 'details verified') : d.buyer.gst_registered ? 'GST' : null].filter(Boolean).join(' · ') || '—'}</div></div>
              <div><span className="strip-label">{t('Deliver to', 'कहां', 'Kahan')}</span><div style={{ fontWeight: 600 }}>{d.inquiry.city}</div><div className="muted" style={{ fontSize: 13 }}>{d.inquiry.need_by ? `${t('by', 'तक', 'tak')} ${d.inquiry.need_by}` : t('no deadline', 'कोई जल्दी नहीं', 'koi jaldi nahi')}</div></div>
              <div><span className="strip-label">{t('Target', 'मनचाहा भाव', 'Target')}</span><div style={{ fontWeight: 600 }} className="num">{d.inquiry.target_price != null ? `${rupees(d.inquiry.target_price)}/${d.inquiry.unit}` : '—'}</div><div className="muted" style={{ fontSize: 13 }}>{d.quotes_count} {t('quotes so far', 'quote अब तक', 'quote ab tak')}</div></div>
            </div>
            <p className="muted">{[d.inquiry.category, d.inquiry.frequency, d.inquiry.verified_only && t('GST sellers only', 'सिर्फ़ GST', 'sirf GST')].filter(Boolean).join(' · ')}{d.inquiry.notes ? ` — “${d.inquiry.notes}”` : ''}</p>
            {mine && <div className="row" style={{ gap: 8 }}><span className="muted">{t('Your quote', 'आपका quote', 'Aapka quote')}:</span> <b className="num">{rupees(mine.price)}/{d.inquiry.unit}</b> · {termsText(mine)} <QuoteBadge status={mine.status} /></div>}
            {!canEdit && reason && (
              <div className="banner banner-warn">{reason === 'gst_required' ? t('This buyer only accepts sellers with GST. Add your GSTIN in Settings to quote.', 'यह buyer सिर्फ़ GST वाले sellers चाहता है। quote के लिए Settings में GSTIN डालें।', 'Ye buyer sirf GST wale sellers chahta hai. Quote ke liye Settings me GSTIN daalo.') : reason === 'closed' ? t('This request is no longer open.', 'यह request अब खुली नहीं है।', 'Ye request ab khuli nahi hai.') : t('Turn on selling in your seller profile to quote.', 'quote के लिए seller profile में बेचना चालू करें।', 'Quote ke liye seller profile me bechna chalu karo.')}</div>
            )}
            {mine?.status === 'accepted' && <div className="banner banner-info">{t('You won this — see it in Mart orders.', 'आप जीते — Mart ऑर्डर में देखें।', 'Aap jeete — Mart orders me dekho.')}</div>}
            {canEdit && (
              <form className="quote-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
                <div className="form-3">
                  <Field label={`${t('Your price', 'आपका भाव', 'Aapka bhaav')} ₹ / ${d.inquiry.unit}`} error={error}>{(fid) => <Input id={fid} size2="lg" numeric inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: n(e.target.value) })} autoFocus />}</Field>
                  <Field label={t('Delivery in (days)', 'कितने दिन में', 'Kitne din me')}>{(fid) => <Input id={fid} size2="lg" numeric inputMode="numeric" value={f.delivery_days} onChange={(e) => setF({ ...f, delivery_days: n(e.target.value) })} />}</Field>
                  <Field label={t('Minimum order', 'कम से कम', 'Kam se kam')} hint={d.inquiry.unit}>{(fid) => <Input id={fid} size2="lg" numeric inputMode="decimal" placeholder="—" value={f.moq} onChange={(e) => setF({ ...f, moq: n(e.target.value) })} />}</Field>
                </div>
                <div className="form-3">
                  <Field label={t('Payment terms', 'भुगतान', 'Payment')}>{(fid) => <Select id={fid} value={f.payment_terms} onChange={(e) => setF({ ...f, payment_terms: e.target.value })}>{(meta.data?.payment_terms || []).map((x) => <option key={x}>{x}</option>)}</Select>}</Field>
                  <Field label={t('Advance % (optional)', 'advance % (अगर)', 'Advance % (optional)')}>{(fid) => <Input id={fid} numeric inputMode="decimal" value={f.advance_percent} onChange={(e) => setF({ ...f, advance_percent: n(e.target.value) })} />}</Field>
                  <Field label={t('Credit days (optional)', 'उधार दिन (अगर)', 'Udhaar din (optional)')}>{(fid) => <Input id={fid} numeric inputMode="numeric" value={f.credit_days} onChange={(e) => setF({ ...f, credit_days: n(e.target.value) })} />}</Field>
                </div>
                <div className="form-2">
                  <Field label={t('Quote valid for (days)', 'कितने दिन मान्य', 'Kitne din valid')}>{(fid) => <Input id={fid} numeric inputMode="numeric" value={f.valid_days} onChange={(e) => setF({ ...f, valid_days: n(e.target.value) })} />}</Field>
                  <Field label={t('Note for the buyer', 'buyer के लिए नोट', 'Buyer ke liye note')}>{(fid) => <Input id={fid} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder={t('e.g. free delivery above 400 kg', 'जैसे 400 kg से ऊपर फ्री डिलीवरी', 'jaise 400 kg se upar free delivery')} />}</Field>
                </div>
                {price > 0 && d.inquiry.target_price != null && (
                  <p className={price <= d.inquiry.target_price ? 'money-in' : 'money-warn'} style={{ fontSize: 13 }}>
                    {price <= d.inquiry.target_price ? t('At or under the buyer’s target.', 'buyer के भाव पर या कम।', 'Buyer ke bhaav pe ya kam.') : t(`${rupees(round2(price - d.inquiry.target_price))} above the buyer’s target.`, `buyer के भाव से ${rupees(round2(price - d.inquiry.target_price))} ज़्यादा।`, `Buyer ke bhaav se ${rupees(round2(price - d.inquiry.target_price))} zyada.`)}
                  </p>
                )}
                <button type="submit" hidden />
              </form>
            )}
          </div>
        )}
      </Drawer>
      <QuoteChat quoteId={mine?.id || null} open={chat} onClose={() => setChat(false)} />
    </>
  );
}

function Catalog() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['mart-my-listings'], queryFn: () => get<{ listings: Listing[] }>('/api/mart/my-listings') });
  const [edit, setEdit] = useState<Listing | 'new' | null>(null);
  const rows = q.data?.listings || [];
  return (
    <div className="panel-body">
      <div className="row-between" style={{ marginBottom: 16 }}>
        <p className="muted" style={{ fontSize: 13 }}>{t('Buyers browsing Mart see these with your wholesale price and minimum order.', 'Mart देखने वाले buyers को ये आपके थोक भाव और minimum के साथ दिखते हैं।', 'Mart dekhne wale buyers ko ye aapke thok bhaav aur minimum ke saath dikhte hain.')}</p>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEdit('new')}>{t('Add product', 'सामान जोड़ें', 'Saaman jodo')}</Button>
      </div>
      {q.isLoading ? <SkelRows /> : !rows.length ? <Empty icon={<Tag size={28} />} title={t('Your catalog is empty', 'catalog खाली है', 'Catalog khaali hai')} /> : (
        <div className="listing-grid">{rows.map((l) => (
          <button key={l.id} className={`listing-card ${l.active ? '' : 'is-hidden'}`} onClick={() => setEdit(l)}>
            <span className="listing-photo">{l.photo ? <img src={l.photo} alt="" /> : <ImageOff size={22} />}</span>
            <span className="listing-body">
              <span className="title ellipsis">{l.name}</span>
              <span className="num listing-price">{rupees(l.price)}<span className="muted">/{l.unit}</span></span>
              <span className="meta">{t('Min.', 'कम से कम', 'Min.')} {fmtQty(l.moq)} {l.unit} · {l.category}</span>
              {!l.active && <Badge>{t('Hidden', 'छुपा', 'Chhupa')}</Badge>}
            </span>
            <Pencil size={14} className="listing-edit muted" />
          </button>
        ))}</div>
      )}
      <ListingDrawer value={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

function ListingDrawer({ value, onClose }: { value: Listing | 'new' | null; onClose: () => void }) {
  const { t, err } = useI18n();
  const toast = useToast();
  const refresh = useMartRefresh();
  const meta = useMeta();
  const { can } = useSession();
  const prods = useQuery({ queryKey: ['products'], queryFn: () => get<{ products: Product[] }>('/api/products'), enabled: !!value && can.stock });
  const l = value && value !== 'new' ? value : null;
  const [f, setF] = useState({ name: '', category: '', unit: 'kg', price: '', moq: '', product_id: '', active: true });
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoTouched, setPhotoTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!value) return;
    setError(''); setPhotoTouched(false);
    setF(l ? { name: l.name, category: l.category, unit: l.unit, price: String(l.price), moq: String(l.moq), product_id: l.product_id ? String(l.product_id) : '', active: l.active } : { name: '', category: '', unit: 'kg', price: '', moq: '', product_id: '', active: true });
    setPhoto(l?.photo || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const pick = async (file?: File) => {
    if (!file) return;
    try { setPhoto(await resizeImage(file)); setPhotoTouched(true); }
    catch { toast({ text: t('That file isn’t an image we can read.', 'यह image नहीं खुली।', 'Ye image nahi khuli.'), tone: 'error' }); }
  };
  const save = async () => {
    setBusy(true); setError('');
    const body: Record<string, unknown> = { name: f.name.trim(), category: f.category, unit: f.unit, price: Number(f.price), moq: Number(f.moq), active: f.active };
    if (f.product_id) body.product_id = Number(f.product_id);
    if (!l || photoTouched) body.photo = photo;
    try {
      if (l) await put(`/api/mart/listings/${l.id}`, body); else await post('/api/mart/listings', body);
      refresh(); toast({ text: l ? t('Listing saved', 'सेव हुआ', 'Save hua') : t('Added to your catalog', 'catalog में जुड़ा', 'Catalog me juda') }); onClose();
    } catch (e) { setError(err(e)); } finally { setBusy(false); }
  };
  const remove = async () => {
    try { await del(`/api/mart/listings/${l!.id}`); refresh(); toast({ text: t('Removed from catalog', 'catalog से हटाया', 'Catalog se hataya') }); onClose(); }
    catch (e) { setError(err(e)); }
  };
  return (
    <Drawer open={!!value} onClose={onClose} title={l ? l.name : t('Add to catalog', 'catalog में जोड़ें', 'Catalog me jodo')}
      footer={<>{l && <Button variant="ghost" icon={<Trash2 size={16} />} onClick={remove} style={{ marginRight: 'auto' }}>{t('Remove', 'हटाएं', 'Hatao')}</Button>}<Button onClick={onClose}>{t('Close', 'बंद', 'Band')}</Button><Button variant="primary" loading={busy} onClick={save}>{l ? t('Save', 'सेव करें', 'Save karo') : t('Add', 'जोड़ें', 'Jodo')}</Button></>}>
      <div className="stack" style={{ gap: 16 }}>
        <label className="photo-pick">
          {photo ? <img src={photo} alt="" /> : <span className="muted"><Camera size={22} /><br />{t('Add a photo', 'फ़ोटो जोड़ें', 'Photo jodo')}</span>}
          <input type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {photo && <Button size="sm" variant="ghost" onClick={() => { setPhoto(null); setPhotoTouched(true); }}>{t('Remove photo', 'फ़ोटो हटाएं', 'Photo hatao')}</Button>}
        {can.stock && !!prods.data?.products.length && (
          <Field label={t('From my products (optional)', 'मेरे सामान से (अगर)', 'Mere saaman se (optional)')}>{(fid) => <Select id={fid} value={f.product_id} onChange={(e) => { const p = prods.data!.products.find((x) => String(x.id) === e.target.value); setF({ ...f, product_id: e.target.value, name: p && !f.name ? p.name : f.name }); }}><option value="">—</option>{prods.data.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>}</Field>
        )}
        <Field label={t('Product name', 'सामान का नाम', 'Saaman ka naam')}>{(fid) => <Input id={fid} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
        <div className="form-2">
          <Field label={t('Category', 'श्रेणी', 'Category')}>{(fid) => <Select id={fid} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">{t('Choose…', 'चुनें…', 'Chuno…')}</option>{(meta.data?.categories || []).map((c) => <option key={c}>{c}</option>)}</Select>}</Field>
          <Field label={t('Unit', 'इकाई', 'Unit')}>{(fid) => <Select id={fid} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>{(meta.data?.units || []).map((u) => <option key={u}>{u}</option>)}</Select>}</Field>
        </div>
        <div className="form-2">
          <Field label={t('Wholesale price ₹', 'थोक भाव ₹', 'Thok bhaav ₹')}>{(fid) => <Input id={fid} numeric inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value.replace(/[^\d.]/g, '') })} />}</Field>
          <Field label={t('Minimum order', 'कम से कम ऑर्डर', 'Minimum order')}>{(fid) => <Input id={fid} numeric inputMode="decimal" value={f.moq} onChange={(e) => setF({ ...f, moq: e.target.value.replace(/[^\d.]/g, '') })} />}</Field>
        </div>
        <label className="check"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> <span>{t('Show to buyers', 'buyers को दिखाएं', 'Buyers ko dikhao')}</span></label>
        {error && <div className="banner banner-owed">{error}</div>}
      </div>
    </Drawer>
  );
}

function ProfileForm({ p, loading }: { p?: MartProfile; loading: boolean }) {
  const { t, err } = useI18n();
  const { can } = useSession();
  const toast = useToast();
  const refresh = useMartRefresh();
  const meta = useMeta();
  const [f, setF] = useState({ display_name: '', city: '', area: '', about: '', categories: [] as string[], service_cities: '', all_india: false, is_seller: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (p) setF({ display_name: p.display_name, city: p.city, area: p.area, about: p.about, categories: p.categories, service_cities: p.service_cities.join(', '), all_india: p.all_india, is_seller: p.is_seller }); }, [p]);
  const cats = useMemo(() => meta.data?.categories || [], [meta.data]);
  if (loading || !p) return <SkelRows />;
  const readOnly = !can.owner;
  const save = async () => {
    setBusy(true); setError('');
    try {
      await put('/api/mart/profile', { ...f, service_cities: f.service_cities.split(',').map((x) => x.trim()).filter(Boolean) });
      refresh(); toast({ text: f.is_seller ? t('Seller profile saved — leads will start arriving', 'profile सेव — leads आने लगेंगी', 'Profile save — leads aane lagengi') : t('Profile saved', 'profile सेव', 'Profile save') });
    } catch (e) { setError(err(e)); } finally { setBusy(false); }
  };
  return (
    <div className="panel-body stack" style={{ gap: 18, maxWidth: 760 }}>
      {!p.is_seller && <div className="banner banner-info"><Store size={18} /> <span>{t('Choose what you sell and where you deliver. You’ll get matching purchase requests from shops — free, no lead charges.', 'आप क्या बेचते हैं और कहां देते हैं चुनें। मेल खाती requests मिलेंगी — मुफ़्त।', 'Aap kya bechte ho aur kahan dete ho chuno. Matching requests milengi — free.')}</span></div>}
      {readOnly && <div className="banner banner-warn">{t('Only the owner can change the Mart profile.', 'Mart profile सिर्फ़ मालिक बदल सकते हैं।', 'Mart profile sirf owner badal sakta hai.')}</div>}
      <fieldset disabled={readOnly} className="stack" style={{ gap: 16, border: 0, padding: 0, margin: 0 }}>
        <label className="check"><input type="checkbox" checked={f.is_seller} onChange={(e) => setF({ ...f, is_seller: e.target.checked })} /> <span><b>{t('I sell on Business Mart', 'मैं Business Mart पर बेचता हूं', 'Main Business Mart pe bechta hoon')}</b></span></label>
        <div className="form-2">
          <Field label={t('Name buyers see', 'buyers को दिखने वाला नाम', 'Buyers ko dikhne wala naam')}>{(id) => <Input id={id} value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} />}</Field>
          <Field label={t('City', 'शहर', 'Shehar')}>{(id) => <Input id={id} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />}</Field>
        </div>
        <Field label={t('Market / area', 'बाज़ार / इलाका', 'Bazaar / ilaaka')}>{(id) => <Input id={id} value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} />}</Field>
        <div className="field">
          <span className="field-label">{t('What you sell', 'आप क्या बेचते हैं', 'Aap kya bechte ho')}</span>
          <div className="chips">{cats.map((c) => {
            const on = f.categories.includes(c);
            return <button type="button" key={c} className={`chip ${on ? 'chip-on' : ''}`} aria-pressed={on} onClick={() => setF({ ...f, categories: on ? f.categories.filter((x) => x !== c) : [...f.categories, c] })}>{c}</button>;
          })}</div>
        </div>
        <label className="check"><input type="checkbox" checked={f.all_india} onChange={(e) => setF({ ...f, all_india: e.target.checked })} /> <span><b>{t('I deliver all over India', 'पूरे भारत में देता हूं', 'Poore Bharat me deta hoon')}</b></span></label>
        {!f.all_india && <Field label={t('Other cities you deliver to', 'और किन शहरों में देते हैं', 'Aur kin shehron me dete ho')} hint={t('Separate with commas. Your own city is included.', 'comma से अलग करें। आपका शहर शामिल है।', 'Comma se alag karo. Aapka shehar shaamil hai.')}>{(id) => <Input id={id} value={f.service_cities} onChange={(e) => setF({ ...f, service_cities: e.target.value })} />}</Field>}
        <Field label={t('About your business', 'आपके business के बारे में', 'Aapke business ke baare me')}>{(id) => <textarea id={id} className="textarea" maxLength={400} value={f.about} onChange={(e) => setF({ ...f, about: e.target.value })} />}</Field>
        <p className="muted" style={{ fontSize: 13 }}>{p.verified ? t('✓ Your profile shows “Verified details” (GSTIN, phone and city on file).', '✓ आपकी profile पर “जानकारी पूरी” दिखता है।', '✓ Aapki profile pe “Details verified” dikhta hai.') : t('Add your GSTIN and phone in Settings to show “Verified details” to buyers.', 'buyers को “जानकारी पूरी” दिखाने के लिए Settings में GSTIN और फ़ोन डालें।', 'Buyers ko “Details verified” dikhane ke liye Settings me GSTIN aur phone daalo.')}</p>
        {error && <div className="banner banner-owed">{error}</div>}
        <div><Button variant="primary" loading={busy} onClick={save}>{t('Save profile', 'profile सेव करें', 'Profile save karo')}</Button></div>
      </fieldset>
    </div>
  );
}
