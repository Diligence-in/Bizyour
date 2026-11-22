import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { del, get, post, put } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';
import { qty as fmtQty, rupees } from '../lib/format';
import type { Product } from '../lib/types';
import { Button, Drawer, Empty, Field, Input, Select, SkelRows, StockBadge, Tabs, useToast } from '../components/ui';
import { ExportMenu } from '../components/ExportMenu';
import { ImportButton } from '../components/ImportData';
import { PageHeader, useIsMobile, usePageTitle } from '../components/shell/AppShell';

type F = 'all' | 'low' | 'out';
const UNITS = ['piece', 'pack', 'kg', 'gram', 'litre', 'ml', 'box', 'dozen', 'bag', 'bottle', 'metre'];
const GST_RATES = [0, 5, 12, 18, 28];

export default function ProductsPage() {
  const { t } = useI18n();
  const { can, me } = useSession();
  const mobile = useIsMobile();
  const [sp, setSp] = useSearchParams();
  usePageTitle(t('Products', 'सामान', 'Saaman'));
  const [tab, setTab] = useState<F>(sp.get('filter') === 'low' ? 'low' : 'all');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [editing, setEditing] = useState<Product | 'new' | null>(sp.get('new') === '1' ? 'new' : null);
  const p = useQuery({ queryKey: ['products'], queryFn: () => get<{ products: Product[] }>('/api/products') });
  const all = p.data?.products || [];

  useEffect(() => {
    const open = sp.get('open');
    if (open && all.length) { const x = all.find((y) => String(y.id) === open); if (x) setEditing(x); }
  }, [sp, all]);

  const cats = useMemo(() => Array.from(new Set(all.map((x) => x.category).filter(Boolean))).sort(), [all]);
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return all.filter((x) => {
      if (tab === 'low' && x.status === 'ok') return false;
      if (tab === 'out' && x.status !== 'out') return false;
      if (cat && x.category !== cat) return false;
      return !term || x.name.toLowerCase().includes(term) || (x.hsn_code || '').includes(term);
    });
  }, [all, tab, q, cat]);
  const stockValue = all.reduce((s, x) => s + x.stock_qty * x.buy_price, 0);
  const low = all.filter((x) => x.status !== 'ok').length;
  const out = all.filter((x) => x.status === 'out').length;
  const close = () => { setEditing(null); if (sp.get('new') || sp.get('open')) { sp.delete('new'); sp.delete('open'); setSp(sp, { replace: true }); } };

  return (
    <div className="page">
      <PageHeader
        title={t('Products', 'सामान', 'Saaman')}
        sub={p.data ? t(`${all.length} products · stock worth ${rupees(stockValue)} at cost`, `${all.length} सामान · stock की कीमत ${rupees(stockValue)} (खरीद भाव)`, `${all.length} saaman · stock ki keemat ${rupees(stockValue)} (khareed bhaav)`) : ' '}
        actions={<>
          <ImportButton types={['products']} />
          <ExportMenu path="/api/export/products" name="products" />
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>{t('Add product', 'सामान जोड़ें', 'Saaman jodo')}</Button>
        </>}
      />
      {low > 0 && can.mart && (
        <div className="banner banner-warn" style={{ marginBottom: 16 }}>
          <span className="grow">{t(`${low} products are low or out of stock.`, `${low} सामान कम या खत्म हैं।`, `${low} saaman kam ya khatam hain.`)}</span>
          <Link to="/mart" className="btn btn-mart btn-sm"><ShoppingCart size={14} /> {t('Get quotes on Business Mart', 'Business Mart पर भाव लें', 'Business Mart pe bhaav lo')}</Link>
        </div>
      )}
      <section className="panel">
        <div style={{ padding: '0 16px' }}>
          <Tabs<F> label={t('Filter', 'छांटें', 'Filter')} value={tab} onChange={setTab} tabs={[
            { value: 'all', label: t('All', 'सभी', 'Sab'), count: all.length },
            { value: 'low', label: t('Low or out', 'कम या खत्म', 'Kam ya khatam'), count: low },
            { value: 'out', label: t('Out of stock', 'खत्म', 'Khatam'), count: out }
          ]} />
        </div>
        <div className="toolbar">
          <div className="input-wrap"><Search size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Product name or HSN', 'सामान का नाम या HSN', 'Saaman ka naam ya HSN')} /></div>
          {cats.length > 1 && <Select value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: 180 }} aria-label={t('Category', 'श्रेणी', 'Category')}><option value="">{t('All categories', 'सभी श्रेणी', 'Sab category')}</option>{cats.map((c) => <option key={c}>{c}</option>)}</Select>}
        </div>
        {p.isLoading ? <SkelRows rows={8} /> : !rows.length ? (
          <Empty icon={<Package size={28} />} title={all.length ? t('No products match', 'कोई सामान नहीं मिला', 'Koi saaman nahi mila') : t('Add your first product', 'पहला सामान जोड़ें', 'Pehla saaman jodo')}
            body={all.length ? undefined : t('Products you add here appear in billing, with stock going down on every sale.', 'यहां जोड़ा सामान बिलिंग में दिखेगा और हर बिक्री पर stock घटेगा।', 'Yahan joda saaman billing me dikhega aur har bikri pe stock ghatega.')}
            action={!all.length && <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>{t('Add product', 'सामान जोड़ें', 'Saaman jodo')}</Button>} />
        ) : mobile ? (
          <div className="list">{rows.map((x) => (
            <button key={x.id} className="list-row" onClick={() => setEditing(x)}>
              <div className="grow" style={{ minWidth: 0 }}><div className="title ellipsis">{x.name}</div><div className="meta">{rupees(x.sell_price)} · {x.category || '—'}</div></div>
              <div style={{ textAlign: 'right' }}><div className={`num ${x.status === 'out' ? 'money-owed' : x.status === 'low' ? 'money-warn' : ''}`} style={{ fontWeight: 500 }}>{fmtQty(x.stock_qty)} {x.unit}</div></div>
            </button>
          ))}</div>
        ) : (
          <div className="table-wrap"><table className="table">
            <thead><tr>
              <th>{t('Product', 'सामान', 'Saaman')}</th><th className="r">{t('In stock', 'स्टॉक', 'Stock')}</th>
              <th className="r">{t('Buy price', 'खरीद भाव', 'Khareed bhaav')}</th><th className="r">{t('Sell price', 'बिक्री भाव', 'Bikri bhaav')}</th>
              <th className="r">{t('Margin', 'मार्जिन', 'Margin')}</th>{me?.business?.gst_enabled && <th className="r">GST</th>}<th>{t('Status', 'स्थिति', 'Status')}</th>
            </tr></thead>
            <tbody>{rows.map((x) => {
              const margin = x.sell_price > 0 ? ((x.sell_price - x.buy_price) / x.sell_price) * 100 : 0;
              return (
                <tr key={x.id} className="clickable" tabIndex={0} onClick={() => setEditing(x)} onKeyDown={(e) => e.key === 'Enter' && setEditing(x)}>
                  <td><span className="primary">{x.name}</span><span className="sub">{[x.category, x.hsn_code && `HSN ${x.hsn_code}`].filter(Boolean).join(' · ') || '—'}</span></td>
                  <td className="r num">{fmtQty(x.stock_qty)} <span className="muted">{x.unit}</span></td>
                  <td className="r num">{rupees(x.buy_price)}</td>
                  <td className="r num">{rupees(x.sell_price)}</td>
                  <td className={`r num ${margin < 0 ? 'money-owed' : 'muted'}`}>{margin.toFixed(0)}%</td>
                  {me?.business?.gst_enabled && <td className="r num muted">{x.gst_rate}%</td>}
                  <td><StockBadge status={x.status} /></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </section>
      <ProductDrawer product={editing} onClose={close} categories={cats} />
    </div>
  );
}

function ProductDrawer({ product, onClose, categories }: { product: Product | 'new' | null; onClose: () => void; categories: string[] }) {
  const { t, err } = useI18n();
  const { me } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const isNew = product === 'new';
  const p = product && product !== 'new' ? product : null;
  const blank = { name: '', category: '', unit: 'piece', buy_price: '', sell_price: '', gst_rate: '5', hsn_code: '', stock_qty: '', low_stock_limit: '5' };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  useEffect(() => {
    if (!product) return;
    setError(''); setConfirmDel(false);
    setF(p ? { name: p.name, category: p.category, unit: p.unit, buy_price: String(p.buy_price), sell_price: String(p.sell_price), gst_rate: String(p.gst_rate), hsn_code: p.hsn_code || '', stock_qty: String(p.stock_qty), low_stock_limit: String(p.low_stock_limit) } : blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);
  const num = (v: string) => (v === '' ? undefined : Number(v));
  const margin = Number(f.sell_price) > 0 ? ((Number(f.sell_price) - Number(f.buy_price || 0)) / Number(f.sell_price)) * 100 : null;

  const save = async () => {
    if (!f.name.trim()) { setError(t('Write the product name.', 'सामान का नाम लिखें।', 'Saaman ka naam likho.')); return; }
    setBusy(true); setError('');
    const body: Record<string, unknown> = { name: f.name.trim(), category: f.category.trim(), unit: f.unit, buy_price: num(f.buy_price) ?? 0, sell_price: num(f.sell_price) ?? 0, gst_rate: num(f.gst_rate) ?? 0, hsn_code: f.hsn_code.trim(), low_stock_limit: num(f.low_stock_limit) ?? 0 };
    if (isNew) body.stock_qty = num(f.stock_qty) ?? 0; // stock changes later only through purchases and bills
    try {
      if (isNew) await post('/api/products', body); else await put(`/api/products/${p!.id}`, body);
      ['products', 'billing-products', 'alerts'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast({ text: isNew ? t('Product added', 'सामान जुड़ा', 'Saaman juda') : t('Product saved', 'सामान सेव हुआ', 'Saaman save hua') });
      onClose();
    } catch (e) { setError(err(e)); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await del(`/api/products/${p!.id}`); ['products', 'billing-products'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast({ text: t('Product deleted', 'सामान हटाया', 'Saaman hataya') }); onClose(); }
    catch (e) { setError(err(e)); setConfirmDel(false); } finally { setBusy(false); }
  };
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Drawer open={!!product} onClose={onClose} title={isNew ? t('Add product', 'सामान जोड़ें', 'Saaman jodo') : p?.name || ''}
      footer={<>
        {p && (confirmDel
          ? <Button variant="danger" loading={busy} onClick={remove} style={{ marginRight: 'auto' }}>{t('Yes, delete', 'हां, हटाएं', 'Haan, hatao')}</Button>
          : <Button variant="ghost" icon={<Trash2 size={16} />} onClick={() => setConfirmDel(true)} style={{ marginRight: 'auto' }}>{t('Delete', 'हटाएं', 'Hatao')}</Button>)}
        <Button onClick={onClose}>{t('Close', 'बंद', 'Band')}</Button>
        <Button variant="primary" loading={busy} onClick={save}>{isNew ? t('Add product', 'सामान जोड़ें', 'Saaman jodo') : t('Save changes', 'बदलाव सेव करें', 'Badlav save karo')}</Button>
      </>}>
      <form className="stack" style={{ gap: 16 }} onSubmit={(e) => { e.preventDefault(); save(); }}>
        {p && (
          <div className="mini-stats">
            <div><span className="strip-label">{t('In stock', 'स्टॉक', 'Stock')}</span><span className="num" style={{ fontSize: 20, fontWeight: 600 }}>{fmtQty(p.stock_qty)} <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>{p.unit}</span></span></div>
            <div><span className="strip-label">{t('Stock value', 'स्टॉक कीमत', 'Stock keemat')}</span><span className="num" style={{ fontSize: 20, fontWeight: 600 }}>{rupees(p.stock_qty * p.buy_price)}</span></div>
            <div><span className="strip-label">{t('Status', 'स्थिति', 'Status')}</span><StockBadge status={p.status} /></div>
          </div>
        )}
        <Field label={t('Name', 'नाम', 'Naam')} error={error}>{(id) => <Input id={id} value={f.name} onChange={set('name')} autoFocus={isNew} />}</Field>
        <div className="form-2">
          <Field label={t('Category', 'श्रेणी', 'Category')}>{(id) => <><Input id={id} list="cat-list" value={f.category} onChange={set('category')} /><datalist id="cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist></>}</Field>
          <Field label={t('Unit', 'इकाई', 'Unit')}>{(id) => <Select id={id} value={f.unit} onChange={set('unit')}>{Array.from(new Set([...UNITS, f.unit])).map((u) => <option key={u}>{u}</option>)}</Select>}</Field>
        </div>
        <div className="form-2">
          <Field label={t('Buy price ₹', 'खरीद भाव ₹', 'Khareed bhaav ₹')}>{(id) => <Input id={id} numeric inputMode="decimal" value={f.buy_price} onChange={set('buy_price')} />}</Field>
          <Field label={t('Sell price ₹', 'बिक्री भाव ₹', 'Bikri bhaav ₹')} hint={margin !== null ? t(`${margin.toFixed(0)}% margin`, `${margin.toFixed(0)}% मार्जिन`, `${margin.toFixed(0)}% margin`) : (me?.business?.gst_enabled ? t('Including GST', 'GST सहित', 'GST sahit') : undefined)}>{(id) => <Input id={id} numeric inputMode="decimal" value={f.sell_price} onChange={set('sell_price')} />}</Field>
        </div>
        {me?.business?.gst_enabled && (
          <div className="form-2">
            <Field label="GST %">{(id) => <Select id={id} value={f.gst_rate} onChange={set('gst_rate')}>{Array.from(new Set([...GST_RATES, Number(f.gst_rate)])).map((r) => <option key={r} value={r}>{r}%</option>)}</Select>}</Field>
            <Field label="HSN" hint={t('Needed for e-way bills', 'E-way bill के लिए', 'E-way bill ke liye')}>{(id) => <Input id={id} value={f.hsn_code} onChange={set('hsn_code')} inputMode="numeric" />}</Field>
          </div>
        )}
        <div className="form-2">
          {isNew
            ? <Field label={t('Opening stock', 'शुरुआती स्टॉक', 'Shuruaati stock')} hint={t('After this, stock changes only through purchases and bills.', 'इसके बाद stock सिर्फ़ खरीद और बिल से बदलेगा।', 'Iske baad stock sirf khareed aur bill se badlega.')}>{(id) => <Input id={id} numeric inputMode="decimal" value={f.stock_qty} onChange={set('stock_qty')} />}</Field>
            : <Field label={t('Stock', 'स्टॉक', 'Stock')} hint={t('Changes through purchases and bills.', 'खरीद और बिल से बदलता है।', 'Khareed aur bill se badalta hai.')}>{(id) => <Input id={id} value={`${fmtQty(Number(f.stock_qty))} ${f.unit}`} disabled />}</Field>}
          <Field label={t('Warn me below', 'इससे कम हो तो बताएं', 'Isse kam ho to batao')}>{(id) => <Input id={id} numeric inputMode="decimal" value={f.low_stock_limit} onChange={set('low_stock_limit')} />}</Field>
        </div>
        <button type="submit" hidden />
      </form>
    </Drawer>
  );
}
