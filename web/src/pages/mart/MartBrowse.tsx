import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Bell, CheckCheck, ImageOff, MapPin, Search, Star, Store } from 'lucide-react';
import { del, get, post } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { dateLabel, qty as fmtQty, rupees } from '../../lib/format';
import { Badge, Button, Empty, SkelRows, Tabs, useToast } from '../../components/ui';
import { PageHeader, usePageTitle } from '../../components/shell/AppShell';
import { useMartRefresh, useMeta, type Listing, type Notification, type SellerCard } from './martApi';
import { PostInquiry, TrustLine, type InquiryPrefill } from './martUi';

/* ---------- Browse: products and sellers ---------- */
export default function MartBrowse() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  usePageTitle(t('Browse Mart', 'मार्ट देखें', 'Mart dekho'));
  const meta = useMeta();
  const [tab, setTab] = useState<'products' | 'sellers'>(sp.get('tab') === 'sellers' ? 'sellers' : 'products');
  const [cat, setCat] = useState(sp.get('category') || '');
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [ask, setAsk] = useState<InquiryPrefill | null>(null);
  const listings = useQuery({ queryKey: ['mart-listings', cat, term], queryFn: () => get<{ listings: Listing[] }>(`/api/mart/listings?category=${encodeURIComponent(cat)}&q=${encodeURIComponent(term)}`), enabled: tab === 'products' });
  const sellers = useQuery({ queryKey: ['mart-sellers', cat, term], queryFn: () => get<{ sellers: SellerCard[] }>(`/api/mart/sellers?category=${encodeURIComponent(cat)}&q=${encodeURIComponent(term)}`), enabled: tab === 'sellers' });

  return (
    <div className="page mart-page">
      <PageHeader title={t('Browse Mart', 'मार्ट देखें', 'Mart dekho')} sub={t('Wholesale products and sellers — those in your city first.', 'थोक सामान और sellers — आपके शहर वाले पहले।', 'Thok saaman aur sellers — aapke shehar wale pehle.')}
        actions={<Button variant="primary" onClick={() => setAsk({})}>{t('Can’t find it? Ask for quotes', 'नहीं मिला? भाव मांगें', 'Nahi mila? Bhaav maango')}</Button>} />
      <section className="panel">
        <div style={{ padding: '0 16px' }}>
          <Tabs label={t('Browse', 'देखें', 'Dekho')} value={tab} onChange={(v) => { setTab(v); sp.set('tab', v); setSp(sp, { replace: true }); }} tabs={[
            { value: 'products', label: t('Products', 'सामान', 'Saaman') }, { value: 'sellers', label: t('Sellers', 'Sellers', 'Sellers') }
          ]} />
        </div>
        <div className="toolbar">
          <form className="input-wrap" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }}><Search size={16} /><input className="input" value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setTerm(''); }} placeholder={tab === 'products' ? t('Search products or sellers', 'सामान या seller खोजें', 'Saaman ya seller khojo') : t('Seller name', 'seller का नाम', 'Seller ka naam')} onBlur={() => setTerm(q.trim())} /></form>
        </div>
        <div className="chips cat-chips">
          <button className={`chip ${!cat ? 'chip-on' : ''}`} aria-pressed={!cat} onClick={() => setCat('')}>{t('All', 'सभी', 'Sab')}</button>
          {(meta.data?.categories || []).map((c) => <button key={c} className={`chip ${cat === c ? 'chip-on' : ''}`} aria-pressed={cat === c} onClick={() => setCat(cat === c ? '' : c)}>{c}</button>)}
        </div>
        {tab === 'products' ? (
          listings.isLoading ? <SkelRows /> : !(listings.data?.listings.length) ? <Empty icon={<Store size={28} />} title={t('No products here yet', 'यहां अभी कोई सामान नहीं', 'Yahan abhi koi saaman nahi')} body={t('Post a request instead — sellers who stock it will quote.', 'request डालें — जिनके पास है वो quote करेंगे।', 'Request daalo — jinke paas hai woh quote karenge.')} action={<Button variant="primary" onClick={() => setAsk({ category: cat || undefined, product: term || undefined })}>{t('Ask for quotes', 'भाव मांगें', 'Bhaav maango')}</Button>} /> : (
            <div className="listing-grid panel-body">{listings.data.listings.map((l) => (
              <article key={l.id} className="listing-card listing-card-buy">
                {l.photo && <span className="listing-photo"><img src={l.photo} alt="" loading="lazy" /></span>}
                <span className="listing-body">
                  <span className="title ellipsis">{l.name}</span>
                  <span className="num listing-price">{rupees(l.price)}<span className="muted">/{l.unit}</span></span>
                  <span className="meta">{t('Min.', 'कम से कम', 'Min.')} {fmtQty(l.moq)} {l.unit}</span>
                  {l.seller && <Link to={`/mart/sellers/${l.business_id}`} className="listing-seller">{l.seller.name} · {l.seller.city}</Link>}
                  {l.seller && <TrustLine s={l.seller} compact />}
                </span>
                {l.mine ? <Badge plain>{t('Your listing', 'आपका', 'Aapka')}</Badge> : (
                  <Button size="sm" block onClick={() => setAsk({ product: l.name, category: l.category, unit: l.unit, qty: l.moq, target_price: l.price, source: 'listing', target_business_id: l.business_id, target_name: l.seller?.name })}>{t('Ask for a quote', 'भाव मांगें', 'Bhaav maango')}</Button>
                )}
              </article>
            ))}</div>
          )
        ) : (
          sellers.isLoading ? <SkelRows /> : !(sellers.data?.sellers.length) ? <Empty icon={<Store size={28} />} title={t('No sellers found', 'कोई seller नहीं मिला', 'Koi seller nahi mila')} /> : (
            <div className="list">{sellers.data.sellers.map((s) => (
              <button key={s.business_id} className="list-row" onClick={() => nav(`/mart/sellers/${s.business_id}`)}>
                <span className="avatar"><Store size={15} /></span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="title ellipsis">{s.name} {s.is_favourite && <Star size={13} className="money-warn" fill="currentColor" style={{ verticalAlign: '-1px' }} />}{s.mine && <span className="muted"> · {t('you', 'आप', 'aap')}</span>}</div>
                  <div className="meta"><TrustLine s={s} /></div>
                  <div className="meta ellipsis">{s.categories.join(', ')}{s.all_india ? ` · ${t('delivers all India', 'पूरे भारत में', 'poore Bharat me')}` : ''}</div>
                </div>
              </button>
            ))}</div>
          )
        )}
      </section>
      <PostInquiry open={!!ask} onClose={() => setAsk(null)} prefill={ask || undefined} />
    </div>
  );
}

/* ---------- Seller profile ---------- */
export function SellerProfile() {
  const { id } = useParams();
  const { t, err } = useI18n();
  const toast = useToast();
  const refresh = useMartRefresh();
  const q = useQuery({ queryKey: ['mart-seller', id], queryFn: () => get<{ seller: SellerCard; listings: Listing[]; reviews: { rating: number; review: string | null; product: string; updated_at: string }[] }>(`/api/mart/sellers/${id}`) });
  const [ask, setAsk] = useState<InquiryPrefill | null>(null);
  usePageTitle(q.data?.seller.name || t('Seller', 'Seller', 'Seller'));
  if (q.isLoading) return <div className="page"><SkelRows rows={8} /></div>;
  if (!q.data) return <div className="page"><p>{err(q.error)}</p></div>;
  const { seller: s, listings, reviews } = q.data;
  const fav = async () => {
    try { if (s.is_favourite) await del(`/api/mart/favourites/${s.business_id}`); else await post(`/api/mart/favourites/${s.business_id}`); refresh(); toast({ text: s.is_favourite ? t('Removed from my wholesalers', 'मेरे थोक वालों से हटाया', 'Mere wholesalers se hataya') : t('Added to my wholesalers', 'मेरे थोक वालों में जुड़ा', 'Mere wholesalers me juda') }); }
    catch (e) { toast({ text: err(e), tone: 'error' }); }
  };
  return (
    <div className="page mart-page">
      <Link to="/mart/browse?tab=sellers" className="back-link"><ArrowLeft size={14} /> {t('Sellers', 'Sellers', 'Sellers')}</Link>
      <header className="page-head">
        <div className="grow">
          <h1>{s.name}</h1>
          <p className="page-sub row" style={{ gap: 6, flexWrap: 'wrap' }}><MapPin size={14} /> {[s.area, s.city].filter(Boolean).join(', ')}{s.all_india ? ` · ${t('delivers all over India', 'पूरे भारत में डिलीवरी', 'poore Bharat me delivery')}` : s.service_cities.length ? ` · ${t('also', 'और', 'aur')} ${s.service_cities.join(', ')}` : ''}</p>
        </div>
        <div className="page-actions">
          <Button icon={<Star size={16} fill={s.is_favourite ? 'currentColor' : 'none'} />} onClick={fav}>{s.is_favourite ? t('In my wholesalers', 'मेरे थोक वालों में', 'Mere wholesalers me') : t('Add to my wholesalers', 'मेरे थोक वालों में जोड़ें', 'Mere wholesalers me jodo')}</Button>
          <Button variant="primary" onClick={() => setAsk({ category: s.categories[0], target_business_id: s.business_id, target_name: s.name })}>{t('Ask for a quote', 'भाव मांगें', 'Bhaav maango')}</Button>
        </div>
      </header>
      <section className="ledger-strip">
        <div className="strip-cell"><span className="strip-label">{t('Rating', 'Rating', 'Rating')}</span><span className="strip-value">{s.rating != null ? <>{s.rating.toFixed(1)} <Star size={22} fill="currentColor" className="money-warn" /></> : '—'}</span><span className="strip-note">{s.ratings_count} {t('ratings', 'ratings', 'ratings')}</span></div>
        <div className="strip-cell"><span className="strip-label">{t('Completed deals', 'पूरे सौदे', 'Poore deals')}</span><span className="strip-value num">{s.deals}</span><span className="strip-note">{s.repeat_buyers} {t('repeat buyers', 'दोबारा खरीदार', 'repeat buyers')}</span></div>
        <div className="strip-cell"><span className="strip-label">{t('Details', 'जानकारी', 'Jaankari')}</span><span className="strip-value" style={{ fontSize: 18 }}><TrustLine s={s} compact /></span><span className="strip-note">{s.since ? `${t('on BizYour since', 'BizYour पर', 'BizYour pe since')} ${s.since}` : ''}</span></div>
      </section>
      {s.about && <p style={{ maxWidth: '70ch', marginBottom: 20 }}>{s.about}</p>}
      <div className="home-grid">
        <section className="panel">
          <header className="panel-head"><h2>{t('Products', 'सामान', 'Saaman')}</h2><span className="muted" style={{ fontSize: 13 }}>{s.categories.join(', ')}</span></header>
          {!listings.length ? <p className="muted" style={{ padding: 16 }}>{t('No catalog yet — ask them for a quote directly.', 'अभी catalog नहीं — सीधे भाव मांगें।', 'Abhi catalog nahi — seedhe bhaav maango.')}</p> : (
            <div className="list">{listings.map((l) => (
              <div key={l.id} className="list-row" style={{ cursor: 'default' }}>
                <span className="listing-thumb">{l.photo ? <img src={l.photo} alt="" /> : <ImageOff size={16} />}</span>
                <div className="grow" style={{ minWidth: 0 }}><div className="title ellipsis">{l.name}</div><div className="meta">{t('Min.', 'कम से कम', 'Min.')} {fmtQty(l.moq)} {l.unit}</div></div>
                <span className="num" style={{ fontWeight: 600 }}>{rupees(l.price)}<span className="muted" style={{ fontWeight: 400 }}>/{l.unit}</span></span>
                <Button size="sm" onClick={() => setAsk({ product: l.name, category: l.category, unit: l.unit, qty: l.moq, target_price: l.price, source: 'listing', target_business_id: s.business_id, target_name: s.name })}>{t('Quote', 'भाव', 'Bhaav')}</Button>
              </div>
            ))}</div>
          )}
        </section>
        <section className="panel">
          <header className="panel-head"><h2>{t('What buyers say', 'buyers क्या कहते हैं', 'Buyers kya kehte hain')}</h2></header>
          {!reviews.length ? <p className="muted" style={{ padding: 16 }}>{t('No reviews yet.', 'अभी कोई review नहीं।', 'Abhi koi review nahi.')}</p> : (
            <div className="list">{reviews.map((r, i) => (
              <div key={i} className="list-row" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                <span className="money-warn" aria-label={`${r.rating} / 5`}>{'★'.repeat(r.rating)}<span className="muted">{'★'.repeat(5 - r.rating)}</span></span>
                <div className="grow"><div>{r.review || <span className="muted">{t('(no comment)', '(कोई टिप्पणी नहीं)', '(koi comment nahi)')}</span>}</div><div className="meta">{r.product} · {r.updated_at.slice(0, 10)}</div></div>
              </div>
            ))}</div>
          )}
        </section>
      </div>
      <PostInquiry open={!!ask} onClose={() => setAsk(null)} prefill={ask || undefined} />
    </div>
  );
}

/* ---------- Notifications ---------- */
export function MartNotifications() {
  const { t, err } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const refresh = useMartRefresh();
  usePageTitle(t('Mart notifications', 'मार्ट सूचनाएं', 'Mart notifications'));
  const q = useQuery({ queryKey: ['mart-notifs'], queryFn: () => get<{ notifications: Notification[] }>('/api/mart/notifications'), refetchInterval: 30_000 });
  const rows = q.data?.notifications || [];
  const unread = rows.filter((n) => !n.read).length;
  const words = { today: t('Today', 'आज', 'Aaj'), yesterday: t('Yesterday', 'कल', 'Kal') };
  // Where each notification leads (link_view values set by the server).
  const target = (n: Notification): string => {
    switch (n.link_view) {
      case 'inquiry': return `/mart/requests/${n.link_id}`;
      case 'lead': return `/mart/sell?lead=${n.link_id}`;
      case 'order': return `/mart/orders?open=${n.link_id}`;
      case 'sent': return '/mart/sell?tab=sent';
      case 'chat': return `/mart/chat/${n.link_id}`;
      default: return '/mart';
    }
  };
  const readAll = async () => { try { await post('/api/mart/notifications/read-all'); refresh(); } catch (e) { toast({ text: err(e), tone: 'error' }); } };
  return (
    <div className="page mart-page">
      <PageHeader title={t('Mart notifications', 'मार्ट सूचनाएं', 'Mart notifications')} sub={unread ? t(`${unread} new`, `${unread} नई`, `${unread} nayi`) : t('All caught up', 'सब देख लिया', 'Sab dekh liya')}
        actions={unread > 0 && <Button icon={<CheckCheck size={16} />} onClick={readAll}>{t('Mark all read', 'सब पढ़ लिया', 'Sab padh liya')}</Button>} />
      <section className="panel">
        {q.isLoading ? <SkelRows /> : !rows.length ? <Empty icon={<Bell size={28} />} title={t('No notifications yet', 'अभी कोई सूचना नहीं', 'Abhi koi notification nahi')} body={t('New leads, quotes, counter-offers, messages and order updates show up here.', 'नई leads, quotes, counter-offers, संदेश और ऑर्डर की खबर यहां आएगी।', 'Nayi leads, quotes, counter-offers, messages aur order updates yahan aayenge.')} /> : (
          <div className="list">{rows.map((n) => (
            <button key={n.id} className={`list-row notif ${n.read ? '' : 'is-unread'}`} onClick={() => nav(target(n))}>
              <span className="notif-dot" aria-hidden />
              <div className="grow" style={{ minWidth: 0 }}><div className="title">{n.text}</div><div className="meta">{dateLabel(n.created_at.slice(0, 10), words)} {n.created_at.slice(11, 16)}</div></div>
            </button>
          ))}</div>
        )}
      </section>
    </div>
  );
}

/* ---------- /mart/chat/:quoteId → open the right screen with the chat ---------- */
export function ChatRedirect() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ['mart-chat', Number(id)], queryFn: () => get<{ side: 'buyer' | 'seller'; inquiry: { id: number } }>(`/api/mart/quotes/${id}/messages`) });
  if (q.data) return <Navigate replace to={q.data.side === 'buyer' ? `/mart/requests/${q.data.inquiry.id}?chat=${id}` : `/mart/sell?lead=${q.data.inquiry.id}&chat=1`} />;
  if (q.error) return <Navigate replace to="/mart/notifications" />;
  return <div className="page"><SkelRows /></div>;
}
