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
  password_too_short: ['Use at least 8 characters for the password.', 'Password कम से कम 8 अक्षर का रखें।', 'Password kam se kam 8 character ka rakho.'],
  wrong_password: ['That password is not correct.', 'यह password सही नहीं है।', 'Ye password sahi nahi hai.'],
  // import
  name_column_not_found: ['We could not find a Name column. Add a header row with “Name” (download the sample file to see the format).', 'Name वाला कॉलम नहीं मिला। सबसे ऊपर “Name” वाली header पंक्ति रखें (नमूना फ़ाइल देखें)।', 'Name wala column nahi mila. Sabse upar “Name” wali header row rakho (sample file dekho).'],
  too_many_rows: ['That file has too many rows. Split it into files of up to 5,000 rows.', 'फ़ाइल में बहुत पंक्तियाँ हैं। 5,000 तक की फ़ाइलों में बाँटें।', 'File me bahut rows hain. 5,000 tak ki files me baanto.'],
  empty_file: ['That file is empty.', 'फ़ाइल खाली है।', 'File khaali hai.'],
  invalid_xlsx: ['That Excel file could not be read. Save it again as .xlsx or CSV.', 'Excel फ़ाइल नहीं खुली। .xlsx या CSV में दोबारा सेव करें।', 'Excel file nahi khuli. .xlsx ya CSV me dobara save karo.'],
  xlsx_not_available: ['Excel files are not available right now. Save as CSV and try again.', 'अभी Excel नहीं चल रहा। CSV में सेव करके डालें।', 'Abhi Excel nahi chal raha. CSV me save karke daalo.'],
  no_valid_rows: ['No row in the file could be imported. Check the problems listed.', 'फ़ाइल की कोई पंक्ति नहीं चढ़ी। गलतियाँ देखें।', 'File ki koi row nahi chadhi. Galtiyan dekho.'],
  unknown_import_type: ['That kind of import is not supported.', 'यह import नहीं होता।', 'Ye import nahi hota.'],
  import_failed: ['The import failed and nothing was changed. Please try again.', 'Import नहीं हुआ, कुछ नहीं बदला। फिर कोशिश करें।', 'Import nahi hua, kuch nahi badla. Phir koshish karo.'],
  not_seller: ['Set up your seller profile on Business Mart first.', 'पहले Business Mart पर seller profile बनाएं।', 'Pehle Business Mart pe seller profile banao.'],
  invalid_logo_image: ['That logo is not a JPG or PNG image.', 'लोगो JPG या PNG तस्वीर नहीं है।', 'Logo JPG ya PNG tasveer nahi hai.'],
  logo_image_too_large: ['That logo is too large. Try a smaller image.', 'लोगो बहुत बड़ा है। छोटी तस्वीर डालें।', 'Logo bahut bada hai. Chhoti tasveer daalo.'],
  invalid_shop_photo_image: ['That shop photo is not a JPG or PNG image.', 'दुकान की फ़ोटो JPG या PNG नहीं है।', 'Dukaan ki photo JPG ya PNG nahi hai.'],
  shop_photo_image_too_large: ['That shop photo is too large. Try a smaller photo.', 'दुकान की फ़ोटो बहुत बड़ी है। छोटी फ़ोटो डालें।', 'Dukaan ki photo bahut badi hai. Chhoti photo daalo.']
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
