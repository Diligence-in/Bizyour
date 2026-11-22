import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, Bell, BookOpenText, Calculator, Check, ChevronDown, CircleCheck, DatabaseBackup,
  Languages, MessageCircle, Moon, Package, Receipt, RotateCcw, Shirt, ShoppingCart, Smartphone, Store,
  Sun, Sunrise, Sunset, Upload, Users, Warehouse, WifiOff, Wrench, X
} from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { LangSwitch } from '../components/shell/AppShell';
import '../styles/landing.css';

// Public home page at bizyour.in for visitors who are not logged in.
// v2: the clean "Ledger" look of v1, made illustrative and interactive.
// Real app screens sit inside a MacBook; live, hand-built mini screens sit
// inside an iPhone. Every section of the original landing page is kept.
// Business Mart is free forever, only Workspace has the 30-day trial.

/* ---------- small hooks ---------- */
const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/** true once the element has scrolled into view */
function useInView<T extends Element>(threshold = 0.25) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) { setInView(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

/** cycles 0..count-1 while `run`; stops for good once the visitor picks one */
function useAutoStep(count: number, ms: number, run: boolean) {
  const [i, setI] = useState(0);
  const [manual, setManual] = useState(false);
  useEffect(() => {
    if (!run || manual || reducedMotion()) return;
    const id = window.setInterval(() => setI((v) => (v + 1) % count), ms);
    return () => window.clearInterval(id);
  }, [run, manual, count, ms]);
  return { i, pick: (k: number) => { setManual(true); setI(k); } };
}

function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const [ref, inView] = useInView<HTMLDivElement>(0.15);
  return <div ref={ref} className={`rv ${inView ? 'in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

/* ---------- top bar: blends with whatever is under it ---------- */
// Transparent over the blue wash at the top, frosted page-colour glass once
// you scroll, and dark glass with white text while a dark section (the team
// band) passes under it — so the bar never looks like a separate strip.
function useNavTone() {
  const [state, setState] = useState<{ scrolled: boolean; dark: boolean }>({ scrolled: false, dark: false });
  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const nav = document.querySelector('.lp-nav-wrap') as HTMLElement | null;
      const h = nav ? nav.offsetHeight : 64;
      const probe = h / 2;
      let dark = false;
      document.querySelectorAll<HTMLElement>('[data-nav-tone="dark"]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top <= probe && r.bottom >= probe) dark = true;
      });
      const scrolled = window.scrollY > 8;
      setState((s0) => (s0.scrolled === scrolled && s0.dark === dark ? s0 : { scrolled, dark }));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(check); };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return state;
}

/* ---------- logo intro: once per browser session ---------- */
const INTRO_KEY = 'bos_intro_seen';
/* ---------- contact us: apna number aur email yahan bharo ---------- */
const CONTACT_PHONE_DISPLAY = '+91 8506059604';
const CONTACT_PHONE_LINK = '+918506059604';
const CONTACT_EMAIL = 'diligence.in@zohomail.in';
function Intro({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const a = window.setTimeout(() => setLeaving(true), 2100);
    const b = window.setTimeout(onDone, 2750);
    const skip = () => { setLeaving(true); window.setTimeout(onDone, 500); };
    window.addEventListener('keydown', skip, { once: true });
    return () => { window.clearTimeout(a); window.clearTimeout(b); window.removeEventListener('keydown', skip); };
  }, [onDone]);
  return (
    <div className={`intro ${leaving ? 'intro-out' : ''}`} onClick={() => { setLeaving(true); window.setTimeout(onDone, 500); }} data-testid="intro" aria-hidden>
      <div className="intro-lock">
        <img src="/bizyour-mark-512.png?v=c" alt="" className="intro-mark" width={96} height={96} />
        <div className="intro-word">Biz<span>Your</span></div>
        <div className="intro-rule" />
        <div className="intro-by">by DILIGENCE</div>
      </div>
    </div>
  );
}

function useIntro() {
  const [show, setShow] = useState(() => {
    try {
      if (sessionStorage.getItem(INTRO_KEY)) return false;
      if (reducedMotion()) return false;
      return true;
    } catch { return false; }
  });
  const done = () => { try { sessionStorage.setItem(INTRO_KEY, '1'); } catch { /* ignore */ } setShow(false); };
  return { show, done };
}

/* ---------- devices ---------- */
function MacBook({ children, label }: { children: ReactNode; label: string }) {
  return (
    <figure className="mac" aria-label={label}>
      <div className="mac-lid"><div className="mac-screen">{children}</div></div>
      <div className="mac-base" aria-hidden />
    </figure>
  );
}

function IPhone({ children, className = '', label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <div className={`iph ${className}`} role="img" aria-label={label}>
      <div className="iph-screen">
        <div className="iph-status" aria-hidden><span>9:41</span><span className="iph-icons"><i /><i /><i /></span></div>
        <div className="iph-island" aria-hidden />
        <div className="iph-body">{children}</div>
      </div>
    </div>
  );
}

/** the app's own top bar, shrunk for the phone */
function PhoneBar({ title, sub, mart }: { title: string; sub?: string; mart?: boolean }) {
  return (
    <div className={`pb ${mart ? 'pb-mart' : ''}`}>
      <img src="/bizyour-mark-512.png?v=c" alt="" width={20} height={20} />
      <div><b>{title}</b>{sub && <small>{sub}</small>}</div>
    </div>
  );
}

/* ---------- hero: a bill being made, live, on the phone ---------- */
const BILL_ROWS: [string, number, number][] = [
  ['Aashirvaad Atta 5kg', 2, 590],
  ['Tata Salt 1kg', 4, 112],
  ['Fortune Soya Oil 1L', 3, 495],
  ['Parle-G 800g', 2, 180]
];
const inr = (n: number) => '₹' + n.toLocaleString('en-IN');

function HeroStage() {
  const { t } = useI18n();
  const [ref, inView] = useInView<HTMLDivElement>(0.2);
  const [step, setStep] = useState(0); // 0 empty · 1–4 rows · 5 total · 6 paid
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (reducedMotion()) { setStep(6); return; }
    setStep(0);
    const ids = [1, 2, 3, 4, 5, 6].map((s) => window.setTimeout(() => setStep(s), 500 + s * (s < 5 ? 550 : 800)));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [inView, run]);
  const shown = BILL_ROWS.slice(0, Math.min(step, 4));
  const total = shown.reduce((s, r) => s + r[2], 0);

  return (
    <div className="hero-stage" ref={ref}>
      <MacBook label={t('BizYour home screen on a laptop', 'लैपटॉप पर BizYour होम स्क्रीन', 'Laptop pe BizYour home screen')}>
        <img src="/landing/home.webp?v=c" alt={t('The Workspace home screen: today’s sale, udhaar to collect and low stock', 'Workspace होम: आज की बिक्री, वसूली और कम स्टॉक', 'Workspace home: aaj ki bikri, vasooli aur kam stock')} width={1400} height={875} />
      </MacBook>

      <IPhone className="hero-phone" label={t('A bill being made on a phone', 'फ़ोन पर बनता हुआ बिल', 'Phone pe banta hua bill')}>
        <PhoneBar title="Sharma General Store" sub="INV-0142 · GSTIN 07ABCDE1234F1Z5" />
        <div className="pbill">
          <div className="pbill-head"><span>{t('Item', 'सामान', 'Saaman')}</span><span>{t('Qty', 'मात्रा', 'Qty')}</span><span>{t('Amount', 'रकम', 'Amount')}</span></div>
          <ul>
            {shown.map((r) => <li key={r[0]} className="pop"><span>{r[0]}</span><span className="num">{r[1]}</span><span className="num">{inr(r[2])}</span></li>)}
            {step < 4 && <li className="pbill-cursor"><span>{t('Type an item…', 'सामान लिखें…', 'Saaman likho…')}</span></li>}
          </ul>
          <div className={`pbill-sum ${step >= 5 ? 'on' : ''}`}>
            <div><span>{t('GST included', 'GST शामिल', 'GST shamil')}</span><span className="num">₹98.32</span></div>
            <div className="pbill-total"><span>{t('Total', 'कुल', 'Total')}</span><span className="num">{inr(total)}</span></div>
          </div>
          <div className={`pbill-pay ${step >= 5 ? 'on' : ''}`}>
            <img src="/landing/qr-diligence.svg?v=c" alt="" width={46} height={46} />
            <div><b>{t('Scan to pay by UPI', 'UPI से भुगतान के लिए scan करें', 'UPI se pay karne ke liye scan karo')}</b><small>{t('Bill goes to WhatsApp as a PDF', 'बिल WhatsApp पर PDF में', 'Bill WhatsApp pe PDF me')}</small></div>
          </div>
          <div className={`pbill-paid ${step >= 6 ? 'on' : ''}`}><CircleCheck size={14} aria-hidden /> {t('Paid', 'भुगतान हुआ', 'Paid')} {inr(1377)} · UPI</div>
        </div>
      </IPhone>

      <div className={`chip-float chip-stock ${step >= 2 ? 'on' : ''}`} aria-hidden><Package size={14} /> {t('Stock updated', 'स्टॉक अपडेट', 'Stock update')} · Atta −2</div>
      <div className={`chip-float chip-wa ${step >= 6 ? 'on' : ''}`} aria-hidden><MessageCircle size={14} /> {t('Bill sent on WhatsApp', 'बिल WhatsApp पर भेजा', 'Bill WhatsApp pe bheja')}</div>
      {step >= 6 && !reducedMotion() && (
        <button type="button" className="hero-replay" onClick={() => setRun((r) => r + 1)}>
          <RotateCcw size={13} aria-hidden /> {t('Make another bill', 'एक और बिल बनाएं', 'Ek aur bill banao')}
        </button>
      )}
    </div>
  );
}

/* ---------- problem: three apps that merge into one ---------- */
function MergeDemo() {
  const { t } = useI18n();
  const [ref, inView] = useInView<HTMLDivElement>(0.4);
  const [together, setTogether] = useState(false);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!inView || touched) return;
    const id = window.setTimeout(() => setTogether(true), reducedMotion() ? 0 : 1800);
    return () => window.clearTimeout(id);
  }, [inView, touched]);
  const choose = (v: boolean) => { setTouched(true); setTogether(v); };

  const apps: [ReactNode, string, string][] = [
    [<Receipt key="r" size={20} strokeWidth={1.6} />, t('Billing-only app', 'सिर्फ़ बिलिंग वाला ऐप', 'Sirf billing wala app'), t('The bill gets made, but stock and credit accounts live somewhere else.', 'बिल तो बन गया, पर स्टॉक और उधार का हिसाब कहीं और।', 'Bill to ban gaya, par stock aur udhaar ka hisaab kahin aur.')],
    [<BookOpenText key="b" size={20} strokeWidth={1.6} />, t('Credit-only app', 'सिर्फ़ उधार वाला ऐप', 'Sirf udhaar wala app'), t('Credit is written down, but billing, stock and GST are somewhere else.', 'उधार लिख लिया, पर बिलिंग, स्टॉक और GST कहीं और।', 'Udhaar likh liya, par billing, stock aur GST kahin aur.')],
    [<Calculator key="c" size={20} strokeWidth={1.6} />, t('Accounting-only software', 'सिर्फ़ अकाउंटिंग वाला सॉफ़्टवेयर', 'Sirf accounting wala software'), t('Accounts are managed, but the shop’s daily work is somewhere else.', 'अकाउंट संभाल लिए, पर दुकान का रोज़ का काम कहीं और।', 'Accounts sambhal liye, par dukaan ka roz ka kaam kahin aur.')]
  ];
  const mods = [t('Billing', 'बिलिंग', 'Billing'), t('Stock', 'स्टॉक', 'Stock'), t('Udhaar', 'उधार', 'Udhaar'), 'GST', t('Reports', 'रिपोर्ट', 'Reports'), 'Business Mart'];

  return (
    <div className={`merge ${together ? 'is-one' : ''}`} ref={ref}>
      <div className="seg-toggle" role="group" aria-label={t('Compare', 'तुलना', 'Compare')}>
        <button type="button" aria-pressed={!together} onClick={() => choose(false)}>{t('Separate apps', 'अलग-अलग ऐप', 'Alag-alag apps')}</button>
        <button type="button" aria-pressed={together} onClick={() => choose(true)}>BizYour</button>
      </div>

      <div className="merge-stage">
        <ul className="merge-apps" aria-hidden={together}>
          {apps.map(([icon, h, p], k) => (
            <li key={h} className={`merge-app merge-app-${k}`}>
              <div className="merge-app-top">{icon}<span className="merge-fee">{t('own login · own fee', 'अलग login · अलग फ़ीस', 'alag login · alag fees')}</span></div>
              <b>{h}</b><p>{p}</p>
            </li>
          ))}
        </ul>
        <div className="merge-one" aria-hidden={!together}>
          <img src="/bizyour-mark-512.png?v=c" alt="" width={48} height={48} />
          <div>
            <b>{t('BizYour — everything in one app', 'BizYour — सब कुछ एक ऐप में', 'BizYour — sab kuch ek app me')}</b>
            <ul className="merge-mods">{mods.map((m) => <li key={m}><Check size={13} aria-hidden /> {m}</li>)}</ul>
            <p>{t('One login, one subscription, one data.', 'एक लॉगिन, एक सब्सक्रिप्शन, एक डेटा।', 'Ek login, ek subscription, ek data.')}</p>
          </div>
        </div>
      </div>

      <p className="merge-result" aria-live="polite">
        {together
          ? t('Billing + Stock + Credit + GST + Reports + Business Mart, together.', 'बिलिंग + स्टॉक + उधार + GST + रिपोर्ट + Business Mart, एक साथ।', 'Billing + Stock + Udhaar + GST + Reports + Business Mart, ek saath.')
          : <>{t('That means ', 'मतलब ', 'Matlab ')}<b>{t('2–4 separate apps', '2–4 अलग ऐप', '2–4 alag apps')}</b>{t(', separate data, separate hassle.', ', अलग-अलग डेटा, अलग-अलग झंझट।', ', alag-alag data, alag-alag jhanjhat.')}</>}
      </p>
    </div>
  );
}

/* ---------- Workspace: feature tabs that switch the laptop screen ---------- */
function WorkspaceTour() {
  const { t } = useI18n();
  const [ref, inView] = useInView<HTMLDivElement>(0.3);
  const { i, pick } = useAutoStep(3, 6500, inView);
  const tabs: { key: string; label: string; img: string; alt: string; cap: string; items: [string, string][] }[] = [
    {
      key: 'counter', label: t('The counter', 'काउंटर', 'Counter'), img: '/landing/pos.webp?v=c',
      alt: t('The billing counter with items added', 'बिलिंग काउंटर', 'Billing counter'),
      cap: t('New bill: add items, GST applies itself, UPI QR on the bill. Keyboard shortcuts for speed.', 'नया बिल: सामान जोड़ें, GST अपने आप, बिल पर UPI QR। तेज़ी के लिए keyboard shortcut।', 'New bill: item jodo, GST khud lagega, bill pe UPI QR. Speed ke liye keyboard shortcut.'),
      items: [
        [t('GST billing', 'GST बिलिंग', 'GST billing'), t('A bill in seconds. GST works itself out, UPI QR prints on the bill, and the bill goes to the customer’s WhatsApp as a PDF.', 'सेकंडों में बिल। GST अपने आप, बिल पर UPI QR, और बिल सीधा ग्राहक के WhatsApp पर PDF में।', 'Seconds me bill. GST apne aap, bill pe UPI QR, aur bill seedha customer ke WhatsApp pe PDF me.')],
        [t('Estimate to bill', 'एस्टीमेट से बिल', 'Estimate se bill'), t('Give an estimate first. If they agree, it becomes a proper bill in one click.', 'पहले एस्टीमेट दें, हाँ हो तो एक click में पक्का बिल।', 'Pehle estimate do, haan ho to ek click me pakka bill.')],
        [t('Returns', 'वापसी', 'Return'), t('Credit notes for returned goods, so the books always stay clean.', 'लौटे माल पर credit note — हिसाब हमेशा साफ़।', 'Maal wapsi pe credit note — hisaab hamesha saaf.')],
        [t('Offline billing', 'ऑफ़लाइन बिलिंग', 'Offline billing'), t('Bills keep getting made even if the net is down. The shop never stops.', 'नेट बंद हो तो भी बिल बनता रहे — दुकान कभी नहीं रुकती।', 'Net band ho to bhi bill banta rahe — dukaan kabhi nahi rukti.')]
      ]
    },
    {
      key: 'udhaar', label: t('Udhaar', 'उधार', 'Udhaar'), img: '/landing/customer.webp?v=c',
      alt: t('A customer’s udhaar account', 'ग्राहक का उधार खाता', 'Customer ka udhaar khata'),
      cap: t('Every customer’s khata, with a reminder one tap away.', 'हर ग्राहक का खाता, reminder एक tap पर।', 'Har customer ka khata, reminder ek tap pe.'),
      items: [
        [t('Udhaar khata', 'उधार खाता', 'Udhaar khata'), t('Who owes what, due-date alerts, WhatsApp reminders and a Hisab link your customer opens without logging in.', 'किसका कितना बाकी, due-date alert, WhatsApp reminder और ग्राहक के लिए बिना login वाला हिसाब link।', 'Kiska kitna baaki, due-date alert, WhatsApp reminder aur customer ke liye bina login wala Hisab link.')],
        [t('Purchases and suppliers', 'खरीद और सप्लायर', 'Khareed aur supplier'), t('Record what you buy and what you owe each supplier.', 'क्या खरीदा, किस सप्लायर का कितना देना है।', 'Kya khareeda, kis supplier ka kitna dena hai.')]
      ]
    },
    {
      key: 'day', label: t('Day and stock', 'दिन और स्टॉक', 'Din aur stock'), img: '/landing/home.webp?v=c',
      alt: t('The Workspace home screen', 'Workspace होम स्क्रीन', 'Workspace home screen'),
      cap: t('Your whole shop on one screen: today’s sale, credit still to collect, low-stock alerts and the day-end summary.', 'पूरी दुकान एक स्क्रीन पर: आज की बिक्री, बाकी उधार, कम स्टॉक alert और दिन का हिसाब।', 'Poori dukaan ek screen pe: aaj ki sale, baaki udhaar, low-stock alert aur day-end summary.'),
      items: [
        [t('Stock', 'स्टॉक', 'Stock'), t('Every bill and purchase moves stock. Low-stock alerts before you run out.', 'हर बिल और खरीद से स्टॉक बदलता है। खत्म होने से पहले alert।', 'Har bill aur khareed se stock badalta hai. Khatam hone se pehle alert.')],
        [t('Profit and day-end', 'मुनाफ़ा और दिन-अंत', 'Profit aur day-end'), t('The whole day’s sale, credit and expenses at a glance. A clear monthly profit report without a CA.', 'दिन भर की बिक्री, उधार और खर्चा एक नज़र में। CA के बिना महीने का मुनाफ़ा।', 'Din bhar ki bikri, udhaar aur kharcha ek nazar me. CA ke bina mahine ka profit.')],
        [t('GSTR-1 file', 'GSTR-1 फ़ाइल', 'GSTR-1 file'), t('At month end, the GSTR-1 ready file for your CA in one click.', 'महीने के अंत में CA के लिए GSTR-1 फ़ाइल एक click में।', 'Mahine ke end me CA ke liye GSTR-1 file ek click me.')]
      ]
    }
  ];
  const tab = tabs[i];
  return (
    <div className="tour" ref={ref}>
      <div className="tour-side">
        <div className="tour-tabs" role="tablist" aria-label={t('Workspace features', 'Workspace के फ़ीचर', 'Workspace features')}>
          {tabs.map((x, k) => (
            <button key={x.key} role="tab" type="button" aria-selected={k === i} aria-controls="tour-panel" onClick={() => pick(k)} className={k === i ? 'on' : ''}>
              {x.label}{k === i && !reducedMotion() && <i className="tour-progress" key={`${x.key}-${i}`} />}
            </button>
          ))}
        </div>
        <ul className="tour-list" id="tour-panel" role="tabpanel" key={tab.key}>
          {tab.items.map(([h, p]) => <li key={h}><Check size={16} aria-hidden /><div><b>{h}</b><span>{p}</span></div></li>)}
        </ul>
      </div>
      <div className="tour-device">
        <MacBook label={tab.alt}>
          {tabs.map((x, k) => <img key={x.key} src={x.img} alt={k === i ? x.alt : ''} className={k === i ? 'on' : ''} loading="lazy" width={1400} height={875} />)}
        </MacBook>
        <p className="tour-cap" aria-live="polite">{tab.cap}</p>
      </div>
    </div>
  );
}

/* ---------- a day with BizYour: timeline drives the phone ---------- */
function DayPhone({ i }: { i: number }) {
  const { t } = useI18n();
  if (i === 0) return (
    <div className="ps">
      <PhoneBar title={t('Good morning, Sharma ji', 'नमस्ते, शर्मा जी', 'Good morning, Sharma ji')} sub={t('Monday, 23 November', 'सोमवार, 23 नवंबर', 'Somvaar, 23 November')} />
      <div className="ps-cards">
        <div><small>{t('Sold yesterday', 'कल की बिक्री', 'Kal ki bikri')}</small><b>₹1,128</b></div>
        <div className="owed"><small>{t('Due today', 'आज वसूली', 'Aaj vasooli')}</small><b>₹1,620</b></div>
      </div>
      <div className="ps-alert"><Bell size={13} aria-hidden /><div><b>{t('2 products running low', '2 सामान कम हैं', '2 saaman kam hain')}</b><small>Chai Patti 500g · Surf Excel 1kg</small></div></div>
      <div className="ps-row"><span>Ramesh Gupta</span><b className="owed-t">₹1,470</b></div>
      <div className="ps-row"><span>Mohd Salim</span><b className="owed-t">₹150</b></div>
    </div>
  );
  if (i === 1) return (
    <div className="ps">
      <PhoneBar title={t('New bill', 'नया बिल', 'Naya bill')} sub="Ramesh Gupta" />
      <div className="ps-bill">
        <div className="ps-row"><span>Atta 10kg × 1</span><b>₹485</b></div>
        <div className="ps-row"><span>Cheeni 1kg × 2</span><b>₹90</b></div>
        <div className="ps-row ps-total"><span>{t('Total', 'कुल', 'Total')}</span><b>₹575</b></div>
      </div>
      <div className="ps-qr"><img src="/landing/qr-diligence.svg?v=c" alt="" width={84} height={84} /><small>{t('Customer scans and pays by UPI', 'ग्राहक scan करके UPI से भरे', 'Customer scan karke UPI se pay kare')}</small></div>
      <div className="ps-tag"><Package size={12} aria-hidden /> {t('Stock: Atta 10kg, 17 left', 'स्टॉक: Atta 10kg, 17 बचे', 'Stock: Atta 10kg, 17 bache')}</div>
    </div>
  );
  if (i === 2) return (
    <div className="ps ps-wa">
      <div className="wa-bar"><span className="wa-av">RG</span><div><b>Ramesh Gupta</b><small>WhatsApp</small></div></div>
      <div className="wa-chat">
        <div className="wa-msg wa-out">
          {t('Namaste Ramesh ji. ₹1,470 is due at Sharma General Store. See your full hisab here:', 'नमस्ते रमेश जी। Sharma General Store में ₹1,470 बाकी हैं। पूरा हिसाब यहाँ देखें:', 'Namaste Ramesh ji. Sharma General Store me ₹1,470 baaki hai. Poora hisaab yahan dekho:')}
          <span className="wa-link">bizyour.in/h/rg42</span>
          <small>6:42 PM ✓✓</small>
        </div>
        <div className="wa-msg wa-in">{t('Thanks, sending ₹1,470 on UPI now.', 'धन्यवाद, अभी UPI पर ₹1,470 भेज रहा हूँ।', 'Thanks, abhi UPI pe ₹1,470 bhej raha hoon.')}<small>6:51 PM</small></div>
      </div>
    </div>
  );
  return (
    <div className="ps">
      <PhoneBar title={t('Day-end', 'दिन का हिसाब', 'Day-end')} sub={t('Today, closed at 9:30 PM', 'आज, रात 9:30 बजे बंद', 'Aaj, raat 9:30 pe band')} />
      <div className="ps-big"><small>{t('Sold today', 'आज की बिक्री', 'Aaj ki bikri')}</small><b>₹1,128</b><span>3 {t('bills', 'बिल', 'bills')}</span></div>
      <div className="ps-row"><span>{t('Cash', 'नकद', 'Cash')}</span><b>₹373</b></div>
      <div className="ps-row"><span>UPI</span><b>₹170</b></div>
      <div className="ps-row"><span>{t('Given on udhaar', 'उधार दिया', 'Udhaar diya')}</span><b className="owed-t">₹585</b></div>
      <div className="ps-row"><span>{t('Expenses', 'खर्चा', 'Kharcha')}</span><b>₹120</b></div>
      <div className="ps-row ps-total"><span>{t('Profit', 'मुनाफ़ा', 'Profit')}</span><b className="in-t">+₹30</b></div>
    </div>
  );
}

function DayWithBizYour() {
  const { t } = useI18n();
  const [ref, inView] = useInView<HTMLDivElement>(0.3);
  const { i, pick } = useAutoStep(4, 4500, inView);
  const day: [ReactNode, string, string, string][] = [
    [<Sunrise key="1" size={16} />, t('Morning', 'सुबह', 'Subah'), t('As the shop opens', 'दुकान खुलते ही', 'Dukaan khulte hi'), t('Yesterday’s day-end report and today’s due alerts, in front of you before the day begins.', 'कल का हिसाब और आज के बकाया, दिन शुरू होने से पहले सामने।', 'Kal ka day-end report aur aaj ke due alerts, din shuru hone se pehle saamne.')],
    [<Sun key="2" size={16} />, t('All day', 'पूरा दिन', 'Din bhar'), t('Billing and stock, together', 'बिलिंग और स्टॉक, साथ-साथ', 'Billing aur stock, saath-saath'), t('Every bill updates stock by itself, and the bill carries a UPI QR so the customer pays directly.', 'हर बिल से स्टॉक अपने आप बदले, और बिल पर UPI QR — ग्राहक सीधा भरे।', 'Har bill se stock khud update, aur bill pe UPI QR — customer seedha pay kare.')],
    [<Sunset key="3" size={16} />, t('Evening', 'शाम', 'Shaam'), t('Easy udhaar recovery', 'उधार वसूली आसान', 'Udhaar vasooli aasan'), t('Whoever owes gets a WhatsApp reminder with their own Hisab link. Clear accounts, no awkward call.', 'जिसका पैसा बाकी, उसे WhatsApp reminder और अपना हिसाब link — बिना झिझक।', 'Jiska paisa baaki, use WhatsApp reminder aur apna Hisab link — bina jhijhak.')],
    [<Moon key="4" size={16} />, t('Night', 'रात', 'Raat'), t('Close the day', 'दिन बंद', 'Din band'), t('What sold, what went on credit, how much cash came in. Then restock on Business Mart.', 'क्या बिका, कितना उधार, कितना नकद। फिर Business Mart से माल मंगाएं।', 'Kya bika, kitna udhaar, kitna cash. Phir Business Mart se maal mangao.')]
  ];
  return (
    <div className="day" ref={ref}>
      <ol className="day-list">
        {day.map(([icon, when, h, p], k) => (
          <li key={when}>
            <button type="button" className={k === i ? 'on' : ''} aria-pressed={k === i} onClick={() => pick(k)}>
              <span className="day-when">{icon} {when}</span>
              <b>{h}</b>
              <span className="day-p">{p}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="day-device">
        <div className="day-glow" data-i={i} aria-hidden />
        <IPhone label={day[i][2]}><div className="ps-swap" key={i}><DayPhone i={i} /></div></IPhone>
      </div>
    </div>
  );
}

/* ---------- Business Mart: stepper drives a phone over the laptop ---------- */
function MartPhone({ i }: { i: number }) {
  const { t } = useI18n();
  const head = <PhoneBar mart title="Business Mart" sub={t('Free, always', 'हमेशा मुफ़्त', 'Hamesha free')} />;
  if (i === 0) return (
    <div className="ps">{head}
      <div className="mf">
        <label>{t('What do you need?', 'क्या चाहिए?', 'Kya chahiye?')}</label><div className="mf-in">Sona Masoori Rice</div>
        <div className="mf-two"><div><label>{t('Quantity', 'मात्रा', 'Quantity')}</label><div className="mf-in">500 kg</div></div><div><label>{t('City', 'शहर', 'Shehar')}</label><div className="mf-in">Delhi</div></div></div>
        <label>{t('Need by', 'कब तक', 'Kab tak')}</label><div className="mf-in">26 Nov</div>
        <div className="mf-btn">{t('Post request', 'Request भेजें', 'Request bhejo')}</div>
      </div>
    </div>
  );
  if (i === 1) return (
    <div className="ps">{head}
      <div className="mq-h"><b>500 kg Sona Masoori Rice</b><span className="mq-badge">3 {t('quotes', 'quote', 'quotes')}</span></div>
      {[['Annapurna Rice Mills', '₹46', t('3 days', '3 दिन', '3 din')], ['Fresh Supply Co', '₹47.50', t('2 days', '2 दिन', '2 din')], ['Gupta Traders', '₹49', t('1 day', '1 दिन', '1 din')]].map(([n, p, d], k) => (
        <div key={n} className="mq pop" style={{ animationDelay: `${k * 260}ms` }}><div><b>{n}</b><small>{t('Delivery', 'डिलीवरी', 'Delivery')} {d}</small></div><b>{p}<small>/kg</small></b></div>
      ))}
    </div>
  );
  if (i === 2) return (
    <div className="ps">{head}
      <div className="mq mq-best"><span className="mq-star">★ {t('Best value', 'सबसे अच्छा', 'Best value')}</span><div><b>Fresh Supply Co</b><small>{t('7-day credit · 2 days delivery', '7 दिन उधार · 2 दिन डिलीवरी', '7 din udhaar · 2 din delivery')}</small></div><b>₹47.50<small>/kg</small></b></div>
      <div className="ps-row"><span>{t('Landed cost (500 kg)', 'कुल लागत (500 kg)', 'Total laagat (500 kg)')}</span><b>₹23,750</b></div>
      <div className="mf-btn mf-done"><Check size={13} aria-hidden /> {t('Order accepted', 'Order मंज़ूर', 'Order accept')}</div>
      <small className="ps-note">{t('Other quotes close automatically.', 'बाकी quote अपने आप बंद।', 'Baaki quotes apne aap band.')}</small>
    </div>
  );
  return (
    <div className="ps">
      <PhoneBar title="Workspace" sub={t('Purchases', 'खरीद', 'Khareed')} />
      <div className="ps-done"><CircleCheck size={30} aria-hidden /><b>{t('Goods received', 'माल मिल गया', 'Maal mil gaya')}</b><small>{t('Added to stock as a purchase', 'खरीद के रूप में स्टॉक में जुड़ा', 'Khareed ke roop me stock me juda')}</small></div>
      <div className="ps-row"><span>Sona Masoori Rice</span><b className="in-t">+500 kg</b></div>
      <div className="ps-row"><span>{t('Stock now', 'अब स्टॉक', 'Ab stock')}</span><b>520 kg</b></div>
      <div className="ps-row"><span>{t('Owed to Fresh Supply Co', 'Fresh Supply Co को देना', 'Fresh Supply Co ko dena')}</span><b>₹23,750</b></div>
    </div>
  );
}

function MartTour() {
  const { t } = useI18n();
  const [ref, inView] = useInView<HTMLDivElement>(0.3);
  const { i, pick } = useAutoStep(4, 4200, inView);
  const steps: [string, string][] = [
    [t('Post what you need', 'ज़रूरत बताइए', 'Zaroorat batao'), t('Item, quantity and your city. Takes a minute.', 'सामान, मात्रा और शहर। एक मिनट।', 'Saaman, quantity aur shehar. Ek minute.')],
    [t('Wholesalers quote', 'थोक वाले quote भेजें', 'Wholesalers quote bhejein'), t('Sellers who serve your area send their rate, delivery days and terms.', 'आपके इलाके के seller रेट, delivery और शर्तें भेजते हैं।', 'Aapke ilaake ke seller rate, delivery aur terms bhejte hain.')],
    [t('Compare and order', 'तुलना करें, order दें', 'Compare karo, order do'), t('All quotes side by side, landed cost included. Accept the best one.', 'सारे quote साथ-साथ, पूरी लागत के साथ। सबसे अच्छा चुनें।', 'Saare quote saath-saath, poori laagat ke saath. Best chuno.')],
    [t('Goods land in stock', 'माल सीधे स्टॉक में', 'Maal seedha stock me'), t('Mark it received and it is added to your Workspace stock as a purchase, automatically.', 'माल मिलने पर अपने आप Workspace स्टॉक में खरीद के रूप में जुड़ जाता है।', 'Maal milne pe apne aap Workspace stock me khareed ke roop me jud jaata hai.')]
  ];
  return (
    <div ref={ref}>
      <ol className="msteps">
        {steps.map(([h, p], k) => (
          <li key={h}>
            <button type="button" className={`${k === i ? 'on' : ''} ${k < i ? 'done' : ''}`} aria-pressed={k === i} onClick={() => pick(k)}>
              <span className="msteps-n">{k < i ? <Check size={16} aria-hidden /> : k + 1}</span>
              <b>{h}</b><span>{p}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="mart-stage">
        <MacBook label={t('Comparing wholesaler quotes side by side', 'थोक वालों के quote की तुलना', 'Wholesaler quotes ki tulna')}>
          <img src="/landing/mart-compare.webp?v=c" alt={t('Quotes compared on landed cost, delivery days and the seller’s record', 'पूरी लागत, delivery और seller के रिकॉर्ड पर तुलना', 'Poori laagat, delivery aur seller ke record pe tulna')} loading="lazy" width={1400} height={875} />
        </MacBook>
        <IPhone className="mart-phone" label={steps[i][0]}><div className="ps-swap" key={i}><MartPhone i={i} /></div></IPhone>
      </div>
      <p className="tour-cap">{t('Quotes compared on landed cost, delivery days and the seller’s record.', 'पूरी लागत, delivery और seller के रिकॉर्ड पर तुलना।', 'Poori laagat, delivery aur seller ke record pe tulna.')}</p>
    </div>
  );
}

/* ---------- FAQ ---------- */
function Faq({ q, a, open }: { q: string; a: string; open?: boolean }) {
  return (
    <details className="lp-faq-item" open={open}>
      <summary><span>{q}</span><ChevronDown size={18} aria-hidden /></summary>
      <p>{a}</p>
    </details>
  );
}

/* ================================================================ */
export default function Landing() {
  const { t } = useI18n();
  const intro = useIntro();
  const navTone = useNavTone();
  useEffect(() => { document.title = 'BizYour — billing, stock, udhaar and a B2B bazaar for your shop'; }, []);

  const everywhere: [ReactNode, string, string][] = [
    [<Upload key="u" size={18} strokeWidth={1.6} />, t('Bring your old data', 'पुराना डेटा लाएं', 'Purana data lao'), t('CSV import of products and customers from Vyapar, Tally or Excel.', 'Vyapar, Tally या Excel से सामान और ग्राहक का CSV import।', 'Vyapar, Tally ya Excel se saaman aur customer ka CSV import.')],
    [<Users key="s" size={18} strokeWidth={1.6} />, t('Staff logins', 'स्टाफ लॉगिन', 'Staff login'), t('Staff get their own login with role limits. Profit stays visible only to you.', 'स्टाफ का अपना login, role की सीमा के साथ। मुनाफ़ा सिर्फ़ आपको दिखे।', 'Staff ka apna login, role limit ke saath. Profit sirf aapko dikhe.')],
    [<Languages key="l" size={18} strokeWidth={1.6} />, t('Three languages', 'तीन भाषाएं', 'Teen bhaasha'), t('English, हिंदी or Hinglish. Switch any time.', 'English, हिंदी या Hinglish — कभी भी बदलें।', 'English, हिंदी ya Hinglish — kabhi bhi badlo.')],
    [<DatabaseBackup key="d" size={18} strokeWidth={1.6} />, t('Your data, your backup', 'आपका डेटा, आपका backup', 'Aapka data, aapka backup'), t('Take a backup or export everything whenever you want. No lock-in.', 'जब चाहें backup लें या सब export करें। कोई lock-in नहीं।', 'Jab chaho backup lo ya sab export karo. Koi lock-in nahi.')],
    [<WifiOff key="o" size={18} strokeWidth={1.6} />, t('Works offline', 'ऑफ़लाइन भी', 'Offline bhi'), t('Billing goes on without internet and syncs when the net is back.', 'बिना इंटरनेट बिलिंग चलती है, नेट आते ही sync।', 'Bina internet billing chalti hai, net aate hi sync.')]
  ];

  const compare: [string, string, string][] = [
    [t('Billing + GST', 'बिलिंग + GST', 'Billing + GST'), t('A separate billing app, its own charge', 'अलग बिलिंग ऐप, उसका अलग खर्चा', 'Alag billing app, uska alag kharcha'), t('In this very app', 'इसी ऐप में', 'Yahi app me')],
    [t('Stock / Inventory', 'स्टॉक / इन्वेंटरी', 'Stock / Inventory'), t('Separate stock app or a paper register', 'अलग स्टॉक ऐप या कागज़ का रजिस्टर', 'Alag stock app ya kagaz ka register'), t('In this very app', 'इसी ऐप में', 'Yahi app me')],
    [t('Udhaar / Khata', 'उधार / खाता', 'Udhaar / Khata'), t('A separate khata app, its own charge', 'अलग खाता ऐप, उसका अलग खर्चा', 'Alag khata app, uska alag kharcha'), t('In this very app', 'इसी ऐप में', 'Yahi app me')],
    [t('GST report / GSTR-1', 'GST रिपोर्ट / GSTR-1', 'GST report / GSTR-1'), t('CA or separate accounting software', 'CA या अलग अकाउंटिंग सॉफ़्टवेयर', 'CA ya alag accounting software'), t('In this very app', 'इसी ऐप में', 'Yahi app me')],
    [t('B2B buying (Business Mart)', 'B2B खरीद (Business Mart)', 'B2B khareed (Business Mart)'), t('Phone calls, market rounds, middlemen', 'फ़ोन, बाज़ार के चक्कर, दलाल', 'Phone, bazaar ke chakkar, dalaal'), t('Inside the app, free', 'ऐप के अंदर, मुफ़्त', 'App ke andar, free')],
    [t('Day-end report', 'दिन का हिसाब', 'Day-end report'), t('Add up the day’s figures by hand', 'हाथ से दिन का हिसाब जोड़ें', 'Haath se din ka hisaab jodo'), t('In this very app', 'इसी ऐप में', 'Yahi app me')]
  ];

  const who: [ReactNode, string, string][] = [
    [<Store key="1" size={22} strokeWidth={1.5} />, t('Kirana and general stores', 'किराना और जनरल स्टोर', 'Kirana aur general store'), t('Fast counter billing, daily stock, regular customers on credit.', 'तेज़ बिलिंग, रोज़ का स्टॉक, उधार वाले ग्राहक।', 'Tez billing, roz ka stock, udhaar wale customer.')],
    [<Shirt key="2" size={22} strokeWidth={1.5} />, t('Garments', 'कपड़े', 'Kapde'), t('Many sizes and colours, one clean stock list, bills in seconds.', 'कई साइज़-रंग, एक साफ़ स्टॉक, सेकंडों में बिल।', 'Kai size-rang, ek saaf stock, seconds me bill.')],
    [<Smartphone key="3" size={22} strokeWidth={1.5} />, t('Mobile and electronics', 'मोबाइल और इलेक्ट्रॉनिक्स', 'Mobile aur electronics'), t('Costly stock, part payments and service, tracked properly.', 'महंगा स्टॉक, किस्तें और सर्विस, सही हिसाब।', 'Mehenga stock, kist aur service, sahi hisaab.')],
    [<Wrench key="4" size={22} strokeWidth={1.5} />, t('Hardware and sanitary', 'हार्डवेयर और सैनिटरी', 'Hardware aur sanitary'), t('Thousands of small items, rates always at hand.', 'हज़ारों छोटे सामान, रेट हमेशा सामने।', 'Hazaron chhote saaman, rate hamesha saamne.')],
    [<Warehouse key="5" size={22} strokeWidth={1.5} />, t('Wholesalers and distributors', 'थोक और डिस्ट्रीब्यूटर', 'Wholesale aur distributor'), t('Get leads from shops on Business Mart, bill them from Workspace.', 'Business Mart पर दुकानों से leads, Workspace से बिल।', 'Business Mart pe dukaanon se leads, Workspace se bill.')],
    [<Package key="6" size={22} strokeWidth={1.5} />, t('Any product business', 'कोई भी सामान वाला बिज़नेस', 'Koi bhi saaman wala business'), t('If you sell goods and keep accounts, BizYour fits.', 'अगर आप सामान बेचते हैं और हिसाब रखते हैं, BizYour फिट है।', 'Agar aap saaman bechte ho aur hisaab rakhte ho, BizYour fit hai.')]
  ];

  const facts = [
    t('Set up in 5 minutes', '5 मिनट में setup', '5 minute me setup'),
    t('30-day free trial, no card', '30 दिन फ्री ट्रायल, कोई card नहीं', '30 din free trial, koi card nahi'),
    'English · हिंदी · Hinglish',
    t('Export your data anytime', 'डेटा कभी भी export करें', 'Data kabhi bhi export karo')
  ];

  return (
    <div className="lp">
      {intro.show && <Intro onDone={intro.done} />}

      <header className={`lp-nav-wrap ${navTone.scrolled ? 'is-scrolled' : ''} ${navTone.dark ? 'is-dark' : ''}`}>
      <div className="lp-nav">
        <Link to="/" className="lp-logo" aria-label="BizYour">
          <img src="/bizyour-mark-512.png?v=c" alt="" width={30} height={30} />
          <span><b>BizYour</b><small>by DILIGENCE</small></span>
        </Link>
        <nav className="lp-links" aria-label={t('Sections', 'हिस्से', 'Sections')}>
          <a href="#workspace">Workspace</a>
          <a href="#mart">Business Mart</a>
          <a href="#pricing">{t('Pricing', 'कीमत', 'Pricing')}</a>
          <a href="#faq">{t('Questions', 'सवाल', 'Sawaal')}</a>
        </nav>
        <div className="lp-nav-end">
          <LangSwitch />
          <Link to="/login" className="btn btn-ghost">{t('Log in', 'लॉग इन', 'Log in')}</Link>
          <Link to="/signup" className="btn btn-primary lp-nav-cta">{t('Create free account', 'मुफ़्त account बनाएं', 'Free account banao')}</Link>
        </div>
      </div>
      </header>

      <main>
        {/* hero: headline on a ledger page, the product on a laptop and a phone */}
        <section className="lp-hero">
          <div className="lp-hero-page">
            <span className="lp-eyebrow">{t('For Indian shops', 'भारतीय दुकानों के लिए', 'Indian dukaanon ke liye')}</span>
            <h1>{t('Your whole shop, in ', 'आपकी पूरी दुकान, ', 'Aapki poori dukaan, ')}<em>{t('one app.', 'एक ऐप में।', 'ek app me.')}</em></h1>
            <p className="lp-lede">{t(
              'Billing, stock, udhaar, GST and reports in Workspace. Buying from wholesalers in Business Mart. One login, one subscription, one data.',
              'Workspace में बिलिंग, स्टॉक, उधार, GST और रिपोर्ट। Business Mart में थोक वालों से खरीद। एक लॉगिन, एक सब्सक्रिप्शन, एक डेटा।',
              'Workspace me billing, stock, udhaar, GST aur reports. Business Mart me wholesalers se khareed. Ek login, ek subscription, ek data.')}</p>
            <div className="lp-cta-row">
              <Link to="/signup" className="btn btn-primary btn-lg" data-testid="hero-signup">{t('Try free for 30 days', '30 दिन मुफ़्त आज़माएं', '30 din free try karo')} <ArrowRight size={16} aria-hidden /></Link>
              <Link to="/login" className="btn btn-secondary btn-lg">{t('Log in', 'लॉग इन', 'Log in')}</Link>
            </div>
            <dl className="lp-terms">
              <div><dt>Business Mart</dt><dd>{t('Free, always', 'हमेशा मुफ़्त', 'Hamesha free')}</dd></div>
              <div><dt>Workspace</dt><dd>{t('30 days free, no card', '30 दिन मुफ़्त, कोई card नहीं', '30 din free, koi card nahi')}</dd></div>
            </dl>
          </div>
          <HeroStage />
        </section>

        <ul className="lp-facts" aria-label={t('At a glance', 'एक नज़र में', 'Ek nazar me')}>
          {facts.map((f) => <li key={f}><Check size={14} aria-hidden /> {f}</li>)}
        </ul>

        {/* problem → solution */}
        <section className="lp-section lp-problem" aria-labelledby="eco-h">
          <Reveal>
            <h2 id="eco-h">{t('Other apps sell you ', 'बाकी ऐप ', 'Baaki apps ')}<em>{t('one system', 'एक-एक सिस्टम', 'ek-ek system')}</em>{t(' at a time', ' बेचते हैं', ' bechte hain')}</h2>
            <p className="lp-section-sub">{t('One app for billing, another for credit, a third for accounting. Separate data, separate payments, separate headaches.', 'बिलिंग के लिए एक ऐप, उधार के लिए दूसरा, अकाउंटिंग के लिए तीसरा। डेटा भी अलग, पैसा भी अलग।', 'Billing ke liye ek app, udhaar ke liye dusra, accounting ke liye teesra. Data bhi alag, paisa bhi alag.')}</p>
          </Reveal>
          <MergeDemo />
        </section>

        {/* the two sides — same split the user sees after signing up */}
        <section className="lp-section lp-sides" aria-labelledby="sides-h">
          <Reveal>
            <h2 id="sides-h">{t('One login. Two sides.', 'एक login. दो हिस्से।', 'Ek login. Do hisse.')}</h2>
            <p className="lp-section-sub">{t('BizYour keeps your shop and your buying in one place, with one set of data. Switch between them with one tap.', 'BizYour में दुकान और खरीद एक जगह, एक ही डेटा। एक tap में बदलें।', 'BizYour me dukaan aur khareed ek jagah, ek hi data. Ek tap me badlo.')}</p>
          </Reveal>
          <div className="lp-sides-grid">
            <Reveal delay={0}>
              <a href="#workspace" className="lp-side lp-side-ws">
                <div className="lp-side-art" aria-hidden><span className="sa-bar" /><span className="sa-row" /><span className="sa-row short" /><span className="sa-total" /></div>
                <BookOpenText size={28} strokeWidth={1.5} aria-hidden />
                <h3>Workspace</h3>
                <p>{t('Run your own shop: billing, stock, udhaar, purchases, GST and reports.', 'अपनी दुकान चलाइए: बिलिंग, स्टॉक, उधार, खरीद, GST और रिपोर्ट।', 'Apni dukaan chalao: billing, stock, udhaar, khareed, GST aur report.')}</p>
                <span className="lp-side-tag">{t('30-day free trial, then a plan', '30 दिन ट्रायल, फिर plan', '30 din trial, phir plan')}</span>
                <span className="lp-side-go">{t('See Workspace', 'Workspace देखें', 'Workspace dekho')} <ArrowRight size={14} aria-hidden /></span>
              </a>
            </Reveal>
            <Reveal delay={120}>
              <a href="#mart" className="lp-side lp-side-mart">
                <div className="lp-side-art" aria-hidden><span className="sa-q" /><span className="sa-q best" /><span className="sa-q" /></div>
                <ShoppingCart size={28} strokeWidth={1.5} aria-hidden />
                <h3>Business Mart</h3>
                <p>{t('Buy from and sell to other businesses. Requests, quotes, orders and chat.', 'दूसरे बिज़नेस से खरीदें और बेचें। Request, quote, order और chat।', 'Dusre business se khareedo aur becho. Request, quote, order aur chat.')}</p>
                <span className="lp-side-tag">{t('Free, always', 'हमेशा मुफ़्त', 'Hamesha free')}</span>
                <span className="lp-side-go">{t('See Business Mart', 'Business Mart देखें', 'Business Mart dekho')} <ArrowRight size={14} aria-hidden /></span>
              </a>
            </Reveal>
          </div>
        </section>

        {/* Workspace */}
        <section className="lp-section" id="workspace" aria-labelledby="ws-h">
          <Reveal>
            <span className="lp-kicker lp-kicker-ws">Workspace</span>
            <h2 id="ws-h">{t('Everything the counter needs', 'काउंटर की हर ज़रूरत', 'Counter ki har zaroorat')}</h2>
            <p className="lp-section-sub">{t('Workspace replaces the billing app, the khata app and the register. These are the real screens you will use every day.', 'Workspace बिलिंग ऐप, खाता ऐप और रजिस्टर — तीनों की जगह। ये वही असली स्क्रीन हैं जो आप रोज़ चलाएंगे।', 'Workspace billing app, khata app aur register — teeno ki jagah. Ye wahi asli screens hain jo aap roz chalaoge.')}</p>
          </Reveal>
          <WorkspaceTour />
          <ul className="lp-everywhere">
            {everywhere.map(([icon, h, p], k) => (
              <li key={h}><Reveal delay={k * 70}><span className="ev-ic">{icon}</span><b>{h}</b><span>{p}</span></Reveal></li>
            ))}
          </ul>
        </section>

        {/* a day */}
        <section className="lp-section" aria-labelledby="day-h">
          <Reveal>
            <h2 id="day-h">{t('A day with BizYour', 'BizYour के साथ एक दिन', 'BizYour ke saath ek din')}</h2>
            <p className="lp-section-sub">{t('From the moment the shop opens till it closes, BizYour stays with you at every hour. Tap a time of day.', 'दुकान खुलने से बंद होने तक, हर पहर BizYour साथ। दिन का कोई समय चुनें।', 'Dukaan khulne se band hone tak, har pehar BizYour saath. Din ka koi time chuno.')}</p>
          </Reveal>
          <DayWithBizYour />
        </section>

        {/* Business Mart */}
        <section className="lp-section lp-mart" id="mart" aria-labelledby="mart-h">
          <Reveal>
            <span className="lp-kicker lp-kicker-mart">Business Mart · {t('Free, always', 'हमेशा मुफ़्त', 'Hamesha free')}</span>
            <h2 id="mart-h">{t('Business Mart: the shops’ own wholesale bazaar', 'Business Mart: दुकानों का अपना थोक बाज़ार', 'Business Mart: dukaanon ka apna wholesale bazaar')}</h2>
            <p className="lp-section-sub">{t('A bazaar inside BizYour, where shops deal directly with wholesalers. No middleman, no running around. Stop calling five wholesalers for one rate: post once, compare quotes, order the best.', 'BizYour के अंदर ही एक बाज़ार, जहाँ दुकानें सीधे थोक वालों से जुड़ती हैं। न दलाल, न चक्कर। एक रेट के लिए पाँच फ़ोन नहीं: एक बार बताइए, quote मिलाइए, सबसे अच्छा order कीजिए।', 'BizYour ke andar hi ek bazaar, jahan dukaanen seedha wholesalers se judti hain. Na dalaal, na chakkar. Ek rate ke liye paanch phone nahi: ek baar batao, quote milao, best order karo.')}</p>
          </Reveal>
          <MartTour />
          <div className="lp-mart-notes">
            <p className="lp-mart-sell">{t('Selling wholesale? Set up your seller profile and catalogue, get matching leads from shops and send quotes from the same app.', 'थोक बेचते हैं? Seller profile और catalogue बनाइए, दुकानों से leads पाइए, उसी ऐप से quote भेजिए।', 'Wholesale bechte ho? Seller profile aur catalogue banao, dukaanon se leads pao, usi app se quote bhejo.')}</p>
            <p className="lp-mart-one">{t('Workspace and Business Mart — ', 'Workspace और Business Mart — ', 'Workspace aur Business Mart — ')}<b>{t('one login, one app.', 'एक ही login, एक ही ऐप।', 'ek hi login, ek hi app.')}</b></p>
          </div>
        </section>

        {/* comparison */}
        <section className="lp-section" aria-labelledby="cmp-h">
          <Reveal>
            <h2 id="cmp-h">{t('One app, ', 'एक ऐप, ', 'Ek app, ')}<em>{t('better than many', 'कई ऐप से बेहतर', 'kai apps se behtar')}</em></h2>
            <p className="lp-section-sub">{t('A separate app for every job, or everything in BizYour. See for yourself.', 'हर काम के लिए अलग ऐप — या सब कुछ BizYour में। खुद देख लीजिए।', 'Har kaam ke liye alag app — ya sab kuch BizYour me. Khud dekh lo.')}</p>
          </Reveal>
          <Reveal>
            <div className="lp-cmp" role="table" aria-label={t('Separate apps compared with BizYour', 'अलग ऐप बनाम BizYour', 'Alag apps vs BizYour')}>
              <div className="lp-cmp-row lp-cmp-head" role="row">
                <span role="columnheader">{t('Job', 'काम', 'Kaam')}</span>
                <span role="columnheader">{t('Separate apps', 'अलग-अलग ऐप', 'Alag-alag apps')}</span>
                <span role="columnheader" className="lp-cmp-us"><img src="/bizyour-mark-512.png?v=c" alt="" width={18} height={18} /> BizYour</span>
              </div>
              {compare.map(([job, them, us]) => (
                <div className="lp-cmp-row" role="row" key={job}>
                  <b role="cell">{job}</b>
                  <span role="cell" className="lp-cmp-no"><X size={15} aria-label={t('No', 'नहीं', 'Nahi')} /> {them}</span>
                  <span role="cell" className="lp-cmp-yes"><Check size={15} aria-label={t('Yes', 'हाँ', 'Haan')} /> {us}</span>
                </div>
              ))}
            </div>
            <p className="lp-cmp-note">{t('The point is simple: separate apps mean separate subscriptions and separate data. BizYour keeps everything in one place.', 'बात सीधी है: अलग ऐप मतलब अलग सब्सक्रिप्शन और अलग डेटा। BizYour सब कुछ एक जगह रखता है।', 'Baat seedhi hai: alag apps matlab alag subscription aur alag data. BizYour sab kuch ek jagah rakhta hai.')}</p>
          </Reveal>
        </section>

        {/* how to start */}
        <section className="lp-section" aria-labelledby="how-h">
          <Reveal>
            <h2 id="how-h">{t('How to start', 'कैसे शुरू करें', 'Kaise shuru karein')}</h2>
            <p className="lp-section-sub">{t('Three steps. Two minutes. Done.', 'तीन step. दो मिनट. बस।', 'Teen step. Do minute. Khatam.')}</p>
          </Reveal>
          <ol className="lp-how">
            <li><Reveal delay={0}>
              <div className="how-art" aria-hidden><div className="how-otp"><span>4</span><span>8</span><span>2</span><span className="blink" /></div></div>
              <span className="how-n">1</span><b>{t('Sign up with email (OTP)', 'Email से signup (OTP)', 'Email se signup (OTP)')}</b>
              <span>{t('Enter your email, verify the OTP, and your account is ready.', 'Email डालें, OTP verify करें — बस, account तैयार।', 'Email dalo, OTP verify karo — bas, account taiyaar.')}</span>
            </Reveal></li>
            <li><Reveal delay={120}>
              <div className="how-art" aria-hidden><div className="how-trial"><small>{t('Trial', 'ट्रायल', 'Trial')}</small><b>{t('Day 1 of 30', '30 में से दिन 1', '30 me se din 1')}</b><i><em /></i></div></div>
              <span className="how-n">2</span><b>{t('30-day free trial', '30 दिन फ्री ट्रायल', '30 din free trial')}</b>
              <span>{t('Every feature open. No card, no restrictions.', 'हर feature खुला। कोई card नहीं, कोई रोक-टोक नहीं।', 'Saare features khule. Koi card nahi, koi rok-tok nahi.')}</span>
            </Reveal></li>
            <li><Reveal delay={240}>
              <div className="how-art" aria-hidden><div className="how-plan"><span className="on">{t('Monthly', 'मासिक', 'Monthly')}</span><span>{t('Yearly', 'सालाना', 'Yearly')}</span></div></div>
              <span className="how-n">3</span><b>{t('Like it? Take a plan', 'पसंद आए तो plan लें', 'Pasand aaye to plan lo')}</b>
              <span>{t('All your data stays right there. Nothing to fill in again.', 'आपका सारा डेटा वहीं रहेगा — कुछ दोबारा नहीं भरना।', 'Aapka saara data wahi rahega — kuch dobara nahi bharna.')}</span>
            </Reveal></li>
          </ol>
        </section>

        {/* who */}
        <section className="lp-section" aria-labelledby="who-h">
          <Reveal>
            <h2 id="who-h">{t('Made for shops that sell goods', 'सामान बेचने वाली दुकानों के लिए', 'Saaman bechne wali dukaanon ke liye')}</h2>
            <p className="lp-section-sub">{t('If you make bills, keep stock and give credit, BizYour fits.', 'अगर आप बिल बनाते हैं, स्टॉक रखते हैं और उधार देते हैं — BizYour आपके लिए है।', 'Agar aap bill banate ho, stock rakhte ho aur udhaar dete ho — BizYour aapke liye hai.')}</p>
          </Reveal>
          <ul className="lp-who">
            {who.map(([icon, h, p], k) => <li key={h}><Reveal delay={(k % 3) * 80}><span className="who-ic">{icon}</span><b>{h}</b><span>{p}</span></Reveal></li>)}
          </ul>
        </section>

        {/* pricing */}
        <section className="lp-section" id="pricing" aria-labelledby="price-h">
          <Reveal>
            <h2 id="price-h">{t('What it costs', 'कितना लगेगा', 'Kitna lagega')}</h2>
            <p className="lp-section-sub">{t('The first 30 days are completely free. No card needed. Run your shop first, decide later.', 'पहले 30 दिन बिल्कुल मुफ़्त। कोई card नहीं। पहले दुकान चलाइए, फ़ैसला बाद में।', 'Pehle 30 din bilkul free. Koi card nahi. Pehle dukaan chalao, faisla baad me.')}</p>
          </Reveal>
          <div className="lp-price">
            <Reveal className="lp-price-col lp-price-mart">
              <h3><ShoppingCart size={16} aria-hidden /> Business Mart</h3>
              <div className="lp-price-big">{t('Free', 'मुफ़्त', 'Free')}</div>
              <p>{t('For every business, always. Post requests, send quotes, place and receive orders. Even if your Workspace plan ends.', 'हर बिज़नेस के लिए, हमेशा। Request, quote, order — Workspace plan खत्म होने पर भी।', 'Har business ke liye, hamesha. Request, quote, order — Workspace plan khatam hone pe bhi.')}</p>
            </Reveal>
            <Reveal className="lp-price-col lp-price-ws" delay={120}>
              <h3><BookOpenText size={16} aria-hidden /> Workspace</h3>
              <div className="lp-price-big">{t('30 days free', '30 दिन मुफ़्त', '30 din free')}</div>
              <p>{t('Every feature open, no card needed. After 30 days choose a monthly or yearly plan in Settings. If you don’t, your data stays safe and readable, and you can renew any time.', 'हर feature खुला, कोई card नहीं। 30 दिन बाद Settings में महीने या साल का plan लें। न लें तो भी डेटा सुरक्षित और दिखता रहेगा, कभी भी renew करें।', 'Har feature khula, koi card nahi. 30 din baad Settings me monthly ya yearly plan lo. Na lo to bhi data safe aur dikhta rahega, kabhi bhi renew karo.')}</p>
              <Link to="/signup" className="btn btn-primary">{t('Start the free trial', 'फ्री ट्रायल शुरू करें', 'Free trial shuru karo')}</Link>
            </Reveal>
          </div>
        </section>

        {/* FAQ */}
        <section className="lp-section" id="faq" aria-labelledby="faq-h">
          <div className="lp-faq-wrap">
            <Reveal>
              <h2 id="faq-h">{t('Questions', 'सवाल', 'Sawaal')}</h2>
              <p className="lp-section-sub">{t('Straight answers, no fine print.', 'सीधे जवाब, कोई छोटे अक्षर नहीं।', 'Seedhe jawaab, koi chhota akshar nahi.')}</p>
            </Reveal>
            <div className="lp-faq">
              <Faq open q={t('How much does it cost?', 'इसकी कीमत कितनी है?', 'Iska price kitna hai?')} a={t('Business Mart is free. Workspace is completely free for the first 30 days, with no card needed. After the trial you choose a plan; all your data and work stay exactly as they are.', 'Business Mart मुफ़्त है। Workspace पहले 30 दिन बिल्कुल मुफ़्त, कोई card नहीं। ट्रायल के बाद plan चुनें; आपका सारा डेटा और काम वैसा ही रहेगा।', 'Business Mart free hai. Workspace pehle 30 din bilkul free, koi card nahi. Trial ke baad plan chuno; aapka saara data aur kaam waisa hi rahega.')} />
              <Faq q={t('Is Business Mart really free?', 'क्या Business Mart सच में मुफ़्त है?', 'Kya Business Mart sach me free hai?')} a={t('Yes. Business Mart is free for every business, with no trial and no end date. Only Workspace has a 30-day trial and then a paid plan.', 'हाँ। Business Mart हर बिज़नेस के लिए मुफ़्त है, कोई ट्रायल या आख़िरी तारीख नहीं। सिर्फ़ Workspace का 30 दिन ट्रायल, फिर plan।', 'Haan. Business Mart har business ke liye free hai, koi trial ya last date nahi. Sirf Workspace ka 30 din trial, phir plan.')} />
              <Faq q={t('What happens after the Workspace trial?', 'Workspace ट्रायल के बाद क्या?', 'Workspace trial ke baad kya?')} a={t('You choose a monthly or yearly plan. If you wait, Workspace turns read-only: you can still see and export everything, nothing is deleted. Business Mart keeps working.', 'महीने या साल का plan चुनें। रुकें तो Workspace सिर्फ़ देखने लायक रहेगा — सब दिखेगा और export होगा, कुछ delete नहीं। Business Mart चलता रहेगा।', 'Monthly ya yearly plan chuno. Ruko to Workspace sirf dekhne layak rahega — sab dikhega aur export hoga, kuch delete nahi. Business Mart chalta rahega.')} />
              <Faq q={t('Is internet necessary?', 'क्या इंटरनेट ज़रूरी है?', 'Kya internet zaroori hai?')} a={t('No. Billing also works offline. Bills keep getting made, and the data syncs when the internet comes back.', 'नहीं। बिलिंग ऑफ़लाइन भी होती है — बिल बनते रहते हैं, और नेट आते ही डेटा sync हो जाता है।', 'Nahi. Billing offline bhi hoti hai — bill bante rehte hain, aur net aate hi data sync ho jata hai.')} />
              <Faq q={t('Does it handle GST?', 'क्या GST होता है?', 'Kya GST hota hai?')} a={t('Yes. GST bills, a full GST report and a ready GSTR-1 file for your CA, all from the same data. Shops without GST can turn it off.', 'हाँ। GST बिल, पूरी GST रिपोर्ट और CA के लिए तैयार GSTR-1 फ़ाइल, सब उसी डेटा से। बिना GST वाली दुकान इसे बंद कर सकती है।', 'Haan. GST bill, poori GST report aur CA ke liye taiyaar GSTR-1 file, sab usi data se. Bina GST wali dukaan ise band kar sakti hai.')} />
              <Faq q={t('Can my staff use it?', 'क्या स्टाफ चला सकता है?', 'Kya staff chala sakta hai?')} a={t('Yes. Each staff member gets their own login with role limits, like billing and stock only. Profit and reports stay with the owner.', 'हाँ। हर स्टाफ का अपना login, role की सीमा के साथ, जैसे सिर्फ़ बिलिंग और स्टॉक। मुनाफ़ा और रिपोर्ट सिर्फ़ मालिक को।', 'Haan. Har staff ka apna login, role limit ke saath, jaise sirf billing aur stock. Profit aur report sirf owner ko.')} />
              <Faq q={t('Do I need a computer?', 'क्या कंप्यूटर चाहिए?', 'Kya computer chahiye?')} a={t('No. It runs in the browser on a phone, tablet or computer. Open bizyour.in and log in.', 'नहीं। फ़ोन, टैबलेट या कंप्यूटर के browser में चलता है। bizyour.in खोलें और login करें।', 'Nahi. Phone, tablet ya computer ke browser me chalta hai. bizyour.in kholo aur login karo.')} />
              <Faq q={t('Is my data safe?', 'क्या डेटा सुरक्षित है?', 'Kya data safe hai?')} a={t('Your data is yours. Every shop sees only its own data, and you can back up or export it whenever you want. No lock-in.', 'डेटा आपका है। हर दुकान सिर्फ़ अपना डेटा देखती है, और आप कभी भी backup या export कर सकते हैं। कोई lock-in नहीं।', 'Data aapka hai. Har dukaan sirf apna data dekhti hai, aur aap kabhi bhi backup ya export kar sakte ho. Koi lock-in nahi.')} />
              <Faq q={t('Which languages does it work in?', 'यह किन भाषाओं में चलता है?', 'Ye kin bhaashaon me chalta hai?')} a={t('English, Hindi and Hinglish. Switch any time, whichever feels easy.', 'English, हिंदी और Hinglish — कभी भी बदलें, जो आसान लगे।', 'English, Hindi aur Hinglish — kabhi bhi badlo, jo aasan lage.')} />
            </div>
          </div>
        </section>

        {/* builders */}
        <section className="lp-team" aria-labelledby="team-h" data-nav-tone="dark">
          <div className="lp-team-in">
            <div className="lp-team-copy">
              <img src="/bizyour-mark-512.png?v=c" alt="" width={52} height={52} />
              <span className="lp-team-eyebrow">TEAM DILIGENCE</span>
              <h2 id="team-h">{t('Proudly built by IITians at DILIGENCE', 'DILIGENCE के IITians ने गर्व से बनाया', 'DILIGENCE ke IITians ne garv se banaya')}</h2>
              <p>{t('BizYour is not a faceless corporate product. It is built line by line by Team DILIGENCE, IITians who understand how India’s shops actually run.', 'BizYour कोई बेनाम कॉर्पोरेट प्रोडक्ट नहीं। इसे Team DILIGENCE के IITians लाइन-दर-लाइन बनाते हैं, जो जानते हैं कि भारत की दुकानें असल में कैसे चलती हैं।', 'BizYour koi benaam corporate product nahi. Ise Team DILIGENCE ke IITians line-by-line banate hain, jo jaante hain ki India ki dukaanen asal me kaise chalti hain.')}</p>
              <a className="lp-team-link" href="https://thediligence.in" target="_blank" rel="noopener noreferrer">{t('Meet DILIGENCE', 'DILIGENCE के बारे में', 'DILIGENCE ke baare me')} <ArrowUpRight size={15} aria-hidden /></a>
            </div>
            <ul className="lp-team-facts">
              <li><b>{t('Made in Delhi', 'दिल्ली में बना', 'Delhi me bana')}</b><span>{t('A small team you can actually reach, not a ticket queue.', 'छोटी टीम जिससे सच में बात हो सकती है।', 'Chhoti team jisse sach me baat ho sakti hai.')}</span></li>
              <li><b>{t('Shaped by the counter', 'काउंटर से सीखकर बना', 'Counter se seekhkar bana')}</b><span>{t('GST bills, udhaar, UPI and WhatsApp reminders are the core, not add-ons.', 'GST बिल, उधार, UPI और WhatsApp reminder इसका मूल हैं, ऐड-ऑन नहीं।', 'GST bill, udhaar, UPI aur WhatsApp reminder iska mool hain, add-on nahi.')}</span></li>
              <li><b>{t('Your language', 'आपकी भाषा', 'Aapki bhasha')}</b><span>{t('English, हिंदी and Hinglish across every screen.', 'हर स्क्रीन पर English, हिंदी और Hinglish।', 'Har screen par English, हिंदी aur Hinglish.')}</span></li>
            </ul>
          </div>
        </section>

        {/* final call */}
        <section className="lp-close" aria-labelledby="final-h">
          <div className="lp-final">
            <div>
              <h2 id="final-h">{t('Open your shop on BizYour today.', 'आज ही अपनी दुकान BizYour पर खोलें।', 'Aaj hi apni dukaan BizYour pe kholo.')}</h2>
              <p>{t('Two minutes to sign up with your email. Business Mart free forever, Workspace free for 30 days. No card needed.', 'email से दो मिनट में signup। Business Mart हमेशा मुफ़्त, Workspace 30 दिन मुफ़्त। कोई card नहीं।', 'Email se do minute me signup. Business Mart hamesha free, Workspace 30 din free. Koi card nahi.')}</p>
              <div className="lp-final-act">
                <Link to="/signup" className="btn btn-primary btn-lg">{t('Create free account', 'मुफ़्त account बनाएं', 'Free account banao')}</Link>
                <Link to="/login" className="lp-final-login">{t('Already have an account? Log in', 'पहले से account है? Log in', 'Pehle se account hai? Log in')}</Link>
              </div>
            </div>
            <div className="lp-final-art" aria-hidden>
              <IPhone className="final-phone" label="">
                <div className="ps">
                  <PhoneBar title="Sharma General Store" sub="Workspace" />
                  <div className="ps-cards">
                    <div><small>{t('Sold today', 'आज की बिक्री', 'Aaj ki bikri')}</small><b>₹1,128</b></div>
                    <div className="in"><small>{t('Received', 'मिला', 'Mila')}</small><b>₹543</b></div>
                  </div>
                  <div className="ps-row"><span>Walk-in</span><b>₹73</b></div>
                  <div className="ps-row"><span>Priya Sharma</span><b>₹300</b></div>
                  <div className="ps-row"><span>Ramesh Gupta</span><b>₹755</b></div>
                </div>
              </IPhone>
            </div>
          </div>
        </section>
      </main>
 {/* contact us */}
        <section className="lp-contact" aria-labelledby="contact-h">
          <div className="lp-contact-box">
            <h2 id="contact-h">{t('Contact us', 'संपर्क करें', 'Sampark karein')}</h2>
            <p>{t('Questions about BizYour? Talk to a real person from Team DILIGENCE.', 'BizYour के बारे में कोई सवाल? Team DILIGENCE से सीधे बात करें।', 'BizYour ke baare me koi sawaal? Team DILIGENCE se seedha baat karein.')}</p>
            <div className="lp-contact-cards">
              <a className="lp-contact-card" href={`tel:${CONTACT_PHONE_LINK}`}>
                <span>{t('Call us', 'कॉल करें', 'Call karein')}</span>
                <b>{CONTACT_PHONE_DISPLAY}</b>
              </a>
              <a className="lp-contact-card" href={`mailto:${CONTACT_EMAIL}`}>
                <span>{t('Email us', 'ईमेल करें', 'Email karein')}</span>
                <b>{CONTACT_EMAIL}</b>
              </a>
            </div>
          </div>
        </section>
      
      <footer className="lp-foot">
        <div className="lp-foot-grid">
          <div className="lp-foot-about">
            <div className="lp-logo">
              <img src="/bizyour-mark-512.png?v=c" alt="" width={34} height={34} />
              <span><b>BizYour</b><small>by DILIGENCE</small></span>
            </div>
            <p>{t('Made for shopkeepers, from billing to the bazaar.', 'दुकानदारों के लिए बना, बिलिंग से लेकर बाज़ार तक।', 'Dukaandaaron ke liye bana, billing se lekar bazaar tak.')}</p>
          </div>
          <nav aria-label={t('Product', 'प्रोडक्ट', 'Product')}>
            <h3>{t('Product', 'प्रोडक्ट', 'Product')}</h3>
            <a href="#workspace">Workspace</a>
            <a href="#mart">Business Mart</a>
            <a href="#pricing">{t('Pricing', 'कीमत', 'Pricing')}</a>
            <a href="#faq">{t('Questions', 'सवाल', 'Sawaal')}</a>
          </nav>
          <nav aria-label={t('Account', 'अकाउंट', 'Account')}>
            <h3>{t('Account', 'अकाउंट', 'Account')}</h3>
            <Link to="/signup">{t('Create free account', 'मुफ़्त account बनाएं', 'Free account banao')}</Link>
            <Link to="/login">{t('Log in', 'लॉग इन', 'Log in')}</Link>
            <Link to="/forgot">{t('Forgot password', 'पासवर्ड भूल गए', 'Password bhool gaye')}</Link>
          </nav>
          <div>
            <h3>{t('Company', 'कंपनी', 'Company')}</h3>
            <a href="https://thediligence.in" target="_blank" rel="noopener noreferrer">DILIGENCE <ArrowUpRight size={13} aria-hidden /></a>
            <p>{t('Business Automation and Custom Systems, Delhi', 'Business Automation और Custom Systems, दिल्ली', 'Business Automation aur Custom Systems, Delhi')}</p>
            <p>{t('Help is built into the app, with a full guide in Hindi too.', 'Help ऐप के अंदर ही है, हिंदी में पूरी guide के साथ।', 'Help app ke andar hi hai, Hindi me poori guide ke saath.')}</p>
          </div>
        </div>
        <div className="lp-foot-base">
          <span>© 2026 BizYour by DILIGENCE</span>
          <span>{t('BizYour is a product of DILIGENCE.', 'BizYour, DILIGENCE का प्रोडक्ट है।', 'BizYour, DILIGENCE ka product hai.')} <a href="https://thediligence.in" target="_blank" rel="noopener noreferrer">thediligence.in</a></span>
        </div>
      </footer>
    </div>
  );
}
