import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, PackageSearch, Plus, Search, ShoppingCart, Star, Truck } from 'lucide-react';
import { get } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useSession } from '../../lib/session';
import { dateLabel, qty as fmtQty, rupees } from '../../lib/format';
import { Button, Empty, Money, Skel } from '../../components/ui';
import { PageHeader, usePageTitle } from '../../components/shell/AppShell';
import { useMartSummary, type Inquiry, type Order, type RestockItem, type SellerCard } from './martApi';
import { InquiryBadge, OrderSteps, PostInquiry, TrustLine, type InquiryPrefill } from './martUi';

// Mart home for buying. The first thing on it is what only BizYour can do:
// "you're running low on these — get quotes now", read straight from stock.

export default function MartHome() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  usePageTitle(t('Business Mart', 'बिज़नेस मार्ट', 'Business Mart'));
  const { me } = useSession();
  // Two-stage workflow: buying works on the account alone; the restock
  // panel reads the shop's stock, so it waits for the workspace setup.
  const wsActive = !!me?.business?.workspace_active;
  const sum = useMartSummary(wsActive);
  const restock = useQuery({ queryKey: ['mart-restock'], queryFn: () => get<{ items: RestockItem[] }>('/api/mart/restock'), enabled: wsActive });
  const inq = useQuery({ queryKey: ['mart-inquiries'], queryFn: () => get<{ inquiries: Inquiry[] }>('/api/mart/inquiries') });
  const orders = useQuery({ queryKey: ['mart-orders', 'buyer'], queryFn: () => get<{ orders: Order[] }>('/api/mart/orders?role=buyer') });
  const favs = useQuery({ queryKey: ['mart-favs'], queryFn: () => get<{ favourites: SellerCard[] }>('/api/mart/favourites') });
  const [post, setPost] = useState<InquiryPrefill | null>(null);

  // Deep links: /mart?new=1 or /mart?restock=<product_id> (from Home / Products).
  useEffect(() => {
    if (sp.get('new') === '1') { setPost({}); sp.delete('new'); setSp(sp, { replace: true }); }
    const rid = sp.get('restock');
    if (rid && restock.data) {
      const it = restock.data.items.find((x) => String(x.product_id) === rid);
      if (it) setPost(fromRestock(it));
      sp.delete('restock'); setSp(sp, { replace: true });
    }
  }, [sp, setSp, restock.data]);

  const s = sum.data?.buying;
  const words = { today: t('Today', 'आज', 'Aaj'), yesterday: t('Yesterday', 'कल', 'Kal') };
  const groups = groupInquiries(inq.data?.inquiries || []);
  const active = (orders.data?.orders || []).filter((o) => ['placed', 'confirmed', 'dispatched'].includes(o.status));

  return (
    <div className="page mart-page">
      <PageHeader
        title={t('Business Mart', 'बिज़नेस मार्ट', 'Business Mart')}
        sub={t('Ask wholesalers for prices, compare quotes, and stock arrives straight into your purchases.', 'थोक वालों से भाव मांगें, quotes compare करें — माल सीधे खरीद में जुड़ता है।', 'Wholesalers se bhaav maango, quotes compare karo — maal seedha khareed me judta hai.')}
        actions={<>
          <Link to="/mart/browse" className="btn btn-secondary"><Search size={16} /> {t('Browse', 'देखें', 'Dekho')}</Link>
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setPost({})}>{t('Ask for quotes', 'भाव मांगें', 'Bhaav maango')}</Button>
        </>}
      />

      {!wsActive && (
        <div className="banner banner-info" role="status" style={{ marginBottom: 16 }}>
          <span className="grow">{t('Buying is open. To sell on the Mart, set up your shop first — two minutes.', 'खरीद खुली है। Mart पर बेचने के लिए पहले दुकान setup करें — दो मिनट।', 'Khareed khuli hai. Mart pe bechne ke liye pehle dukaan setup karo — do minute.')}</span>
          <Link to="/setup" className="btn btn-primary btn-sm">{t('Set up my shop', 'दुकान setup करें', 'Dukaan setup karo')}</Link>
        </div>
      )}

      <section className="ledger-strip">
        <Cell label={t('Open requests', 'खुली requests', 'Khuli requests')} value={sum.isError ? '–' : s?.open_inquiries} loading={sum.isLoading} />
        <Cell label={t('Quotes to review', 'quotes देखने हैं', 'Quotes dekhne hain')} value={sum.isError ? '–' : s?.new_quotes} loading={sum.isLoading} tone={s?.new_quotes ? 'mart' : undefined} />
        <Cell label={t('Orders on the way', 'रास्ते में ऑर्डर', 'Raaste me order')} value={sum.isError ? '–' : s?.active_orders} loading={sum.isLoading} to="/mart/orders" />
        <Cell label={t('Bought on Mart', 'Mart से खरीदा', 'Mart se khareeda')} value={sum.isError ? '–' : s ? rupees(s.spend) : undefined} loading={sum.isLoading} to="/mart/orders" />
      </section>

      <div className="home-grid">
        <div className="stack" style={{ gap: 16 }}>
          <section className="panel">
            <header className="panel-head">
              <h2>{t('Running low — restock', 'कम है — मंगाएं', 'Kam hai — mangao')}</h2>
              <span className="muted" style={{ fontSize: 13 }}>{t('From your stock', 'आपके stock से', 'Aapke stock se')}</span>
            </header>
            {!wsActive ? (
              <p className="muted" style={{ padding: 16 }}>{t('This list comes from your shop stock. ', 'यह list आपके shop stock से आती है। ', 'Ye list aapke shop stock se aati hai. ')}<Link to="/setup">{t('Set up your shop', 'दुकान setup करें', 'Dukaan setup karo')}</Link>{t(' to see it.', ' — तब दिखेगी।', ' — tab dikhegi.')}</p>
            ) : restock.isLoading ? <div className="panel-body"><Skel h={80} /></div> : !(restock.data?.items.length) ? (
              <p className="muted" style={{ padding: 16 }}>{t('Nothing is below its low-stock limit. 👍', 'कोई सामान कम नहीं है। 👍', 'Koi saaman kam nahi hai. 👍')}</p>
            ) : (
              <div className="list">
                {restock.data.items.map((it) => (
                  <div key={it.product_id} className="list-row restock-row" style={{ cursor: 'default' }}>
                    <span className="att-icon att-warn"><PackageSearch size={16} /></span>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="title ellipsis">{it.name}</div>
                      <div className="meta">
                        <span className={it.stock_qty <= 0 ? 'money-owed' : 'money-warn'}>{fmtQty(it.stock_qty)} {it.unit} {t('left', 'बचा', 'bacha')}</span>
                        {it.last_price ? ` · ${t('last bought', 'पिछली खरीद', 'pichhli khareed')} ${rupees(it.last_price)}${it.last_supplier ? ` ${t('from', 'से', 'se')} ${it.last_supplier}` : ''}` : ''}
                      </div>
                    </div>
                    {it.open_inquiry_id
                      ? <Link to={`/mart/requests/${it.open_inquiry_id}`} className="btn btn-secondary btn-sm">{t('View request', 'request देखें', 'Request dekho')}</Link>
                      : <Button size="sm" variant="mart" icon={<ShoppingCart size={14} />} onClick={() => setPost(fromRestock(it))}>{t(`Get quotes for ${fmtQty(it.suggested_qty)}`, `${fmtQty(it.suggested_qty)} के भाव लें`, `${fmtQty(it.suggested_qty)} ke bhaav lo`)}</Button>}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <header className="panel-head"><h2>{t('Your requests', 'आपकी requests', 'Aapki requests')}</h2></header>
            {inq.isLoading ? <div className="panel-body"><Skel h={120} /></div> : !groups.length ? (
              <Empty icon={<ShoppingCart size={28} />} title={t('No requests yet', 'अभी कोई request नहीं', 'Abhi koi request nahi')}
                body={t('Tell wholesalers what you need. Matching sellers send quotes; you pick the best.', 'थोक वालों को बताएं क्या चाहिए। sellers quote भेजेंगे; आप सबसे अच्छा चुनें।', 'Wholesalers ko batao kya chahiye. Sellers quote bhejenge; aap sabse achha chuno.')}
                action={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setPost({})}>{t('Ask for quotes', 'भाव मांगें', 'Bhaav maango')}</Button>} />
            ) : (
              <div className="list">
                {groups.map((g) => (
                  <Link key={g.id} to={`/mart/requests/${g.id}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="title ellipsis">{fmtQty(g.qty)} {g.unit} {g.product}</div>
                      <div className="meta">
                        {dateLabel(g.created_at.slice(0, 10), words)} · {g.group ? t(`sent to ${g.group} sellers`, `${g.group} sellers को भेजी`, `${g.group} sellers ko bheji`) : t(`${g.notified} told · seen by ${g.views || 0}`, `${g.notified} को खबर · ${g.views || 0} ने देखा`, `${g.notified} ko khabar · ${g.views || 0} ne dekha`)}
                        {g.best != null ? ` · ${t('best', 'सबसे कम', 'sabse kam')} ${rupees(g.best)}/${g.unit}` : ''}
                      </div>
                    </div>
                    <InquiryBadge status={g.status} newQuotes={g.newQuotes} />
                    <ChevronRight size={16} className="muted" />
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <section className="panel">
            <header className="panel-head"><h2>{t('Orders on the way', 'रास्ते में ऑर्डर', 'Raaste me order')}</h2><Link to="/mart/orders" className="btn btn-ghost btn-sm">{t('All orders', 'सभी ऑर्डर', 'Sab order')}</Link></header>
            {!active.length ? <p className="muted" style={{ padding: 16 }}>{t('No open orders.', 'कोई खुला ऑर्डर नहीं।', 'Koi khula order nahi.')}</p> : (
              <div className="list">{active.map((o) => (
                <Link key={o.id} to={`/mart/orders?open=${o.id}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit', flexWrap: 'wrap' }}>
                  <Truck size={16} className="muted" />
                  <div className="grow" style={{ minWidth: 0 }}><div className="title ellipsis">{o.product}</div><div className="meta">{o.order_no} · {o.other_party.name}</div></div>
                  <Money value={o.total} />
                  <div style={{ flexBasis: '100%' }}><OrderSteps status={o.status} /></div>
                </Link>
              ))}</div>
            )}
          </section>
          <section className="panel">
            <header className="panel-head"><h2>{t('My wholesalers', 'मेरे थोक वाले', 'Mere wholesaler')}</h2><Link to="/mart/browse?tab=sellers" className="btn btn-ghost btn-sm">{t('Find more', 'और खोजें', 'Aur khojo')}</Link></header>
            {!(favs.data?.favourites.length) ? <p className="muted" style={{ padding: 16 }}>{t('Tap ☆ on a seller to keep them here for quick requests.', 'seller पर ☆ दबाएं — वो यहां रहेंगे।', 'Seller pe ☆ dabao — woh yahan rahenge.')}</p> : (
              <div className="list">{favs.data.favourites.map((s) => (
                <button key={s.business_id} className="list-row" onClick={() => nav(`/mart/sellers/${s.business_id}`)}>
                  <Star size={15} className="money-warn" fill="currentColor" />
                  <div className="grow" style={{ minWidth: 0 }}><div className="title ellipsis">{s.name}</div><div className="meta"><TrustLine s={s} compact /> · {s.city}</div></div>
                  <ChevronRight size={16} className="muted" />
                </button>
              ))}</div>
            )}
          </section>
        </div>
      </div>
      <PostInquiry open={!!post} onClose={() => setPost(null)} prefill={post || undefined} />
    </div>
  );
}

function fromRestock(it: RestockItem): InquiryPrefill {
  return { product: it.name, category: it.category, qty: it.suggested_qty, unit: it.unit, target_price: it.last_price, product_id: it.product_id, source: 'stock' };
}

/** Bulk requests create one inquiry per seller sharing a group_id — show them as one row. */
function groupInquiries(list: Inquiry[]) {
  const out: (Inquiry & { group?: number; best: number | null; newQuotes: number })[] = [];
  const seen = new Map<string, number>();
  for (const i of list) {
    if (i.group_id && seen.has(i.group_id)) {
      const g = out[seen.get(i.group_id)!];
      g.group = (g.group || 1) + 1;
      g.newQuotes += i.new_quotes || 0;
      if (i.best_price != null) g.best = g.best == null ? i.best_price : Math.min(g.best, i.best_price);
      if (i.status === 'ordered') g.status = 'ordered';
      continue;
    }
    if (i.group_id) seen.set(i.group_id, out.length);
    out.push({ ...i, group: i.group_id ? 1 : undefined, best: i.best_price ?? null, newQuotes: i.new_quotes || 0 });
  }
  return out;
}

function Cell({ label, value, loading, tone, to }: { label: string; value?: number | string; loading?: boolean; tone?: 'mart'; to?: string }) {
  const inner = (
    <>
      <span className="strip-label">{label}</span>
      <span className={`strip-value num ${tone === 'mart' ? 'money-mart' : ''}`}>{loading ? <Skel w={60} h={30} /> : value ?? 0}</span>
    </>
  );
  return to ? <Link className="strip-cell" to={to}>{inner}</Link> : <div className="strip-cell" style={{ cursor: 'default' }}>{inner}</div>;
}
