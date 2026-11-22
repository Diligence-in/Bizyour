import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Store } from 'lucide-react';
import { post } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';
import { picked } from '../lib/mode';
import type { Business, Lang, Subscription } from '../lib/types';
import { Button, Field, Input, Select } from '../components/ui';

// Shop setup — the second stage of the two-stage workflow. A BizYour
// account (signup + email OTP) opens Business Mart buying immediately;
// the Workspace — and its 30-day free trial — starts only when the owner
// completes this form (POST /api/workspace/activate). Everything here can
// be changed later in Settings.

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

export function SetupPage() {
  const { t, err, setLang, lang } = useI18n();
  const { me, setBusiness, logout } = useSession();
  const nav = useNavigate();
  const loc = useLocation();
  const qc = useQueryClient();
  const b = me?.business;
  const [f, setF] = useState({
    name: b?.name || '', owner_name: b?.owner_name || me?.user.name || '',
    phone: me?.user.mobile || b?.phone || '', category: b?.category || 'kirana',
    address: b?.address || '', landmark: b?.landmark || '', pincode: b?.pincode || '',
    city: b?.city || '', state: b?.state || '', gst_enabled: !!b?.gst_enabled, gstin: b?.gstin || ''
  });
  const [language, setLanguage] = useState<Lang>(lang);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: 'name' | 'owner_name' | 'phone' | 'address' | 'landmark' | 'pincode' | 'city' | 'gstin') => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: k === 'gstin' ? e.target.value.toUpperCase() : e.target.value });
  const setSel = (k: 'category' | 'state') => (e: React.ChangeEvent<HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const catLabel = (c: string) => ({
    kirana: t('Kirana / General Store', 'किराना / जनरल स्टोर', 'Kirana / General Store'),
    electronics: t('Electronics', 'इलेक्ट्रॉनिक्स', 'Electronics'),
    mobile: t('Mobile & Accessories', 'मोबाइल और एक्सेसरीज़', 'Mobile & Accessories'),
    medical: t('Medical / Pharmacy', 'मेडिकल / फ़ार्मेसी', 'Medical / Pharmacy'),
    garments: t('Garments / Fashion', 'कपड़े / फ़ैशन', 'Garments / Fashion'),
    food: t('Food / Restaurant', 'खाना / रेस्टोरेंट', 'Food / Restaurant'),
    hardware: t('Hardware', 'हार्डवेयर', 'Hardware'),
    beauty: t('Beauty / Salon', 'ब्यूटी / सैलून', 'Beauty / Salon'),
    services: t('Services', 'सर्विसेज़', 'Services'),
    other: t('Other', 'अन्य', 'Other')
  } as Record<string, string>)[c] || c;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (f.name.trim().length < 3) { setError(t('Write your shop’s name — it prints on every bill.', 'दुकान का नाम लिखें — हर बिल पर छपेगा।', 'Dukaan ka naam likho — har bill pe chhapega.')); return; }
    if (f.gst_enabled && !GSTIN_RE.test(f.gstin.trim())) { setError(t('GST bills need your GSTIN. It has 15 characters, like 07ABCDE1234F1Z5.', 'GST बिल के लिए GSTIN चाहिए। 15 अक्षर, जैसे 07ABCDE1234F1Z5।', 'GST bill ke liye GSTIN chahiye. 15 character, jaise 07ABCDE1234F1Z5.')); return; }
    setBusy(true); setError('');
    try {
      const r = await post<{ business: Business; subscription: Subscription }>('/api/workspace/activate', {
        ...f, name: f.name.trim(), gstin: f.gst_enabled ? f.gstin.trim() : '', language
      });
      setLang(language);
      setBusiness(r.business);
      qc.invalidateQueries({ queryKey: ['subscription'] });
      picked();
      const from = (loc.state as { from?: string } | null)?.from;
      nav(from && from !== '/setup' ? from : '/', { replace: true });
    } catch (x) { setError(err(x)); } finally { setBusy(false); }
  };

  const langs: { v: Lang; title: string; sub: string }[] = [
    { v: 'en', title: 'English', sub: 'Simple English' },
    { v: 'hi', title: 'हिंदी', sub: 'हिंदी में चलेगा' },
    { v: 'hg', title: 'Hinglish', sub: 'Hindi + English mix' }
  ];
  return (
    <div className="setup-wrap">
      <div className="setup-card">
        <span className="auth-icon"><Store size={22} /></span>
        <h1>{t('Set up your shop', 'अपनी दुकान सेट करें', 'Apni dukaan set karo')}</h1>
        <p className="muted" style={{ marginTop: 6, marginBottom: 24 }}>{t('Two minutes. Your 30-day free trial starts the moment you finish — this is what prints on your bills, and you can change it any time in Settings.', 'दो मिनट। ख़त्म करते ही आपका 30 दिन का मुफ़्त trial शुरू — यही आपके बिल पर छपेगा, बाद में Settings में बदल सकते हैं।', 'Do minute. Khatm karte hi aapka 30 din ka free trial shuru — yahi aapke bill pe chhapega, baad me Settings me badal sakte ho.')}</p>
        {(loc.state as { from?: string } | null)?.from && (
          <div className="banner" role="status" style={{ marginBottom: 16 }}>{t('The Workspace opens after shop setup — finish this first.', 'Workspace दुकान setup के बाद खुलेगा — पहले यह पूरा करें।', 'Workspace dukaan setup ke baad khulega — pehle ye poora karo.')}</div>
        )}
        <form onSubmit={submit} className="stack" style={{ gap: 16 }}>
          <Field label={t('Shop name', 'दुकान का नाम', 'Dukaan ka naam')}>{(id) => <Input id={id} size2="lg" value={f.name} onChange={set('name')} placeholder={t('e.g. Sharma General Store', 'जैसे शर्मा जनरल स्टोर', 'jaise Sharma General Store')} autoFocus />}</Field>
          <div className="form-2">
            <Field label={t('Owner name', 'मालिक का नाम', 'Owner ka naam')}>{(id) => <Input id={id} value={f.owner_name} onChange={set('owner_name')} />}</Field>
            <Field label={t('Shop category', 'दुकान की category', 'Dukaan ki category')}>{(id) => (
              <Select id={id} value={f.category} onChange={setSel('category')}>
                {SHOP_CATEGORIES.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
              </Select>
            )}</Field>
          </div>
          <Field label={t('Shop WhatsApp number', 'दुकान का WhatsApp नंबर', 'Dukaan ka WhatsApp number')} hint={t('Customers reach you on this number from the Mart and bills.', 'ग्राहक Mart और बिल से इसी नंबर पर बात करेंगे।', 'Customer Mart aur bill se isi number par baat karenge.')}>{(id) => <Input id={id} type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="98XXXXXXXX" />}</Field>
          <Field label={t('Shop address', 'दुकान का पता', 'Dukaan ka address')}>{(id) => <Input id={id} value={f.address} onChange={set('address')} placeholder={t('Shop no, street, area', 'दुकान नंबर, गली, इलाक़ा', 'Shop no, gali, area')} />}</Field>
          <Field label={t('Landmark (optional)', 'आस-पास की पहचान (चाहें तो)', 'Landmark (chaaho to)')}>{(id) => <Input id={id} value={f.landmark} onChange={set('landmark')} />}</Field>
          <div className="form-2">
            <Field label={t('PIN code', 'PIN code', 'PIN code')}>{(id) => <Input id={id} inputMode="numeric" maxLength={6} value={f.pincode} onChange={set('pincode')} placeholder="110001" />}</Field>
            <Field label={t('City', 'शहर', 'Shehar')}>{(id) => <Input id={id} value={f.city} onChange={set('city')} />}</Field>
          </div>
          <Field label={t('State', 'राज्य', 'State')}>{(id) => (
            <Select id={id} value={f.state} onChange={setSel('state')}>
              <option value="">{t('Choose your state', 'अपना राज्य चुनें', 'Apna state chuno')}</option>
              {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          )}</Field>
          <label className="check">
            <input type="checkbox" checked={f.gst_enabled} onChange={(e) => setF({ ...f, gst_enabled: e.target.checked })} />
            <span><b>{t('I make GST bills', 'मैं GST बिल बनाता हूं', 'Main GST bill banata hoon')}</b><br /><span className="muted">{t('Prices stay GST-inclusive; bills show the GST part and CGST/SGST.', 'भाव GST सहित रहेंगे; बिल पर GST और CGST/SGST दिखेगा।', 'Bhaav GST sahit rahenge; bill pe GST aur CGST/SGST dikhega.')}</span></span>
          </label>
          {f.gst_enabled && <Field label="GSTIN">{(id) => <Input id={id} value={f.gstin} onChange={set('gstin')} maxLength={15} placeholder="07ABCDE1234F1Z5" />}</Field>}
          <div className="field">
            <span className="field-label">{t('App language', 'App की भाषा', 'App ki bhasha')}</span>
            <div className="lang-pick" role="radiogroup" aria-label={t('App language', 'App की भाषा', 'App ki bhasha')}>
              {langs.map((l) => (
                <button type="button" key={l.v} role="radio" aria-checked={language === l.v} className={language === l.v ? 'on' : ''} onClick={() => { setLanguage(l.v); setLang(l.v); }}>
                  <b>{l.title}</b><span>{l.sub}</span>
                </button>
              ))}
            </div>
          </div>
          {error && <div className="banner banner-owed" role="alert">{error}</div>}
          <Button type="submit" variant="primary" size="lg" block loading={busy}>{t('Start my shop — 30 days free', 'मेरी दुकान शुरू करें — 30 दिन मुफ़्त', 'Meri dukaan shuru karo — 30 din free')}</Button>
        </form>
        <div style={{ marginTop: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Link className="link-btn" to="/mart">{t('Open Business Mart instead', 'इसके बजाय Business Mart खोलें', 'Iske bajaye Business Mart kholo')} →</Link>
          <button className="link-btn" onClick={logout}>{t('Log out', 'लॉग आउट', 'Log out')}</button>
        </div>
      </div>
    </div>
  );
}
