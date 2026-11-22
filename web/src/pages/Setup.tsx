import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ArrowRight, Briefcase, CircleCheck, ImagePlus, KeyRound, Package, PartyPopper, Pill, Plus, QrCode,
  ReceiptText, Scissors, Shirt, Smartphone, Store, Trash2, Tv, Upload, UserPlus, Users, UtensilsCrossed, Wrench
} from 'lucide-react';
import { post, put } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';
import { picked } from '../lib/mode';
import type { Business, Lang, Subscription } from '../lib/types';
import { Button, Field, Input, Select, useToast } from '../components/ui';
import { ImportForm } from '../components/ImportData';
import { ShopImagePick } from '../components/ShopImagePick';

// Shop setup guide (23 Nov) — the second stage of the two-stage workflow.
// A BizYour account (signup + email OTP) opens Business Mart buying
// immediately; the Workspace — and its 30-day free trial — starts when the
// owner finishes step 1 (POST /api/workspace/activate).
//
//   1. Your shop      — shop name + city are the ONLY required fields
//   2. GST & UPI      — optional; both print on every bill (live preview)
//   3. Customers      — optional; type a few or import a file
//   4. Team           — optional; staff logins with limited access
//   5. Done
//
// Every optional step has "Skip for now", and everything can be changed
// later in Settings.

export const SHOP_CATEGORIES = ['kirana', 'electronics', 'mobile', 'medical', 'garments', 'food', 'hardware', 'beauty', 'services', 'other'] as const;

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const UPI_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/;
const STEP_KEYS = ['shop', 'billing', 'customers', 'team', 'done'] as const;
type StepKey = typeof STEP_KEYS[number];

/** QR images stay sharp as PNG; fall back to JPEG only if the PNG is too big. */
function readQrImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) { reject(new Error('not_image')); return; }
    const img = new Image();
    img.onload = () => {
      const sc = Math.min(1, 640 / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(img.width * sc)); cv.height = Math.max(1, Math.round(img.height * sc));
      const g = cv.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(img.src);
      let out = cv.toDataURL('image/png');
      let q = 0.9;
      while (out.length > 540000 && q > 0.4) { out = cv.toDataURL('image/jpeg', q); q -= 0.1; }
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error('bad_image')); };
    img.src = URL.createObjectURL(file);
  });
}

const csvCell = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

export function SetupPage() {
  const { t, setLang, lang } = useI18n();
  const { me, setBusiness, logout } = useSession();
  const nav = useNavigate();
  const loc = useLocation();
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();
  const b = me?.business;
  const activated = !!b?.workspace_active;

  // the step lives in the URL (?step=billing), so a reload resumes the guide
  const stepParam = sp.get('step') as StepKey | null;
  const step: StepKey = activated && stepParam && STEP_KEYS.includes(stepParam) ? stepParam : 'shop';
  const go = (k: StepKey) => { sp.set('step', k); setSp(sp, { replace: false }); window.scrollTo({ top: 0 }); };
  const [done, setDone] = useState<Record<string, boolean>>({});
  const mark = (k: StepKey) => setDone((d) => ({ ...d, [k]: true }));

  const finish = () => {
    picked();
    const from = (loc.state as { from?: string } | null)?.from;
    nav(from && from !== '/setup' ? from : '/', { replace: true });
  };

  const steps: { key: StepKey; title: string; sub: string; required?: boolean; icon: ReactNode }[] = [
    { key: 'shop', title: t('Your shop', 'आपकी दुकान', 'Aapki dukaan'), sub: t('Name and city', 'नाम और शहर', 'Naam aur shehar'), required: true, icon: <Store size={16} /> },
    { key: 'billing', title: t('GST & UPI', 'GST और UPI', 'GST aur UPI'), sub: t('Prints on your bills', 'बिल पर छपता है', 'Bill pe chhapta hai'), icon: <ReceiptText size={16} /> },
    { key: 'customers', title: t('Customers', 'ग्राहक', 'Customers'), sub: t('Add now or later', 'अभी या बाद में', 'Abhi ya baad me'), icon: <Users size={16} /> },
    { key: 'team', title: t('Your team', 'आपकी टीम', 'Aapki team'), sub: t('Staff logins', 'स्टाफ लॉगिन', 'Staff login'), icon: <UserPlus size={16} /> },
    { key: 'done', title: t('All set', 'सब तैयार', 'Sab taiyaar'), sub: t('Open your Workspace', 'Workspace खोलें', 'Workspace kholo'), icon: <PartyPopper size={16} /> }
  ];
  const idx = STEP_KEYS.indexOf(step);

  return (
    <div className="sg">
      <aside className="sg-rail">
        <div className="sg-brand">
          <img src="/bizyour-mark-512.png?v=c" alt="" width={32} height={32} />
          <div><b>BizYour</b><small>{t('Shop setup', 'दुकान सेटअप', 'Dukaan setup')}</small></div>
        </div>
        <ol className="sg-steps">
          {steps.map((s, k) => {
            const state = k === idx ? 'on' : (k < idx || done[s.key]) ? 'done' : '';
            const reachable = activated && k !== idx;
            return (
              <li key={s.key} className={state}>
                <button type="button" disabled={!reachable} onClick={() => go(s.key)} aria-current={k === idx ? 'step' : undefined}>
                  <span className="sg-dot">{state === 'done' ? <CircleCheck size={16} /> : k + 1}</span>
                  <span className="sg-txt"><b>{s.title}</b><small>{s.sub}</small></span>
                  {s.key !== 'done' && <span className={`sg-tag ${s.required ? 'req' : ''}`}>{s.required ? t('Required', 'ज़रूरी', 'Zaroori') : t('Optional', 'चाहें तो', 'Optional')}</span>}
                </button>
              </li>
            );
          })}
        </ol>
        <p className="sg-rail-note">{t('Everything here can be changed later in Settings.', 'यह सब बाद में Settings में बदल सकते हैं।', 'Ye sab baad me Settings me badal sakte ho.')}</p>
        <div className="sg-rail-foot">
          <Link className="link-btn" to="/mart">{t('Open Business Mart instead', 'इसके बजाय Business Mart खोलें', 'Iske bajaye Business Mart kholo')} →</Link>
          <button className="link-btn" onClick={logout}>{t('Log out', 'लॉग आउट', 'Log out')}</button>
        </div>
      </aside>

      <main className="sg-main">
        <div className="sg-progress" aria-hidden><i style={{ width: `${(idx / (STEP_KEYS.length - 1)) * 100}%` }} /></div>
        <div className="sg-mobile-step">{t(`Step ${idx + 1} of ${STEP_KEYS.length}`, `चरण ${idx + 1} / ${STEP_KEYS.length}`, `Step ${idx + 1} / ${STEP_KEYS.length}`)} · {steps[idx].title}</div>
        <div className="sg-card" key={step}>
          {step === 'shop' && (
            <ShopStep onSaved={(biz, language) => { setBusiness(biz); setLang(language); qc.invalidateQueries({ queryKey: ['subscription'] }); mark('shop'); go('billing'); }} lang={lang} setLangPreview={setLang} />
          )}
          {step === 'billing' && b && (
            <BillingStep business={b} onBack={() => go('shop')} onSkip={() => go('customers')}
              onSaved={(biz) => { setBusiness(biz); mark('billing'); go('customers'); }} />
          )}
          {step === 'customers' && (
            <CustomersStep onBack={() => go('billing')} onSkip={() => go('team')} onSaved={() => { mark('customers'); go('team'); }} />
          )}
          {step === 'team' && (
            <TeamStep onBack={() => go('customers')} onSkip={() => go('done')} onSaved={() => { mark('team'); go('done'); }} />
          )}
          {step === 'done' && b && <DoneStep business={b} onOpen={finish} onEdit={go} onFirstBill={() => { picked(); nav('/pos', { replace: true }); }} />}
        </div>
        {(loc.state as { from?: string } | null)?.from && step === 'shop' && (
          <div className="banner" role="status" style={{ marginTop: 12 }}>{t('The Workspace opens after shop setup — finish this first.', 'Workspace दुकान setup के बाद खुलेगा — पहले यह पूरा करें।', 'Workspace dukaan setup ke baad khulega — pehle ye poora karo.')}</div>
        )}
      </main>
    </div>
  );
}

/* ---------- shared step chrome ---------- */
function StepHead({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }) {
  return (
    <header className="sg-head">
      <span className="sg-head-ic">{icon}</span>
      <div><h1>{title}</h1><p>{sub}</p></div>
    </header>
  );
}
function StepFoot({ onBack, onSkip, primary, busy, primaryType = 'button', onPrimary }: { onBack?: () => void; onSkip?: () => void; primary: string; busy?: boolean; primaryType?: 'button' | 'submit'; onPrimary?: () => void }) {
  const { t } = useI18n();
  return (
    <footer className="sg-foot">
      {onBack ? <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={onBack}>{t('Back', 'पीछे', 'Peeche')}</Button> : <span />}
      <div className="row" style={{ gap: 8 }}>
        {onSkip && <Button variant="ghost" onClick={onSkip}>{t('Skip for now', 'अभी छोड़ें', 'Abhi chhodo')}</Button>}
        <Button type={primaryType} variant="primary" size="lg" loading={busy} onClick={onPrimary}>{primary} <ArrowRight size={16} /></Button>
      </div>
    </footer>
  );
}

/* ---------- 1. shop ---------- */
function ShopStep({ onSaved, lang, setLangPreview }: { onSaved: (b: Business, l: Lang) => void; lang: Lang; setLangPreview: (l: Lang) => void }) {
  const { t, err } = useI18n();
  const { me } = useSession();
  const b = me?.business;
  const [f, setF] = useState({
    name: b?.name || '', city: b?.city || '', category: b?.category || '',
    owner_name: b?.owner_name || me?.user.name || '', phone: me?.user.mobile || b?.phone || '',
    address: b?.address || '', landmark: b?.landmark || '', pincode: b?.pincode || '', state: b?.state || ''
  });
  const [more, setMore] = useState(!!(b?.address || b?.state));
  const [logo, setLogo] = useState<string | null>(b?.logo || null);
  const [photo, setPhoto] = useState<string | null>(b?.shop_photo || null);
  const [language, setLanguage] = useState<Lang>(lang);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const cats: { v: string; label: string; icon: ReactNode }[] = [
    { v: 'kirana', label: t('Kirana / General', 'किराना / जनरल', 'Kirana / General'), icon: <Store size={18} /> },
    { v: 'garments', label: t('Garments', 'कपड़े', 'Kapde'), icon: <Shirt size={18} /> },
    { v: 'mobile', label: t('Mobile', 'मोबाइल', 'Mobile'), icon: <Smartphone size={18} /> },
    { v: 'electronics', label: t('Electronics', 'इलेक्ट्रॉनिक्स', 'Electronics'), icon: <Tv size={18} /> },
    { v: 'hardware', label: t('Hardware', 'हार्डवेयर', 'Hardware'), icon: <Wrench size={18} /> },
    { v: 'medical', label: t('Medical', 'मेडिकल', 'Medical'), icon: <Pill size={18} /> },
    { v: 'food', label: t('Food', 'खाना', 'Khana'), icon: <UtensilsCrossed size={18} /> },
    { v: 'beauty', label: t('Beauty / Salon', 'ब्यूटी / सैलून', 'Beauty / Salon'), icon: <Scissors size={18} /> },
    { v: 'services', label: t('Services', 'सर्विसेज़', 'Services'), icon: <Briefcase size={18} /> },
    { v: 'other', label: t('Other', 'अन्य', 'Other'), icon: <Package size={18} /> }
  ];
  const langs: { v: Lang; title: string; sub: string }[] = [
    { v: 'en', title: 'English', sub: 'Simple English' },
    { v: 'hi', title: 'हिंदी', sub: 'हिंदी में चलेगा' },
    { v: 'hg', title: 'Hinglish', sub: 'Hindi + English mix' }
  ];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (f.name.trim().length < 3) { setError(t('Write your shop’s name — it prints on every bill.', 'दुकान का नाम लिखें — हर बिल पर छपेगा।', 'Dukaan ka naam likho — har bill pe chhapega.')); return; }
    if (f.city.trim().length < 2) { setError(t('Which city is your shop in?', 'आपकी दुकान किस शहर में है?', 'Aapki dukaan kis shehar me hai?')); return; }
    if (f.pincode && !/^\d{6}$/.test(f.pincode.trim())) { setError(t('PIN code must be 6 digits.', 'PIN code 6 अंकों का होना चाहिए।', 'PIN code 6 digit ka hona chahiye.')); return; }
    setBusy(true); setError('');
    try {
      const r = await post<{ business: Business; subscription: Subscription }>('/api/workspace/activate', {
        ...f, name: f.name.trim(), city: f.city.trim(), pincode: f.pincode.trim(), language,
        gst_enabled: !!b?.gst_enabled, gstin: b?.gstin || '',
        logo: logo || '', shop_photo: photo || ''
      });
      onSaved(r.business, language);
    } catch (x) { setError(err(x)); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="stack" style={{ gap: 18 }}>
      <StepHead icon={<Store size={20} />} title={t('Tell us about your shop', 'अपनी दुकान के बारे में बताइए', 'Apni dukaan ke baare me batao')}
        sub={t('Just two things are needed: the shop name and the city. Your 30-day free Workspace trial starts when you save this step.', 'बस दो चीज़ें ज़रूरी हैं: दुकान का नाम और शहर। यह step सेव करते ही 30 दिन का मुफ़्त Workspace trial शुरू।', 'Bas do cheezein zaroori hain: dukaan ka naam aur shehar. Ye step save karte hi 30 din ka free Workspace trial shuru.')} />
      <div className="form-2">
        <Field label={<>{t('Shop name', 'दुकान का नाम', 'Dukaan ka naam')} <span className="req-star">*</span></>}>{(id) => <Input id={id} size2="lg" value={f.name} onChange={set('name')} placeholder={t('e.g. Sharma General Store', 'जैसे शर्मा जनरल स्टोर', 'jaise Sharma General Store')} autoFocus />}</Field>
        <Field label={<>{t('City', 'शहर', 'Shehar')} <span className="req-star">*</span></>}>{(id) => <Input id={id} size2="lg" value={f.city} onChange={set('city')} placeholder={t('e.g. Delhi', 'जैसे दिल्ली', 'jaise Delhi')} />}</Field>
      </div>
      <div className="field">
        <span className="field-label">{t('What kind of shop is it?', 'दुकान किस तरह की है?', 'Dukaan kis tarah ki hai?')} <span className="muted" style={{ fontWeight: 400 }}>({t('optional', 'चाहें तो', 'optional')})</span></span>
        <div className="sg-cats" role="radiogroup">
          {cats.map((c) => (
            <button type="button" key={c.v} role="radio" aria-checked={f.category === c.v} className={f.category === c.v ? 'on' : ''} onClick={() => setF({ ...f, category: f.category === c.v ? '' : c.v })}>
              {c.icon}<span>{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">{t('Logo and shop photo', 'लोगो और दुकान की फ़ोटो', 'Logo aur dukaan ki photo')} <span className="muted" style={{ fontWeight: 400 }}>({t('optional', 'चाहें तो', 'optional')})</span></span>
        <div className="sip-row">
          <ShopImagePick kind="logo" value={logo} onChange={setLogo} onError={setError} shopName={f.name} />
          <ShopImagePick kind="photo" value={photo} onChange={setPhoto} onError={setError} />
        </div>
      </div>

      <button type="button" className="sg-more" onClick={() => setMore(!more)} aria-expanded={more}>
        {more ? '−' : '+'} {t('Address, phone and owner name', 'पता, फ़ोन और मालिक का नाम', 'Address, phone aur owner ka naam')} <span className="muted">({t('optional', 'चाहें तो', 'optional')})</span>
      </button>
      {more && (
        <div className="stack sg-more-body" style={{ gap: 14 }}>
          <div className="form-2">
            <Field label={t('Owner name', 'मालिक का नाम', 'Owner ka naam')}>{(id) => <Input id={id} value={f.owner_name} onChange={set('owner_name')} />}</Field>
            <Field label={t('Shop WhatsApp number', 'दुकान का WhatsApp नंबर', 'Dukaan ka WhatsApp number')} hint={t('Prints on bills.', 'बिल पर छपेगा।', 'Bill pe chhapega.')}>{(id) => <Input id={id} type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="98XXXXXXXX" />}</Field>
          </div>
          <Field label={t('Shop address', 'दुकान का पता', 'Dukaan ka address')}>{(id) => <Input id={id} value={f.address} onChange={set('address')} placeholder={t('Shop no, street, area', 'दुकान नंबर, गली, इलाक़ा', 'Shop no, gali, area')} />}</Field>
          <div className="form-3">
            <Field label={t('Landmark', 'आस-पास की पहचान', 'Landmark')}>{(id) => <Input id={id} value={f.landmark} onChange={set('landmark')} />}</Field>
            <Field label={t('PIN code', 'PIN code', 'PIN code')}>{(id) => <Input id={id} inputMode="numeric" maxLength={6} value={f.pincode} onChange={set('pincode')} placeholder="110001" />}</Field>
            <Field label={t('State', 'राज्य', 'State')}>{(id) => (
              <Select id={id} value={f.state} onChange={set('state')}>
                <option value="">{t('Choose', 'चुनें', 'Chuno')}</option>
                {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            )}</Field>
          </div>
        </div>
      )}

      <div className="field">
        <span className="field-label">{t('App and bill language', 'App और बिल की भाषा', 'App aur bill ki bhasha')}</span>
        <div className="lang-pick" role="radiogroup">
          {langs.map((l) => (
            <button type="button" key={l.v} role="radio" aria-checked={language === l.v} className={language === l.v ? 'on' : ''} onClick={() => { setLanguage(l.v); setLangPreview(l.v); }}>
              <b>{l.title}</b><span>{l.sub}</span>
            </button>
          ))}
        </div>
      </div>
      {error && <div className="banner banner-owed" role="alert">{error}</div>}
      <StepFoot primaryType="submit" busy={busy} primary={t('Save and continue', 'सेव करके आगे', 'Save karke aage')} />
    </form>
  );
}

/* ---------- 2. GST & UPI ---------- */
function BillingStep({ business, onBack, onSkip, onSaved }: { business: Business; onBack: () => void; onSkip: () => void; onSaved: (b: Business) => void }) {
  const { t, err } = useI18n();
  const [gst, setGst] = useState(!!business.gst_enabled);
  const [gstin, setGstin] = useState(business.gstin || '');
  const [upi, setUpi] = useState(business.upi_id || '');
  const [payee, setPayee] = useState(business.upi_payee_name || business.name || '');
  const [qr, setQr] = useState<string | null>(business.payment_qr || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pickQr = async (file?: File) => {
    if (!file) return;
    try { setQr(await readQrImage(file)); setError(''); }
    catch { setError(t('That file is not an image. Upload a photo or screenshot of your UPI QR.', 'यह फ़ाइल तस्वीर नहीं है। UPI QR की फ़ोटो या screenshot डालें।', 'Ye file tasveer nahi hai. UPI QR ki photo ya screenshot daalo.')); }
  };
  const save = async () => {
    const g = gstin.trim().toUpperCase();
    if (gst && !GSTIN_RE.test(g)) { setError(t('A GSTIN has 15 characters, like 07ABCDE1234F1Z5.', 'GSTIN 15 अक्षर का होता है, जैसे 07ABCDE1234F1Z5।', 'GSTIN 15 character ka hota hai, jaise 07ABCDE1234F1Z5.')); return; }
    if (upi.trim() && !UPI_RE.test(upi.trim())) { setError(t('That UPI ID doesn’t look right. It looks like shopname@okaxis.', 'UPI ID सही नहीं लग रही। ऐसी दिखती है: shopname@okaxis', 'UPI ID sahi nahi lag rahi. Aisi dikhti hai: shopname@okaxis')); return; }
    setBusy(true); setError('');
    try {
      const r = await put<{ business: Business }>('/api/business', { gst_enabled: gst, gstin: gst ? g : business.gstin || '', upi_id: upi.trim(), upi_payee_name: payee.trim(), payment_qr: qr || '' });
      onSaved(r.business);
    } catch (x) { setError(err(x)); } finally { setBusy(false); }
  };
  const upiOk = UPI_RE.test(upi.trim());
  return (
    <div className="stack" style={{ gap: 18 }}>
      <StepHead icon={<ReceiptText size={20} />} title={t('GST and UPI on your bills', 'बिल पर GST और UPI', 'Bill pe GST aur UPI')}
        sub={t('Both are optional. Add your UPI ID or QR and every bill gets a “Scan to pay” code for the exact amount.', 'दोनों चाहें तो। UPI ID या QR डालें तो हर बिल पर सही रकम का “Scan करके pay करें” कोड आएगा।', 'Dono optional. UPI ID ya QR daalo to har bill pe sahi rakam ka “Scan karke pay karo” code aayega.')} />
      <div className="sg-split">
        <div className="stack" style={{ gap: 16 }}>
          <section className="sg-box">
            <label className="check" style={{ border: 0, padding: 0 }}>
              <input type="checkbox" checked={gst} onChange={(e) => setGst(e.target.checked)} />
              <span><b>{t('I make GST bills', 'मैं GST बिल बनाता हूँ', 'Main GST bill banata hoon')}</b><br /><span className="muted">{t('Bills show your GSTIN, taxable value and CGST/SGST.', 'बिल पर GSTIN, टैक्स योग्य रकम और CGST/SGST दिखेगा।', 'Bill pe GSTIN, taxable value aur CGST/SGST dikhega.')}</span></span>
            </label>
            {gst && <Field label="GSTIN">{(id) => <Input id={id} value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} maxLength={15} placeholder="07ABCDE1234F1Z5" />}</Field>}
          </section>
          <section className="sg-box">
            <b className="sg-box-title"><QrCode size={16} /> {t('Get paid by UPI', 'UPI से पैसे लें', 'UPI se paise lo')}</b>
            <div className="form-2">
              <Field label="UPI ID" hint={t('The QR on each bill is made from this, with the bill amount filled in.', 'हर बिल का QR इसी से बनेगा, रकम भरी हुई।', 'Har bill ka QR isi se banega, rakam bhari hui.')}>{(id) => <Input id={id} value={upi} onChange={(e) => setUpi(e.target.value.trim())} placeholder="shopname@okaxis" />}</Field>
              <Field label={t('Name on UPI', 'UPI पर नाम', 'UPI pe naam')}>{(id) => <Input id={id} value={payee} onChange={(e) => setPayee(e.target.value)} />}</Field>
            </div>
            <div className="sg-qr">
              {qr ? <img src={qr} alt={t('Your UPI QR', 'आपका UPI QR', 'Aapka UPI QR')} /> : <span className="sg-qr-empty"><ImagePlus size={22} /></span>}
              <div className="stack" style={{ gap: 6 }}>
                <b style={{ fontSize: 14 }}>{t('Or upload your shop’s UPI QR', 'या दुकान का UPI QR डालें', 'Ya dukaan ka UPI QR daalo')}</b>
                <span className="muted" style={{ fontSize: 13 }}>{t('A photo or screenshot of the QR from PhonePe, Paytm, GPay or your bank. Used when there is no UPI ID.', 'PhonePe, Paytm, GPay या बैंक वाले QR की फ़ोटो/screenshot। UPI ID न हो तो यही छपेगा।', 'PhonePe, Paytm, GPay ya bank wale QR ki photo/screenshot. UPI ID na ho to yahi chhapega.')}</span>
                <div className="row" style={{ gap: 8 }}>
                  <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}><Upload size={14} /> {qr ? t('Change', 'बदलें', 'Badlo') : t('Upload QR', 'QR डालें', 'QR daalo')}<input type="file" accept="image/*" hidden onChange={(e) => pickQr(e.target.files?.[0])} /></label>
                  {qr && <Button size="sm" variant="ghost" onClick={() => setQr(null)}>{t('Remove', 'हटाएं', 'Hatao')}</Button>}
                </div>
              </div>
            </div>
          </section>
        </div>
        {/* live preview of the bill footer */}
        <figure className="sg-preview" aria-label={t('How your bill will look', 'आपका बिल ऐसा दिखेगा', 'Aapka bill aisa dikhega')}>
          <figcaption>{t('Your bill', 'आपका बिल', 'Aapka bill')}</figcaption>
          <div className="sgp-bill">
            <div className="sgp-top">
              <div className="sgp-brand">
                <span className="sgp-logo">{business.logo ? <img src={business.logo} alt="" /> : (business.name || 'B').trim()[0]?.toUpperCase()}</span>
                <div><b>{business.name}</b><small>{business.city}{business.phone ? ` · ${business.phone}` : ''}</small></div>
              </div>
              <div className="sgp-inv"><b>{gst ? 'TAX INVOICE' : 'INVOICE'}</b>{gst && GSTIN_RE.test(gstin.trim().toUpperCase()) && <small>GSTIN {gstin.trim().toUpperCase()}</small>}</div>
            </div>
            <div className="sgp-lines"><i /><i /><i className="short" /></div>
            <div className="sgp-total"><span>{t('Grand total', 'कुल रकम', 'Grand total')}</span><b>₹225</b></div>
            {(upiOk || qr) ? (
              <div className="sgp-pay">
                {qr && !upiOk ? <img src={qr} alt="" /> : <span className="sgp-qr"><QrCode size={40} strokeWidth={1.2} /></span>}
                <div><b>{t('Scan to pay ₹225', '₹225 के लिए scan करें', '₹225 ke liye scan karo')}</b>{upiOk && <small>UPI: {upi.trim()}</small>}{payee && <small>{payee}</small>}</div>
              </div>
            ) : <div className="sgp-pay sgp-pay-off">{t('Add a UPI ID or QR to show “Scan to pay” here.', 'यहाँ “Scan करके pay” दिखाने के लिए UPI ID या QR डालें।', 'Yahan “Scan karke pay” dikhane ke liye UPI ID ya QR daalo.')}</div>}
          </div>
        </figure>
      </div>
      {error && <div className="banner banner-owed" role="alert">{error}</div>}
      <StepFoot onBack={onBack} onSkip={onSkip} busy={busy} onPrimary={save} primary={t('Save and continue', 'सेव करके आगे', 'Save karke aage')} />
    </div>
  );
}

/* ---------- 3. customers ---------- */
function CustomersStep({ onBack, onSkip, onSaved }: { onBack: () => void; onSkip: () => void; onSaved: () => void }) {
  const { t, err } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [mode, setMode] = useState<'type' | 'file'>('type');
  const [rows, setRows] = useState([{ name: '', phone: '', due: '' }, { name: '', phone: '', due: '' }, { name: '', phone: '', due: '' }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const setRow = (i: number, k: 'name' | 'phone' | 'due', v: string) => setRows(rows.map((r, j) => j === i ? { ...r, [k]: v } : r));
  const filled = rows.filter((r) => r.name.trim());
  const save = async () => {
    if (!filled.length) { onSkip(); return; }
    setBusy(true); setError('');
    // Same pipeline as file import: preview-free commit, backup first,
    // opening udhaar recorded as a proper opening balance.
    const csv = 'Name,Phone,Opening Balance\n' + filled.map((r) => [r.name.trim(), r.phone.trim(), String(Number(r.due) || 0)].map(csvCell).join(',')).join('\n');
    try {
      const r = await post<{ created: number; skipped: number; error_count: number }>('/api/import/customers/commit', { content: csv, duplicate: 'skip' });
      ['customers', 'dash-summary', 'alerts'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast({ text: t(`${r.created} customers added`, `${r.created} ग्राहक जुड़े`, `${r.created} customer jude`) });
      onSaved();
    } catch (x) { setError(err(x)); } finally { setBusy(false); }
  };
  return (
    <div className="stack" style={{ gap: 18 }}>
      <StepHead icon={<Users size={20} />} title={t('Add your regular customers', 'अपने पक्के ग्राहक जोड़ें', 'Apne pakke customer jodo')}
        sub={t('Optional. Add the people who buy on credit, with any udhaar they already owe. You can also do this later from Customers.', 'चाहें तो। उधार लेने वाले ग्राहक, पुराने बकाया के साथ जोड़ें। बाद में Customers से भी कर सकते हैं।', 'Optional. Udhaar lene wale customer, purane baaki ke saath jodo. Baad me Customers se bhi kar sakte ho.')} />
      <div className="seg-mini" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'type'} className={mode === 'type' ? 'on' : ''} onClick={() => setMode('type')}>{t('Type them in', 'हाथ से लिखें', 'Haath se likho')}</button>
        <button type="button" role="tab" aria-selected={mode === 'file'} className={mode === 'file' ? 'on' : ''} onClick={() => setMode('file')}><Upload size={14} /> {t('Import a file', 'फ़ाइल इम्पोर्ट करें', 'File import karo')}</button>
      </div>
      {mode === 'type' ? (
        <div className="sg-rows">
          <div className="sg-row sg-row-head"><span>{t('Name', 'नाम', 'Naam')}</span><span>{t('Phone', 'फ़ोन', 'Phone')}</span><span>{t('Old udhaar ₹', 'पुराना उधार ₹', 'Purana udhaar ₹')}</span><span /></div>
          {rows.map((r, i) => (
            <div className="sg-row" key={i}>
              <Input aria-label={t('Name', 'नाम', 'Naam')} value={r.name} onChange={(e) => setRow(i, 'name', e.target.value)} placeholder={i === 0 ? 'Ramesh Gupta' : ''} />
              <Input aria-label={t('Phone', 'फ़ोन', 'Phone')} type="tel" inputMode="tel" value={r.phone} onChange={(e) => setRow(i, 'phone', e.target.value)} placeholder={i === 0 ? '98110 24681' : ''} />
              <Input aria-label={t('Old udhaar', 'पुराना उधार', 'Purana udhaar')} inputMode="decimal" value={r.due} onChange={(e) => setRow(i, 'due', e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" />
              <button type="button" className="icon-btn icon-btn-sm" aria-label={t('Remove row', 'पंक्ति हटाएं', 'Row hatao')} onClick={() => setRows(rows.length > 1 ? rows.filter((_, j) => j !== i) : [{ name: '', phone: '', due: '' }])}><Trash2 size={15} /></button>
            </div>
          ))}
          <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={() => setRows([...rows, { name: '', phone: '', due: '' }])}>{t('Add another', 'एक और जोड़ें', 'Ek aur jodo')}</Button>
        </div>
      ) : (
        <div className="sg-box"><ImportForm types={['customers']} onDone={onSaved} /></div>
      )}
      {error && <div className="banner banner-owed" role="alert">{error}</div>}
      <StepFoot onBack={onBack} onSkip={onSkip} busy={busy} onPrimary={mode === 'type' ? save : onSkip}
        primary={mode === 'type' && filled.length ? t(`Save ${filled.length} and continue`, `${filled.length} सेव करके आगे`, `${filled.length} save karke aage`) : t('Continue', 'आगे', 'Aage')} />
    </div>
  );
}

/* ---------- 4. team ---------- */
function makePassword() {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = ''; const r = new Uint32Array(10); crypto.getRandomValues(r);
  r.forEach((n) => { s += a[n % a.length]; });
  return s;
}
function TeamStep({ onBack, onSkip, onSaved }: { onBack: () => void; onSkip: () => void; onSaved: () => void }) {
  const { t, err } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const blank = () => ({ name: '', email: '', password: makePassword(), access: 'billing' });
  const [rows, setRows] = useState([blank()]);
  const [added, setAdded] = useState<{ name: string; email: string; password: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const setRow = (i: number, k: 'name' | 'email' | 'password' | 'access', v: string) => setRows(rows.map((r, j) => j === i ? { ...r, [k]: v } : r));
  const filled = rows.filter((r) => r.name.trim() || r.email.trim());
  const save = async () => {
    if (!filled.length) { onSkip(); return; }
    for (const r of filled) {
      if (!r.name.trim() || !/^\S+@\S+\.\S+$/.test(r.email.trim())) { setError(t('Each staff member needs a name and a working email to log in with.', 'हर स्टाफ़ का नाम और login के लिए सही email चाहिए।', 'Har staff ka naam aur login ke liye sahi email chahiye.')); return; }
      if (r.password.length < 8) { setError(t('Passwords need at least 8 characters.', 'Password कम से कम 8 अक्षर का।', 'Password kam se kam 8 character ka.')); return; }
    }
    setBusy(true); setError('');
    const ok: typeof added = [];
    try {
      for (const r of filled) {
        await post('/api/staff', { name: r.name.trim(), email: r.email.trim(), password: r.password, access: r.access });
        ok.push({ name: r.name.trim(), email: r.email.trim(), password: r.password });
      }
      qc.invalidateQueries({ queryKey: ['staff'] });
      setAdded([...added, ...ok]); setRows([blank()]);
      toast({ text: t('Team added', 'टीम जुड़ गई', 'Team jud gayi') });
    } catch (x) {
      setAdded([...added, ...ok]);
      setRows(filled.filter((r) => !ok.some((o) => o.email === r.email.trim())));
      setError(err(x));
    } finally { setBusy(false); }
  };
  return (
    <div className="stack" style={{ gap: 18 }}>
      <StepHead icon={<UserPlus size={20} />} title={t('Add your team', 'अपनी टीम जोड़ें', 'Apni team jodo')}
        sub={t('Optional. Each person gets their own login. Choose what they can do — profit and reports stay with you.', 'चाहें तो। हर व्यक्ति का अपना login। तय करें वे क्या कर सकते हैं — मुनाफ़ा और रिपोर्ट सिर्फ़ आपके पास।', 'Optional. Har insaan ka apna login. Tay karo wo kya kar sakte hain — profit aur report sirf aapke paas.')} />
      {!!added.length && (
        <div className="sg-added">
          <b>{t('Share these logins with your team', 'ये login अपनी टीम को दें', 'Ye login apni team ko do')}</b>
          {added.map((a) => <div key={a.email} className="sg-added-row"><span>{a.name}</span><code>{a.email}</code><code>{a.password}</code></div>)}
        </div>
      )}
      <div className="sg-rows">
        <div className="sg-row sg-row-team sg-row-head"><span>{t('Name', 'नाम', 'Naam')}</span><span>{t('Email (to log in)', 'Email (login के लिए)', 'Email (login ke liye)')}</span><span>{t('Password', 'पासवर्ड', 'Password')}</span><span>{t('Can do', 'क्या कर सकते हैं', 'Kya kar sakte')}</span><span /></div>
        {rows.map((r, i) => (
          <div className="sg-row sg-row-team" key={i}>
            <Input aria-label={t('Name', 'नाम', 'Naam')} value={r.name} onChange={(e) => setRow(i, 'name', e.target.value)} placeholder={i === 0 ? 'Raju' : ''} />
            <Input aria-label="Email" type="email" value={r.email} onChange={(e) => setRow(i, 'email', e.target.value)} placeholder={i === 0 ? 'raju@gmail.com' : ''} />
            <div className="sg-pass"><Input aria-label={t('Password', 'पासवर्ड', 'Password')} value={r.password} onChange={(e) => setRow(i, 'password', e.target.value)} /><button type="button" className="icon-btn icon-btn-sm" title={t('New password', 'नया पासवर्ड', 'Naya password')} aria-label={t('New password', 'नया पासवर्ड', 'Naya password')} onClick={() => setRow(i, 'password', makePassword())}><KeyRound size={14} /></button></div>
            <Select aria-label={t('Can do', 'क्या कर सकते हैं', 'Kya kar sakte')} value={r.access} onChange={(e) => setRow(i, 'access', e.target.value)}>
              <option value="billing">{t('Billing only', 'सिर्फ़ बिलिंग', 'Sirf billing')}</option>
              <option value="stock">{t('Stock only', 'सिर्फ़ स्टॉक', 'Sirf stock')}</option>
              <option value="all">{t('Billing + stock', 'बिलिंग + स्टॉक', 'Billing + stock')}</option>
            </Select>
            <button type="button" className="icon-btn icon-btn-sm" aria-label={t('Remove row', 'पंक्ति हटाएं', 'Row hatao')} onClick={() => setRows(rows.length > 1 ? rows.filter((_, j) => j !== i) : [blank()])}><Trash2 size={15} /></button>
          </div>
        ))}
        <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={() => setRows([...rows, blank()])}>{t('Add another', 'एक और जोड़ें', 'Ek aur jodo')}</Button>
      </div>
      {error && <div className="banner banner-owed" role="alert">{error}</div>}
      {filled.length ? (
        <StepFoot onBack={onBack} onSkip={onSkip} busy={busy} onPrimary={save} primary={t('Add team', 'टीम जोड़ें', 'Team jodo')} />
      ) : (
        <StepFoot onBack={onBack} onSkip={added.length ? undefined : onSkip} onPrimary={added.length ? onSaved : onSkip} primary={t('Continue', 'आगे', 'Aage')} />
      )}
    </div>
  );
}

/* ---------- 5. done ---------- */
function DoneStep({ business, onOpen, onEdit, onFirstBill }: { business: Business; onOpen: () => void; onEdit: (k: StepKey) => void; onFirstBill: () => void }) {
  const { t } = useI18n();
  useEffect(() => { document.title = 'BizYour'; }, []);
  const items: { ok: boolean; label: string; step: StepKey }[] = [
    { ok: true, label: t(`${business.name}, ${business.city}`, `${business.name}, ${business.city}`, `${business.name}, ${business.city}`), step: 'shop' },
    { ok: !!business.gst_enabled, label: business.gst_enabled ? `GSTIN ${business.gstin}` : t('GST bills: off', 'GST बिल: बंद', 'GST bill: band'), step: 'billing' },
    { ok: !!business.logo, label: business.logo ? t('Shop logo added — it prints on your bills', 'दुकान का लोगो जुड़ा — बिल पर छपेगा', 'Dukaan ka logo juda — bill pe chhapega') : t('Shop logo: not added (bills show your first letter)', 'दुकान का लोगो: नहीं डाला (बिल पर पहला अक्षर)', 'Dukaan ka logo: nahi daala (bill pe pehla akshar)'), step: 'shop' },
    { ok: !!(business.upi_id || business.payment_qr), label: business.upi_id ? `UPI ${business.upi_id}` : business.payment_qr ? t('UPI QR uploaded', 'UPI QR डाला', 'UPI QR daala') : t('UPI: not added', 'UPI: नहीं डाला', 'UPI: nahi daala'), step: 'billing' }
  ];
  return (
    <div className="stack sg-done" style={{ gap: 18 }}>
      <span className="sg-done-ic"><PartyPopper size={28} /></span>
      <h1>{t('Your shop is ready', 'आपकी दुकान तैयार है', 'Aapki dukaan taiyaar hai')}</h1>
      <p className="muted">{t('Your 30-day free trial has started. Here is what we have:', 'आपका 30 दिन का मुफ़्त trial शुरू हो गया। यह सब सेट है:', 'Aapka 30 din ka free trial shuru ho gaya. Ye sab set hai:')}</p>
      <ul className="sg-summary">
        {items.map((i) => (
          <li key={i.label} className={i.ok ? 'ok' : ''}>
            <CircleCheck size={16} /><span>{i.label}</span>
            {!i.ok && <button type="button" className="link-btn" onClick={() => onEdit(i.step)}>{t('Add', 'जोड़ें', 'Jodo')}</button>}
          </li>
        ))}
      </ul>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <Button variant="primary" size="lg" onClick={onFirstBill}><ReceiptText size={16} /> {t('Make my first bill', 'पहला बिल बनाएं', 'Pehla bill banao')}</Button>
        <Button size="lg" onClick={onOpen}>{t('Open Workspace', 'Workspace खोलें', 'Workspace kholo')} <ArrowRight size={16} /></Button>
      </div>
    </div>
  );
}
