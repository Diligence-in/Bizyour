import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Download, ImagePlus, Plus, Printer, Trash2, Upload } from 'lucide-react';
import { del, download, get, post, put, setToken } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';
import { rupees } from '../lib/format';
import type { Business, Subscription } from '../lib/types';
import { resizeImage } from './mart/martApi';
import { INDIAN_STATES, SHOP_CATEGORIES } from './Setup';
import { Badge, Button, Drawer, Empty, Field, Input, Modal, Panel, Segmented, Select, SkelRows, Tabs, useToast } from '../components/ui';
import { ExportMenu } from '../components/ExportMenu';
import { ImportForm } from '../components/ImportData';
import { ShopImagePick } from '../components/ShopImagePick';
import { PageHeader, usePageTitle } from '../components/shell/AppShell';

type Tab = 'shop' | 'staff' | 'plan' | 'data';

export default function SettingsPage() {
  const { t } = useI18n();
  const { can } = useSession();
  const [sp, setSp] = useSearchParams();
  usePageTitle(t('Settings', 'सेटिंग', 'Settings'));
  const want = (sp.get('tab') as Tab) || 'shop';
  const tab: Tab = can.owner ? want : 'shop';
  const set = (v: Tab) => { sp.set('tab', v); setSp(sp, { replace: true }); };
  return (
    <div className="page">
      <PageHeader title={t('Settings', 'सेटिंग', 'Settings')} sub={t('Your shop details, people, plan and data.', 'दुकान की जानकारी, लोग, प्लान और डेटा।', 'Dukaan ki jaankari, log, plan aur data.')} />
      {can.owner && <Tabs label="settings" value={tab} onChange={set} tabs={[
        { value: 'shop', label: t('Shop', 'दुकान', 'Dukaan') }, { value: 'staff', label: t('Staff', 'स्टाफ़', 'Staff') },
        { value: 'plan', label: t('Plan', 'प्लान', 'Plan') }, { value: 'data', label: t('Data', 'डेटा', 'Data') }]} />}
      <div style={{ marginTop: 16 }}>
        {tab === 'shop' && <ShopTab />}
        {tab === 'staff' && <StaffTab />}
        {tab === 'plan' && <PlanTab />}
        {tab === 'data' && <DataTab />}
      </div>
    </div>
  );
}

/* ---------- shop ---------- */
function ShopTab() {
  const { t, err } = useI18n();
  const { me, setBusiness, can } = useSession();
  const toast = useToast();
  const b = me!.business!;
  const [f, setF] = useState({ name: b.name, owner_name: b.owner_name, phone: b.phone, city: b.city, category: b.category || 'kirana', address: b.address || '', landmark: b.landmark || '', pincode: b.pincode || '', state: b.state || '', gst_enabled: b.gst_enabled, gstin: b.gstin || '', upi_id: b.upi_id || '', upi_payee_name: b.upi_payee_name || '', language: b.language });
  const [qr, setQr] = useState<string | null>(b.payment_qr);
  const [logo, setLogo] = useState<string | null>(b.logo);
  const [shopPhoto, setShopPhoto] = useState<string | null>(b.shop_photo);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const patch = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const dis = !can.owner;
  const pickQr = async (file?: File) => { if (!file) return; try { setQr(await resizeImage(file)); } catch { setError(t('That file is not an image.', 'यह फ़ाइल तस्वीर नहीं है।', 'Yeh file tasveer nahi hai.')); } };
  const save = async () => {
    if (!f.name.trim()) { setError(t('Shop name is needed.', 'दुकान का नाम चाहिए।', 'Dukaan ka naam chahiye.')); return; }
    setBusy(true); setError('');
    try {
      const r = await put<{ business: Business }>('/api/business', { ...f, payment_qr: qr || '', logo: logo || '', shop_photo: shopPhoto || '' });
      setBusiness(r.business); toast({ text: t('Settings saved', 'सेटिंग सेव हुई', 'Settings save hui') });
    } catch (e) { setError(err(e)); } finally { setBusy(false); }
  };
  return (
    <div className="stack" style={{ gap: 16, maxWidth: 760 }}>
      {dis && <div className="banner banner-info">{t('Only the shop owner can change these.', 'इन्हें सिर्फ़ दुकान का मालिक बदल सकता है।', 'Inhe sirf dukaan ka malik badal sakta hai.')}</div>}
      <Panel title={t('Shop details', 'दुकान की जानकारी', 'Dukaan ki jaankari')}>
        <div className="stack" style={{ gap: 16 }}>
          <div className="form-2">
            <Field label={t('Shop name', 'दुकान का नाम', 'Dukaan ka naam')}>{(id) => <Input id={id} disabled={dis} value={f.name} onChange={(e) => patch({ name: e.target.value })} />}</Field>
            <Field label={t('Owner name', 'मालिक का नाम', 'Malik ka naam')}>{(id) => <Input id={id} disabled={dis} value={f.owner_name} onChange={(e) => patch({ owner_name: e.target.value })} />}</Field>
            <Field label={t('Shop phone', 'दुकान का फ़ोन', 'Dukaan ka phone')} hint={t('Day-end and report summaries go to this WhatsApp number.', 'दिन का हिसाब इसी WhatsApp नंबर पर जाएगा।', 'Din ka hisab isi WhatsApp number par jayega.')}>{(id) => <Input id={id} disabled={dis} inputMode="tel" value={f.phone} onChange={(e) => patch({ phone: e.target.value })} />}</Field>
            <Field label={t('Shop category', 'दुकान की category', 'Dukaan ki category')}>{(id) => (
              <Select id={id} disabled={dis} value={f.category} onChange={(e) => patch({ category: e.target.value })}>
                {SHOP_CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </Select>
            )}</Field>
            <Field label={t('City', 'शहर', 'Shehar')}>{(id) => <Input id={id} disabled={dis} value={f.city} onChange={(e) => patch({ city: e.target.value })} />}</Field>
            <Field label={t('State', 'राज्य', 'State')}>{(id) => (
              <Select id={id} disabled={dis} value={f.state} onChange={(e) => patch({ state: e.target.value })}>
                <option value="">—</option>
                {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            )}</Field>
          </div>
          <Field label={t('Shop address', 'दुकान का पता', 'Dukaan ka address')}>{(id) => <Input id={id} disabled={dis} value={f.address} onChange={(e) => patch({ address: e.target.value })} />}</Field>
          <Field label={t('Landmark', 'आस-पास की पहचान', 'Landmark')}>{(id) => <Input id={id} disabled={dis} value={f.landmark} onChange={(e) => patch({ landmark: e.target.value })} />}</Field>
          <Field label={t('PIN code', 'PIN code', 'PIN code')}>{(id) => <Input id={id} disabled={dis} inputMode="numeric" maxLength={6} value={f.pincode} onChange={(e) => patch({ pincode: e.target.value })} />}</Field>
          <Field label={t('Language for messages to customers', 'ग्राहकों को भेजे संदेश की भाषा', 'Customers ko bheje message ki bhasha')}>{() => <Segmented label="language" value={f.language} onChange={(v) => patch({ language: v })} options={[{ value: 'en', label: 'English' }, { value: 'hi', label: 'हिंदी' }, { value: 'hg', label: 'Hinglish' }]} />}</Field>
        </div>
      </Panel>
      <Panel title={t('Logo and shop photo', 'लोगो और दुकान की फ़ोटो', 'Logo aur dukaan ki photo')}>
        <div className="sip-row">
          <ShopImagePick kind="logo" value={logo} onChange={setLogo} onError={setError} shopName={f.name} disabled={dis} />
          <ShopImagePick kind="photo" value={shopPhoto} onChange={setShopPhoto} onError={setError} disabled={dis} />
        </div>
      </Panel>
      <Panel title="GST">
        <div className="stack" style={{ gap: 16 }}>
          <label className="row" style={{ gap: 10, cursor: dis ? 'default' : 'pointer' }}>
            <input type="checkbox" disabled={dis} checked={f.gst_enabled} onChange={(e) => patch({ gst_enabled: e.target.checked })} style={{ width: 18, height: 18 }} />
            <span><b>{t('My shop charges GST', 'मेरी दुकान GST लेती है', 'Meri dukaan GST leti hai')}</b><span className="muted" style={{ display: 'block' }}>{t('Bills show GST split and the GST reports turn on.', 'बिल में GST अलग दिखेगा और GST रिपोर्ट चालू होंगी।', 'Bill me GST alag dikhega aur GST report chalu hongi.')}</span></span>
          </label>
          {f.gst_enabled && <Field label="GSTIN">{(id) => <Input id={id} disabled={dis} value={f.gstin} maxLength={15} onChange={(e) => patch({ gstin: e.target.value.toUpperCase() })} placeholder="22AAAAA0000A1Z5" />}</Field>}
        </div>
      </Panel>
      <Panel title={t('Getting paid by UPI', 'UPI से पैसे पाना', 'UPI se paise paana')}>
        <div className="stack" style={{ gap: 16 }}>
          <div className="form-2">
            <Field label="UPI ID" hint={t('Shown as a pay link on bills.', 'बिल पर पेमेंट लिंक के रूप में दिखेगा।', 'Bill par payment link ke roop me dikhega.')}>{(id) => <Input id={id} disabled={dis} value={f.upi_id} onChange={(e) => patch({ upi_id: e.target.value.trim() })} placeholder="shopname@upi" />}</Field>
            <Field label={t('Name on UPI', 'UPI पर नाम', 'UPI par naam')}>{(id) => <Input id={id} disabled={dis} value={f.upi_payee_name} onChange={(e) => patch({ upi_payee_name: e.target.value })} />}</Field>
          </div>
          <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
            {qr ? <img className="qr-prev" src={qr} alt={t('Your UPI QR', 'आपका UPI QR', 'Aapka UPI QR')} /> : <div className="qr-prev" style={{ display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}><ImagePlus size={28} /></div>}
            <div className="stack" style={{ gap: 8 }}>
              <span className="muted" style={{ maxWidth: 340 }}>{t('Upload your own UPI QR to print on bills.', 'अपना UPI QR डालें, बिल पर छपेगा।', 'Apna UPI QR daalo, bill par chhapega.')}</span>
              {!dis && <div className="row" style={{ gap: 8 }}>
                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}><Upload size={14} /> {t('Choose image', 'तस्वीर चुनें', 'Tasveer chuno')}<input type="file" accept="image/*" hidden onChange={(e) => pickQr(e.target.files?.[0])} /></label>
                {qr && <Button size="sm" variant="ghost" onClick={() => setQr(null)}>{t('Remove', 'हटाएं', 'Hatao')}</Button>}
              </div>}
            </div>
          </div>
        </div>
      </Panel>
      {error && <div className="banner banner-owed" role="alert">{error}</div>}
      {!dis && <div><Button variant="primary" loading={busy} onClick={save}>{t('Save settings', 'सेटिंग सेव करें', 'Settings save karo')}</Button></div>}
    </div>
  );
}

/* ---------- staff ---------- */
interface StaffRow { id: number; name: string; email: string; role: string; access: string }
function StaffTab() {
  const { t, err } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['staff'], queryFn: () => get<{ staff: StaffRow[] }>('/api/staff') });
  const [adding, setAdding] = useState(false);
  const [gone, setGone] = useState<StaffRow | null>(null);
  const label = (a: string) => a === 'billing' ? t('Billing only', 'सिर्फ़ बिलिंग', 'Sirf billing') : a === 'stock' ? t('Stock only', 'सिर्फ़ stock', 'Sirf stock') : t('Everything except money', 'पैसे के हिसाब को छोड़कर सब', 'Paise ke hisab ko chhodkar sab');
  const remove = async () => { if (!gone) return; try { await del(`/api/staff/${gone.id}`); qc.invalidateQueries({ queryKey: ['staff'] }); toast({ text: t('Staff removed', 'स्टाफ़ हटाया', 'Staff hataya') }); setGone(null); } catch (e) { toast({ text: err(e), tone: 'error' }); } };
  return (
    <div style={{ maxWidth: 760 }}>
      <Panel title={t('People who can log in', 'जो लॉगिन कर सकते हैं', 'Jo login kar sakte hain')} bodyClass="" action={<Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setAdding(true)}>{t('Add staff', 'स्टाफ़ जोड़ें', 'Staff jodo')}</Button>}>
        {q.isLoading ? <div className="panel-body"><SkelRows rows={3} /></div> : (
          <div className="list">{(q.data?.staff || []).map((s) => (
            <div key={s.id} className="list-row">
              <div className="grow" style={{ minWidth: 0 }}><div className="title ellipsis">{s.name}</div><div className="meta ellipsis">{s.email}</div></div>
              {s.role === 'owner' ? <Badge tone="accent">{t('Owner', 'मालिक', 'Malik')}</Badge> : <><Badge plain>{label(s.access)}</Badge><button className="icon-btn icon-btn-sm" aria-label={t('Remove', 'हटाएं', 'Hatao')} onClick={() => setGone(s)}><Trash2 size={15} /></button></>}
            </div>))}</div>
        )}
      </Panel>
      <AddStaff open={adding} onClose={() => setAdding(false)} />
      <Modal open={!!gone} onClose={() => setGone(null)} label={t('Remove staff', 'स्टाफ़ हटाएं', 'Staff hatao')}>
        <div className="stack" style={{ gap: 12, padding: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{t('Remove', 'हटाएं', 'Hatao')} {gone?.name}?</h2>
          <p className="muted" style={{ margin: 0 }}>{t('They are logged out right away and cannot sign in again.', 'वे तुरंत लॉग आउट हो जाएँगे और दोबारा लॉगिन नहीं कर पाएँगे।', 'Woh turant logout ho jayenge aur dobara login nahi kar payenge.')}</p>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}><Button onClick={() => setGone(null)}>{t('Keep', 'रहने दें', 'Rehne do')}</Button><Button variant="danger" onClick={remove}>{t('Remove', 'हटाएं', 'Hatao')}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
function AddStaff({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, err } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [access, setAccess] = useState('billing');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (open) { setName(''); setEmail(''); setPassword(''); setAccess('billing'); setError(''); } }, [open]);
  const save = async () => {
    setBusy(true); setError('');
    try { await post('/api/staff', { name, email, password, access }); qc.invalidateQueries({ queryKey: ['staff'] }); toast({ text: t('Staff added', 'स्टाफ़ जुड़ गया', 'Staff jud gaya') }); onClose(); }
    catch (e) { setError(err(e)); } finally { setBusy(false); }
  };
  return (
    <Drawer open={open} onClose={onClose} title={t('Add staff', 'स्टाफ़ जोड़ें', 'Staff jodo')} footer={<><span className="grow" /><Button onClick={onClose}>{t('Cancel', 'रद्द', 'Cancel')}</Button><Button variant="primary" loading={busy} onClick={save}>{t('Add', 'जोड़ें', 'Jodo')}</Button></>}>
      <div className="stack" style={{ gap: 16 }}>
        <Field label={t('Name', 'नाम', 'Naam')}>{(id) => <Input id={id} autoFocus value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Email">{(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
        <Field label={t('Password', 'पासवर्ड', 'Password')} hint={t('At least 8 characters. Share it with them yourself.', 'कम से कम 8 अक्षर। उन्हें खुद बताएं।', 'Kam se kam 8 akshar. Unhe khud batao.')}>{(id) => <Input id={id} type="text" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
        <Field label={t('What can they use?', 'वे क्या इस्तेमाल कर सकते हैं?', 'Woh kya use kar sakte hain?')}>{(id) => <Select id={id} value={access} onChange={(e) => setAccess(e.target.value)}>
          <option value="billing">{t('Billing and customers only', 'सिर्फ़ बिलिंग और ग्राहक', 'Sirf billing aur customers')}</option>
          <option value="stock">{t('Stock and purchases only', 'सिर्फ़ stock और खरीद', 'Sirf stock aur khareed')}</option>
          <option value="all">{t('Billing and stock', 'बिलिंग और stock दोनों', 'Billing aur stock dono')}</option></Select>}</Field>
        <p className="muted" style={{ margin: 0 }}>{t('Reports, expenses, settings and history stay with you.', 'रिपोर्ट, खर्चा, सेटिंग और हिस्ट्री सिर्फ़ आपके पास रहेंगे।', 'Report, kharcha, settings aur history sirf aapke paas rahenge.')}</p>
        {error && <div className="banner banner-owed" role="alert">{error}</div>}
      </div>
    </Drawer>
  );
}

/* ---------- plan ---------- */
interface SubState extends Subscription { plan_code: string | null; grace_days: number }
interface Plan { code: string; name: string; duration_days: number; price: number }
interface SubPay { id: number; plan_code: string; amount: number; status: string; invoice_no: string | null; created_at: string }
function PlanTab() {
  const { t, err } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['subscription'], queryFn: () => get<{ subscription: SubState; plans: Plan[]; payments: SubPay[]; gateway_configured: boolean }>('/api/subscription') });
  const [plan, setPlan] = useState(''); const [amount, setAmount] = useState(''); const [ref, setRef] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const d = q.data;
  useEffect(() => { if (d && !plan && d.plans[0]) { setPlan(d.plans[0].code); setAmount(String(d.plans[0].price || '')); } }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <SkelRows rows={5} />;
  const s = d.subscription;
  const stat = { none: t('Not started — set up your shop to begin the free trial', 'शुरू नहीं हुआ — मुफ़्त trial के लिए दुकान setup करें', 'Shuru nahi hua — free trial ke liye dukaan setup karo'), trial: t('Free trial', 'फ्री ट्रायल', 'Free trial'), active: t('Active', 'चालू', 'Chalu'), grace: t('Ended — grace period', 'खत्म — grace period', 'Khatam — grace period'), expired: t('Ended — read-only', 'खत्म — सिर्फ़ देख सकते हैं', 'Khatam — sirf dekh sakte ho'), blocked: t('Paused', 'रोका गया', 'Roka gaya') }[s.status] || s.status;
  const claim = async () => {
    setBusy(true); setError('');
    try { await post('/api/subscription/claim', { plan_code: plan, amount: Number(amount) || 0, reference: ref.trim() }); setRef(''); qc.invalidateQueries({ queryKey: ['subscription'] }); toast({ text: t('Sent — DILIGENCE will confirm and extend your plan.', 'भेज दिया — DILIGENCE जाँचकर प्लान बढ़ा देगा।', 'Bhej diya — DILIGENCE jaanchkar plan badha dega.') }); }
    catch (e) { setError(err(e)); } finally { setBusy(false); }
  };
  const invoice = async (id: number) => {
    try {
      const r = await get<{ invoice: { invoice_no: string; date: string; plan_name: string; plan_code: string; period_from: string; period_to: string; method: string; reference: string; amount: number; business?: { name?: string; owner_name?: string } } }>(`/api/subscription/invoice/${id}`);
      const i = r.invoice; const w = window.open('', '_blank', 'width=720,height=800'); if (!w) return;
      const esc = (x: string) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
      w.document.write(`<!doctype html><title>${esc(i.invoice_no)}</title><body style="font:15px system-ui;padding:40px;max-width:600px;margin:auto"><h2>DILIGENCE — Subscription invoice</h2><p>${esc(i.invoice_no)} · ${esc(i.date)}</p><table style="width:100%;border-collapse:collapse">${[['Billed to', i.business?.name || i.business?.owner_name || ''], ['Plan', `${i.plan_name} (${i.plan_code})`], ['Period', `${i.period_from.slice(0, 10)} → ${i.period_to.slice(0, 10)}`], ['Payment', `${i.method}${i.reference ? ' · ref ' + i.reference : ''}`], ['Total paid', rupees(i.amount)]].map(([a, b]) => `<tr><td style="padding:8px 0;border-bottom:1px solid #ddd">${esc(a)}</td><td style="padding:8px 0;border-bottom:1px solid #ddd;text-align:right">${esc(String(b))}</td></tr>`).join('')}</table><script>window.print()<\/script>`);
      w.document.close();
    } catch (e) { toast({ text: err(e), tone: 'error' }); }
  };
  return (
    <div className="stack" style={{ gap: 16, maxWidth: 760 }}>
      <div className="banner banner-info">{t('Business Mart is free, always. This plan is for Workspace — billing, stock and reports.', 'Business Mart हमेशा फ्री है। यह प्लान Workspace के लिए है — बिलिंग, stock और रिपोर्ट।', 'Business Mart hamesha free hai. Yeh plan Workspace ke liye hai — billing, stock aur report.')}</div>
      <Panel title={t('Workspace plan', 'Workspace प्लान', 'Workspace plan')}>
        <div className="sum-lines">
          <div className="sum-line"><span>{t('Status', 'स्थिति', 'Status')}</span><b>{stat}</b></div>
          <div className="sum-line"><span>{t('Plan', 'प्लान', 'Plan')}</span><span>{s.plan_code || t('Free trial', 'फ्री ट्रायल', 'Free trial')}</span></div>
          <div className="sum-line"><span>{t('Valid till', 'कब तक', 'Kab tak')}</span><span>{s.ends_at ? `${s.ends_at.slice(0, 10)}${s.days_left >= 0 ? ` · ${s.days_left} ${t('days', 'दिन', 'din')}` : ''}` : '—'}</span></div>
          <div className="sum-line"><span>{t('Grace after it ends', 'खत्म होने के बाद छूट', 'Khatam hone ke baad chhoot')}</span><span>{s.grace_days} {t('days', 'दिन', 'din')}</span></div>
        </div>
      </Panel>
      <Panel title={t('Renew by UPI', 'UPI से रीन्यू करें', 'UPI se renew karo')}>
        {!d.plans.length ? <p className="muted" style={{ margin: 0 }}>{t('No plans are open for purchase yet.', 'अभी कोई प्लान उपलब्ध नहीं है।', 'Abhi koi plan available nahi hai.')}</p> : (
          <div className="stack" style={{ gap: 16 }}>
            <p className="muted" style={{ margin: 0 }}>{t('Pay by UPI, then enter the UPI / UTR reference below. Your plan extends after we confirm.', 'UPI से पेमेंट करें, फिर नीचे UPI / UTR नंबर डालें। हमारी जाँच के बाद प्लान बढ़ेगा।', 'UPI se payment karo, phir neeche UPI / UTR number daalo. Hamari jaanch ke baad plan badhega.')}</p>
            <div className="form-3">
              <Field label={t('Plan', 'प्लान', 'Plan')}>{(id) => <Select id={id} value={plan} onChange={(e) => { setPlan(e.target.value); const p = d.plans.find((x) => x.code === e.target.value); setAmount(String(p?.price || '')); }}>{d.plans.map((p) => <option key={p.code} value={p.code}>{p.name} · {p.duration_days} {t('days', 'दिन', 'din')} · {p.price > 0 ? rupees(p.price) : t('price not set', 'भाव तय नहीं', 'bhaav tay nahi')}</option>)}</Select>}</Field>
              <Field label={t('Amount paid ₹', 'दी हुई रकम ₹', 'Di hui rakam ₹')}>{(id) => <Input id={id} numeric inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} />}</Field>
              <Field label={t('UPI / UTR reference', 'UPI / UTR नंबर', 'UPI / UTR number')}>{(id) => <Input id={id} value={ref} onChange={(e) => setRef(e.target.value)} />}</Field>
            </div>
            {error && <div className="banner banner-owed" role="alert">{error}</div>}
            <div><Button variant="primary" loading={busy} disabled={!ref.trim()} onClick={claim}>{t('I have paid', 'मैंने पेमेंट कर दिया', 'Maine payment kar diya')}</Button></div>
            {!d.gateway_configured && <p className="muted" style={{ margin: 0 }}>{t('Card / online payment is not live yet.', 'कार्ड / ऑनलाइन पेमेंट अभी चालू नहीं है।', 'Card / online payment abhi chalu nahi hai.')}</p>}
          </div>
        )}
      </Panel>
      {!!d.payments.length && (
        <Panel title={t('Payments', 'पेमेंट', 'Payments')} bodyClass=""><div className="table-wrap"><table className="table table-dense">
          <thead><tr><th>{t('Date', 'तारीख', 'Date')}</th><th>{t('Plan', 'प्लान', 'Plan')}</th><th className="r">{t('Amount', 'रकम', 'Rakam')}</th><th>{t('Status', 'स्थिति', 'Status')}</th><th /></tr></thead>
          <tbody>{d.payments.map((p) => <tr key={p.id}><td>{p.created_at.slice(0, 10)}</td><td>{p.plan_code}</td><td className="r num">{rupees(p.amount)}</td>
            <td><Badge tone={p.status === 'approved' ? 'in' : p.status === 'pending' ? 'warn' : 'owed'}>{p.status === 'approved' ? t('Confirmed', 'पक्का', 'Pakka') : p.status === 'pending' ? t('Checking', 'जाँच में', 'Jaanch me') : p.status}</Badge></td>
            <td className="r">{p.status === 'approved' && p.invoice_no && <Button size="sm" icon={<Printer size={14} />} onClick={() => invoice(p.id)}>{p.invoice_no}</Button>}</td></tr>)}</tbody>
        </table></div></Panel>
      )}
    </div>
  );
}

/* ---------- data: backups, exports, import ---------- */
interface Snap { id: number; kind: string; size: number; created_at: string }
function DataTab() {
  const { t, err } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['backups'], queryFn: () => get<{ snapshots: Snap[]; auto_backup: { retention: number; last_auto_at: string | null } }>('/api/backups') });
  const [restore, setRestore] = useState<Snap | null>(null); const [busy, setBusy] = useState(false);
  const fail = (e: unknown) => toast({ text: err(e), tone: 'error' });
  const kind = (k: string) => k === 'auto' ? t('Automatic', 'अपने आप', 'Apne aap') : k === 'manual' ? t('Manual', 'हाथ से', 'Haath se') : t('Before restore', 'Restore से पहले', 'Restore se pehle');
  const make = async () => { setBusy(true); try { await post('/api/backups'); qc.invalidateQueries({ queryKey: ['backups'] }); toast({ text: t('Backup saved', 'बैकअप बन गया', 'Backup ban gaya') }); } catch (e) { fail(e); } finally { setBusy(false); } };
  const doRestore = async () => { if (!restore) return; setBusy(true); try { await post(`/api/backups/${restore.id}/restore`); qc.invalidateQueries(); toast({ text: t('Restored — your data is back to that backup.', 'वापस आ गया — डेटा उस बैकअप जैसा हो गया।', 'Wapas aa gaya — data us backup jaisa ho gaya.') }); setRestore(null); } catch (e) { fail(e); } finally { setBusy(false); } };
  return (
    <div className="stack" style={{ gap: 16, maxWidth: 760 }}>
      <Panel title={t('Backups', 'बैकअप', 'Backups')} bodyClass="" action={<Button size="sm" variant="primary" icon={<Archive size={14} />} loading={busy} onClick={make}>{t('Back up now', 'अभी बैकअप लें', 'Abhi backup lo')}</Button>}>
        <p className="muted panel-body" style={{ margin: 0, paddingBottom: 0 }}>{q.data ? t(`Backs up by itself — the last ${q.data.auto_backup.retention} are kept.${q.data.auto_backup.last_auto_at ? ' Last automatic: ' + q.data.auto_backup.last_auto_at.slice(0, 16) : ''}`, `अपने आप बैकअप बनता है — आख़िरी ${q.data.auto_backup.retention} रहते हैं।`, `Apne aap backup banta hai — aakhri ${q.data.auto_backup.retention} rehte hain.`) : ' '}</p>
        {q.isLoading ? <div className="panel-body"><SkelRows rows={3} /></div> : !q.data?.snapshots.length ? <Empty title={t('No backups yet', 'अभी कोई बैकअप नहीं', 'Abhi koi backup nahi')} /> : (
          <div className="table-wrap"><table className="table table-dense">
            <thead><tr><th>{t('When', 'कब', 'Kab')}</th><th>{t('Kind', 'प्रकार', 'Type')}</th><th className="r">{t('Size', 'साइज़', 'Size')}</th><th /></tr></thead>
            <tbody>{q.data.snapshots.map((s) => <tr key={s.id}><td>{s.created_at.slice(0, 16)}</td><td>{kind(s.kind)}</td><td className="r num">{Math.max(1, Math.round(s.size / 1024))} KB</td>
              <td className="r" style={{ whiteSpace: 'nowrap' }}><Button size="sm" variant="ghost" icon={<Download size={14} />} onClick={() => download(`/api/backups/${s.id}/download`, `backup-${s.id}.json`).catch(fail)}>{t('Download', 'डाउनलोड', 'Download')}</Button><Button size="sm" onClick={() => setRestore(s)}>{t('Restore', 'वापस लाएं', 'Restore')}</Button></td></tr>)}</tbody>
          </table></div>
        )}
      </Panel>
      <Panel title={t('Download your data', 'अपना डेटा डाउनलोड करें', 'Apna data download karo')}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {([['sales', t('Sales', 'बिक्री', 'Bikri')], ['products', t('Products', 'सामान', 'Saaman')], ['customers', t('Customers', 'ग्राहक', 'Customers')], ['suppliers', t('Suppliers', 'सप्लायर', 'Suppliers')], ['purchases', t('Purchases', 'खरीद', 'Khareed')], ['expenses', t('Expenses', 'खर्चा', 'Kharcha')]] as const).map(([k, l]) => (
            <ExportMenu key={k} path={`/api/export/${k}`} name={k} label={l} />))}
        </div>
      </Panel>
      <ImportPanel />
      <DeleteAccountPanel />
      <Modal open={!!restore} onClose={() => setRestore(null)} label={t('Restore backup', 'बैकअप वापस लाएं', 'Backup wapas lao')}>
        <div className="stack" style={{ gap: 12, padding: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{t('Go back to this backup?', 'इस बैकअप पर वापस जाएं?', 'Is backup par wapas jaye?')}</h2>
          <p className="muted" style={{ margin: 0 }}>{t(`Your shop data will go back to ${restore?.created_at.slice(0, 16)}. Today's data is saved first, so you can undo this.`, `दुकान का डेटा ${restore?.created_at.slice(0, 16)} जैसा हो जाएगा। आज का डेटा पहले सेव होगा, इसलिए वापस भी लौट सकते हैं।`, `Dukaan ka data ${restore?.created_at.slice(0, 16)} jaisa ho jayega. Aaj ka data pehle save hoga, isliye wapas bhi lout sakte ho.`)}</p>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}><Button onClick={() => setRestore(null)}>{t('Cancel', 'रद्द', 'Cancel')}</Button><Button variant="primary" loading={busy} onClick={doRestore}>{t('Restore', 'वापस लाएं', 'Restore')}</Button></div>
        </div>
      </Modal>
    </div>
  );
}

function DeleteAccountPanel() {
  const { t, err } = useI18n();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    try {
      await post('/api/account/delete', { password });
      setToken(null);
      window.location.href = '/';
    } catch (e) { toast({ text: err(e), tone: 'error' }); setBusy(false); }
  };
  return (
    <>
      <Panel title={t('Delete account', 'खाता हटाएं', 'Account hatao')}>
        <div className="panel-body stack" style={{ gap: 10 }}>
          <p className="muted" style={{ margin: 0 }}>{t('Delete your account and ALL your data for good — bills, stock, customers, Business Mart, everything. This cannot be undone, so download your data or take a backup first.', 'अपना खाता और सारा डेटा हमेशा के लिए हटाएं — बिल, स्टॉक, ग्राहक, Business Mart, सब कुछ। यह वापस नहीं होगा, इसलिए पहले डेटा डाउनलोड या बैकअप ले लें।', 'Apna account aur saara data hamesha ke liye hatao — bill, stock, customers, Business Mart, sab kuch. Ye wapas nahi hoga, isliye pehle data download ya backup le lo.')}</p>
          <div><Button variant="danger" icon={<Trash2 size={14} />} onClick={() => { setPassword(''); setOpen(true); }}>{t('Delete my account and data', 'मेरा खाता और डेटा हटाएं', 'Mera account aur data hatao')}</Button></div>
        </div>
      </Panel>
      <Modal open={open} onClose={() => { if (!busy) setOpen(false); }} label={t('Delete account', 'खाता हटाएं', 'Account hatao')}>
        <div className="stack" style={{ gap: 12, padding: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{t('Delete everything, for good?', 'सब कुछ हमेशा के लिए हटाएं?', 'Sab kuch hamesha ke liye hatao?')}</h2>
          <p className="muted" style={{ margin: 0 }}>{t('Your account, your business and every record in it will be deleted right away and cannot be brought back. Type your password to confirm.', 'आपका खाता, आपका बिज़नेस और उसका हर रिकॉर्ड तुरंत हट जाएगा और वापस नहीं आएगा। पक्का करने के लिए अपना password लिखें।', 'Aapka account, aapka business aur uska har record turant hat jayega aur wapas nahi aayega. Pakka karne ke liye apna password likho.')}</p>
          <Field label={t('Your password', 'आपका password', 'Aapka password')}>
            {(id) => <Input id={id} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />}
          </Field>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setOpen(false)} disabled={busy}>{t('Keep my account', 'खाता रहने दें', 'Account rehne do')}</Button>
            <Button variant="danger" loading={busy} disabled={!password} onClick={remove}>{t('Delete forever', 'हमेशा के लिए हटाएं', 'Hamesha ke liye hatao')}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function ImportPanel() {
  const { t } = useI18n();
  return (
    <Panel title={t('Bring in your old data', 'पुराना डेटा लाएं', 'Purana data lao')}>
      <ImportForm types={['products', 'customers', 'suppliers', 'expenses', 'catalog']} />
    </Panel>
  );
}
