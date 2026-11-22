import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Lang } from './types';
import { ApiError } from './api';

// Three languages, same as the classic app: English, हिंदी, Hinglish.
// Strings are written next to the UI that uses them: t(en, hi, hg?).
// Hinglish falls back to English when not given (as product names, numbers
// and most UI words read the same). The choice is shared with the classic
// app through localStorage 'bos_lang'.

const LANG_KEY = 'bos_lang';
function readLang(): Lang | null {
  try { const v = localStorage.getItem(LANG_KEY); return v === 'hi' || v === 'hg' || v === 'en' ? v : null; } catch { return null; }
}

export type T = (en: string, hi: string, hg?: string) => string;

interface Ctx { lang: Lang; setLang: (l: Lang) => void; t: T; err: (e: unknown) => string }
const I18n = createContext<Ctx | null>(null);

// Server error codes → people-readable messages.
const ERRORS: Record<string, [string, string, string]> = {
  network_error: ['Can’t reach the BizYour server. Check that it’s running or that you’re online.', 'BizYour server से जुड़ नहीं पा रहे। देखें कि server चल रहा है या internet है।', 'BizYour server se connect nahi ho raha. Server chal raha hai ya internet hai, check karo.'],
  'invalid email or password': ['That email/mobile and password don’t match.', 'Email/mobile और password मेल नहीं खाते।', 'Email/mobile aur password match nahi hue.'],
  too_many_requests: ['Too many attempts. Wait a few minutes, then try again.', 'बहुत ज़्यादा कोशिशें। कुछ मिनट रुककर फिर कोशिश करें।', 'Bahut zyada koshish. Kuch minute ruk kar phir try karo.'],
  session_expired: ['You were logged out after 30 days. Log in again.', '30 दिन बाद आप logout हो गए। फिर से login करें।', '30 din baad logout ho gaye. Phir se login karo.'],
  too_many_attempts: ['Too many wrong tries — this login is locked for a few minutes.', 'बहुत ज़्यादा गलत कोशिशें — यह login कुछ मिनट के लिए बंद है।', 'Bahut zyada galat koshish — ye login kuch minute ke liye band hai.'],
  workspace_not_setup: ['Set up your shop first — the Workspace opens after shop setup.', 'पहले दुकान का setup करें — Workspace setup के बाद खुलेगा।', 'Pehle dukaan ka setup karo — Workspace setup ke baad khulega.'],
  shop_name_required: ['Shop name is needed (at least 3 letters).', 'दुकान का नाम चाहिए (कम से कम 3 अक्षर)।', 'Dukaan ka naam chahiye (kam se kam 3 akshar).'],
  invalid_category: ['Pick your shop category.', 'दुकान की category चुनें।', 'Dukaan ki category chuno.'],
  address_required: ['Full shop address is needed.', 'दुकान का पूरा पता चाहिए।', 'Dukaan ka poora address chahiye.'],
  invalid_pincode: ['PIN code must be 6 digits.', 'PIN code 6 अंकों का होना चाहिए।', 'PIN code 6 digit ka hona chahiye.'],
  city_required: ['City is needed.', 'शहर चाहिए।', 'City chahiye.'],
  invalid_state: ['Pick your state.', 'अपना राज्य चुनें।', 'Apna state chuno.'],
  invalid_gstin: ['That GSTIN does not look right — check and try again.', 'GSTIN सही नहीं लग रहा — जाँचकर फिर डालें।', 'GSTIN sahi nahi lag raha — check karke phir daalo.'],
  email_not_verified: ['Verify your email first — finish signup in the classic app.', 'पहले email verify करें।', 'Pehle email verify karo.'],
  account_blocked: ['This account is blocked. Contact BizYour support.', 'यह account बंद है। BizYour support से बात करें।', 'Ye account block hai. BizYour support se baat karo.'],
  subscription_expired: ['Your Workspace plan has ended, so Workspace is read-only. Business Mart still works. Renew in Settings to add entries.', 'Workspace plan खत्म — Workspace सिर्फ़ देखने के लिए। Business Mart चालू है। entry के लिए Settings में renew करें।', 'Workspace plan khatam — Workspace sirf dekhne ke liye. Business Mart chalu hai. Entry ke liye Settings me renew karo.'],
  insufficient_stock: ['Not enough stock for one of the items.', 'किसी सामान का stock कम है।', 'Kisi saaman ka stock kam hai.'],
  owner_only: ['Only the owner can do this.', 'यह सिर्फ़ मालिक कर सकते हैं।', 'Ye sirf owner kar sakta hai.'],
  billing_access_only: ['Your staff access doesn’t include billing.', 'आपके access में billing नहीं है।', 'Aapke access me billing nahi hai.'],
  stock_access_only: ['Your staff access doesn’t include stock.', 'आपके access में stock नहीं है।', 'Aapke access me stock nahi hai.'],
  password_too_short: ['Use at least 8 characters for the password.', 'Password कम से कम 8 अक्षर का रखें।', 'Password kam se kam 8 character ka rakho.']
};

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Lang }) {
  const [lang, setLangState] = useState<Lang>(readLang() || initial || 'en');
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
    document.documentElement.lang = l === 'hi' ? 'hi' : 'en';
  }, []);
  const t = useCallback<T>((en, hi, hg) => (lang === 'hi' ? hi : lang === 'hg' ? hg ?? en : en), [lang]);
  const err = useCallback((e: unknown) => {
    const code = e instanceof ApiError ? (String(e.data?.code || '') || e.code) : 'network_error';
    const m = ERRORS[code];
    if (m) return lang === 'hi' ? m[1] : lang === 'hg' ? m[2] : m[0];
    if (e instanceof ApiError && e.code && !e.code.startsWith('http_')) {
      const s = e.code.replace(/_/g, ' ');
      return s.charAt(0).toUpperCase() + s.slice(1) + '.';
    }
    return t('Something went wrong. Try again.', 'कुछ गड़बड़ हुई। फिर कोशिश करें।', 'Kuch gadbad hui. Phir try karo.');
  }, [lang, t]);
  const v = useMemo(() => ({ lang, setLang, t, err }), [lang, setLang, t, err]);
  return <I18n.Provider value={v}>{children}</I18n.Provider>;
}

export function useI18n() {
  const c = useContext(I18n);
  if (!c) throw new Error('I18nProvider missing');
  return c;
}
