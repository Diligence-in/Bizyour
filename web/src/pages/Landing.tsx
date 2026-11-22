import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpenText, ChevronDown, ShoppingCart } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { LangSwitch } from '../components/shell/AppShell';
import '../styles/landing.css';

// Public home page at bizyour.in for visitors who are not logged in.
// Content comes from the original landing page, tightened and corrected:
// Business Mart is free forever, only Workspace has the 30-day trial.

/* ---------- logo intro: once per browser session ---------- */
const INTRO_KEY = 'bos_intro_seen';
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
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
      return true;
    } catch { return false; }
  });
  const done = () => { try { sessionStorage.setItem(INTRO_KEY, '1'); } catch { /* ignore */ } setShow(false); };
  return { show, done };
}

/* ---------- the hero bill: a real-looking page of the bahi ---------- */
function HeroBill() {
  const { t } = useI18n();
  const rows: [string, string, string][] = [
    ['Aashirvaad Atta 5kg', '2', '₹ 590.00'],
    ['Tata Salt 1kg', '4', '₹ 112.00'],
    ['Fortune Soya Oil 1L', '3', '₹ 495.00'],
    ['Parle-G 800g', '2', '₹ 180.00']
  ];
  return (
    <figure className="hero-bill" aria-label={t('Example bill made in BizYour', 'BizYour में बना एक बिल', 'BizYour me bana ek bill')}>
      <div className="hb-head">
        <div>
          <div className="hb-shop">Sharma General Store</div>
          <div className="hb-meta">Lajpat Nagar, Delhi · GSTIN 07ABCDE1234F1Z5</div>
        </div>
        <div className="hb-no num">INV-0142</div>
      </div>
      <table className="hb-table">
        <thead><tr><th>{t('Item', 'सामान', 'Saaman')}</th><th className="num">{t('Qty', 'मात्रा', 'Qty')}</th><th className="num">{t('Amount', 'रकम', 'Amount')}</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r[0]}><td>{r[0]}</td><td className="num">{r[1]}</td><td className="num">{r[2]}</td></tr>)}</tbody>
      </table>
      <div className="hb-sum">
        <div><span>{t('GST included', 'GST शामिल', 'GST shamil')}</span><span className="num">₹ 98.32</span></div>
        <div className="hb-total"><span>{t('Total', 'कुल', 'Total')}</span><span className="num">₹ 1,377.00</span></div>
      </div>
      <div className="hb-foot">
        <img className="hb-qr" src="/landing/qr-diligence.svg?v=c" alt="QR code" width={72} height={72} />
        <div>
          <div className="hb-paid">{t('Scan to pay by UPI', 'UPI से भुगतान के लिए scan करें', 'UPI se pay karne ke liye scan karo')}</div>
          <div className="hb-meta">{t('Stock updated · Shared on WhatsApp', 'स्टॉक अपडेट · WhatsApp पर भेजा', 'Stock update · WhatsApp pe bheja')}</div>
        </div>
      </div>
    </figure>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="lp-faq-item">
      <summary><span>{q}</span><ChevronDown size={18} aria-hidden /></summary>
      <p>{a}</p>
    </details>
  );
}

export default function Landing() {
  const { t } = useI18n();
  const intro = useIntro();
  useEffect(() => { document.title = 'BizYour — billing, stock, udhaar and a B2B bazaar for your shop'; }, []);

  const features: [string, string][] = [
    [t('GST billing', 'GST बिलिंग', 'GST billing'), t('A bill in seconds. GST works itself out, UPI QR prints on the bill, share it on WhatsApp.', 'सेकंडों में बिल। GST अपने आप, बिल पर UPI QR, WhatsApp पर भेजें।', 'Seconds me bill. GST apne aap, bill pe UPI QR, WhatsApp pe bhejo.')],
    [t('Stock', 'स्टॉक', 'Stock'), t('Every bill and purchase moves stock. Low-stock alerts before you run out.', 'हर बिल और खरीद से स्टॉक बदलता है। खत्म होने से पहले alert।', 'Har bill aur khareed se stock badalta hai. Khatam hone se pehle alert.')],
    [t('Udhaar khata', 'उधार खाता', 'Udhaar khata'), t('Who owes what, due dates, WhatsApp reminders and a Hisab link your customer opens without logging in.', 'किसका कितना बाकी, due date, WhatsApp reminder और ग्राहक के लिए बिना login वाला हिसाब link।', 'Kiska kitna baaki, due date, WhatsApp reminder aur customer ke liye bina login wala Hisab link.')],
    [t('Estimate to bill', 'एस्टीमेट से बिल', 'Estimate se bill'), t('Give an estimate first. If they agree, it becomes a bill in one click.', 'पहले एस्टीमेट दें, हाँ हो तो एक click में बिल।', 'Pehle estimate do, haan ho to ek click me bill.')],
    [t('Returns', 'वापसी', 'Return'), t('Credit notes for returned goods, so the books stay clean.', 'लौटे माल पर credit note — हिसाब साफ़।', 'Lautay maal pe credit note — hisaab saaf.')],
    [t('Purchases and suppliers', 'खरीद और सप्लायर', 'Khareed aur supplier'), t('Record what you buy and what you owe each supplier.', 'क्या खरीदा, किस सप्लायर का कितना देना है।', 'Kya khareeda, kis supplier ka kitna dena hai.')],
    [t('Profit and day-end', 'मुनाफ़ा और दिन-अंत', 'Profit aur day-end'), t('Today’s sale, credit and cash at a glance. Monthly profit without a CA.', 'आज की बिक्री, उधार और नकद एक नज़र में। CA के बिना महीने का मुनाफ़ा।', 'Aaj ki bikri, udhaar aur cash ek nazar me. CA ke bina mahine ka profit.')],
    [t('GSTR-1 file', 'GSTR-1 फ़ाइल', 'GSTR-1 file'), t('At month end, the GSTR-1 ready file for your CA in one click.', 'महीने के अंत में CA के लिए GSTR-1 फ़ाइल एक click में।', 'Mahine ke end me CA ke liye GSTR-1 file ek click me.')],
    [t('Bring your old data', 'पुराना डेटा लाएं', 'Purana data lao'), t('Import products and customers from Vyapar, Tally or Excel.', 'Vyapar, Tally या Excel से सामान और ग्राहक import करें।', 'Vyapar, Tally ya Excel se saaman aur customer import karo.')],
    [t('Staff logins', 'स्टाफ लॉगिन', 'Staff login'), t('Staff get their own login with limits. Profit stays visible only to you.', 'स्टाफ का अपना login, सीमा के साथ। मुनाफ़ा सिर्फ़ आपको दिखे।', 'Staff ka apna login, limit ke saath. Profit sirf aapko dikhe.')],
    [t('Three languages', 'तीन भाषाएं', 'Teen bhaasha'), t('English, हिंदी or Hinglish. Switch any time.', 'English, हिंदी या Hinglish — कभी भी बदलें।', 'English, हिंदी ya Hinglish — kabhi bhi badlo.')],
    [t('Your data, your backup', 'आपका डेटा, आपका backup', 'Aapka data, aapka backup'), t('Take a backup or export everything whenever you want. No lock-in.', 'जब चाहें backup लें या सब export करें।', 'Jab chaho backup lo ya sab export karo.')]
  ];

  const martSteps: [string, string][] = [
    [t('Post what you need', 'ज़रूरत बताइए', 'Zaroorat batao'), t('Item, quantity and your city. Takes a minute.', 'सामान, मात्रा और शहर। एक मिनट।', 'Saaman, quantity aur shehar. Ek minute.')],
    [t('Wholesalers quote', 'थोक वाले quote भेजें', 'Wholesalers quote bhejein'), t('Sellers who serve your area send their rate, delivery days and terms.', 'आपके इलाके के seller रेट, delivery और शर्तें भेजते हैं।', 'Aapke ilaake ke seller rate, delivery aur terms bhejte hain.')],
    [t('Compare and order', 'तुलना करें, order दें', 'Compare karo, order do'), t('All quotes side by side, landed cost included. Accept the best one.', 'सारे quote साथ-साथ, पूरी लागत के साथ। सबसे अच्छा चुनें।', 'Saare quote saath-saath, poori laagat ke saath. Best chuno.')],
    [t('Goods land in stock', 'माल सीधे स्टॉक में', 'Maal seedha stock me'), t('Mark it received and it is added to your Workspace stock as a purchase.', 'माल मिलने पर Workspace स्टॉक में खरीद के रूप में जुड़ जाता है।', 'Maal milne pe Workspace stock me khareed ke roop me jud jaata hai.')]
  ];

  const day: [string, string, string][] = [
    [t('Morning', 'सुबह', 'Subah'), t('Shop opens', 'दुकान खुली', 'Dukaan khuli'), t('Yesterday’s day-end and today’s due payments are waiting on the home screen.', 'कल का हिसाब और आज के बकाया होम स्क्रीन पर।', 'Kal ka hisaab aur aaj ke baaki home screen pe.')],
    [t('All day', 'पूरा दिन', 'Poora din'), t('Billing at the counter', 'काउंटर पर बिलिंग', 'Counter pe billing'), t('Every bill moves stock. The customer pays by UPI from the QR on the bill.', 'हर बिल से स्टॉक बदले। ग्राहक बिल के QR से UPI करे।', 'Har bill se stock badle. Customer bill ke QR se UPI kare.')],
    [t('Evening', 'शाम', 'Shaam'), t('Collect udhaar', 'उधार वसूली', 'Udhaar vasooli'), t('Send a WhatsApp reminder with their Hisab link. No awkward phone call.', 'Hisab link के साथ WhatsApp reminder। कोई झिझक नहीं।', 'Hisab link ke saath WhatsApp reminder. Koi jhijhak nahi.')],
    [t('Night', 'रात', 'Raat'), t('Close the day', 'दिन बंद', 'Din band'), t('What sold, what went on credit, how much cash came in. Then restock on Business Mart.', 'क्या बिका, कितना उधार, कितना नकद। फिर Business Mart से माल मंगाएं।', 'Kya bika, kitna udhaar, kitna cash. Phir Business Mart se maal mangao.')]
  ];

  const who: [string, string][] = [
    [t('Kirana and general stores', 'किराना और जनरल स्टोर', 'Kirana aur general store'), t('Fast counter billing, daily stock, regular customers on credit.', 'तेज़ बिलिंग, रोज़ का स्टॉक, उधार वाले ग्राहक।', 'Tez billing, roz ka stock, udhaar wale customer.')],
    [t('Garments', 'कपड़े', 'Kapde'), t('Many sizes and colours, one clean stock list.', 'कई साइज़-रंग, एक साफ़ स्टॉक।', 'Kai size-rang, ek saaf stock.')],
    [t('Mobile and electronics', 'मोबाइल और इलेक्ट्रॉनिक्स', 'Mobile aur electronics'), t('Costly stock and part payments, tracked properly.', 'महंगा स्टॉक और किस्तें, सही हिसाब।', 'Mehenga stock aur kist, sahi hisaab.')],
    [t('Hardware and sanitary', 'हार्डवेयर और सैनिटरी', 'Hardware aur sanitary'), t('Thousands of small items, rates always at hand.', 'हज़ारों छोटे सामान, रेट हमेशा सामने।', 'Hazaron chhote saaman, rate hamesha saamne.')],
    [t('Wholesalers and distributors', 'थोक और डिस्ट्रीब्यूटर', 'Wholesale aur distributor'), t('Get leads from shops on Business Mart, bill them from Workspace.', 'Business Mart पर दुकानों से leads, Workspace से बिल।', 'Business Mart pe dukaanon se leads, Workspace se bill.')]
  ];

  return (
    <div className="lp">
      {intro.show && <Intro onDone={intro.done} />}

      <header className="lp-nav">
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
      </header>

      <main>
        {/* hero: headline written on a ledger page */}
        <section className="lp-hero">
          <div className="lp-hero-page">
            <h1>{t('Your whole shop, in one app.', 'आपकी पूरी दुकान, एक ऐप में।', 'Aapki poori dukaan, ek app me.')}</h1>
            <p className="lp-lede">{t(
              'Bills, stock, udhaar and GST in Workspace. Buying from wholesalers in Business Mart. One login for both, made for Indian shops.',
              'Workspace में बिल, स्टॉक, उधार और GST। Business Mart में थोक वालों से खरीद। दोनों के लिए एक login, भारतीय दुकानों के लिए।',
              'Workspace me bill, stock, udhaar aur GST. Business Mart me wholesalers se khareed. Dono ke liye ek login, Indian dukaanon ke liye.')}</p>
            <div className="lp-cta-row">
              <Link to="/signup" className="btn btn-primary btn-lg" data-testid="hero-signup">{t('Create free account', 'मुफ़्त account बनाएं', 'Free account banao')}</Link>
              <Link to="/login" className="btn btn-secondary btn-lg">{t('Log in', 'लॉग इन', 'Log in')}</Link>
            </div>
            <dl className="lp-terms">
              <div><dt>Business Mart</dt><dd>{t('Free, always', 'हमेशा मुफ़्त', 'Hamesha free')}</dd></div>
              <div><dt>Workspace</dt><dd>{t('30 days free, no card', '30 दिन मुफ़्त, कोई card नहीं', '30 din free, koi card nahi')}</dd></div>
            </dl>
          </div>
          <HeroBill />
        </section>

        {/* the two sides — same split the user sees after signing up */}
        <section className="lp-section lp-sides" aria-labelledby="sides-h">
          <h2 id="sides-h">{t('One login. Two sides.', 'एक login. दो हिस्से।', 'Ek login. Do hisse.')}</h2>
          <p className="lp-section-sub">{t('Other apps sell you billing here, a khata there and accounting somewhere else. BizYour keeps your shop and your buying in one place, with one set of data.', 'दूसरे ऐप बिलिंग अलग, खाता अलग, हिसाब अलग बेचते हैं। BizYour में दुकान और खरीद एक जगह, एक ही डेटा।', 'Dusre app billing alag, khata alag, hisaab alag bechte hain. BizYour me dukaan aur khareed ek jagah, ek hi data.')}</p>
          <div className="lp-sides-grid">
            <a href="#workspace" className="lp-side lp-side-ws">
              <BookOpenText size={28} strokeWidth={1.5} aria-hidden />
              <h3>Workspace</h3>
              <p>{t('Run your own shop: billing, stock, udhaar, purchases, GST and reports.', 'अपनी दुकान चलाइए: बिलिंग, स्टॉक, उधार, खरीद, GST और रिपोर्ट।', 'Apni dukaan chalao: billing, stock, udhaar, khareed, GST aur report.')}</p>
              <span className="lp-side-tag">{t('30-day free trial, then a plan', '30 दिन ट्रायल, फिर plan', '30 din trial, phir plan')}</span>
            </a>
            <a href="#mart" className="lp-side lp-side-mart">
              <ShoppingCart size={28} strokeWidth={1.5} aria-hidden />
              <h3>Business Mart</h3>
              <p>{t('Buy from and sell to other businesses. Requests, quotes, orders and chat.', 'दूसरे बिज़नेस से खरीदें और बेचें। Request, quote, order और chat।', 'Dusre business se khareedo aur becho. Request, quote, order aur chat.')}</p>
              <span className="lp-side-tag">{t('Free, always', 'हमेशा मुफ़्त', 'Hamesha free')}</span>
            </a>
          </div>
        </section>

        {/* Workspace */}
        <section className="lp-section" id="workspace" aria-labelledby="ws-h">
          <h2 id="ws-h">{t('Everything the counter needs', 'काउंटर की हर ज़रूरत', 'Counter ki har zaroorat')}</h2>
          <p className="lp-section-sub">{t('Workspace replaces the billing app, the khata app and the register.', 'Workspace बिलिंग ऐप, खाता ऐप और रजिस्टर — तीनों की जगह।', 'Workspace billing app, khata app aur register — teeno ki jagah.')}</p>
          <ul className="lp-ledger">
            {features.map(([h, p]) => <li key={h}><b>{h}</b><span>{p}</span></li>)}
          </ul>
          <figure className="lp-shot">
            <img src="/landing/home.webp?v=c" alt={t('The Workspace home screen: today’s sale, udhaar to collect and low stock', 'Workspace होम: आज की बिक्री, वसूली और कम स्टॉक', 'Workspace home: aaj ki bikri, vasooli aur kam stock')} loading="lazy" width={1400} height={875} />
            <figcaption>{t('The real home screen. Today’s sale, money to collect and what is running low.', 'असली होम स्क्रीन — आज की बिक्री, वसूली और कम स्टॉक।', 'Asli home screen — aaj ki bikri, vasooli aur kam stock.')}</figcaption>
          </figure>
          <div className="lp-shot-pair">
            <figure className="lp-shot">
              <img src="/landing/pos.webp?v=c" alt={t('The billing counter with items added', 'बिलिंग काउंटर', 'Billing counter')} loading="lazy" width={1400} height={875} />
              <figcaption>{t('The counter: search, tap, bill. Keyboard shortcuts for speed.', 'काउंटर: खोजें, चुनें, बिल।', 'Counter: search, tap, bill.')}</figcaption>
            </figure>
            <figure className="lp-shot">
              <img src="/landing/customer.webp?v=c" alt={t('A customer’s udhaar account', 'ग्राहक का उधार खाता', 'Customer ka udhaar khata')} loading="lazy" width={1400} height={875} />
              <figcaption>{t('Every customer’s khata, with a reminder one tap away.', 'हर ग्राहक का खाता, reminder एक tap पर।', 'Har customer ka khata, reminder ek tap pe.')}</figcaption>
            </figure>
          </div>
        </section>

        {/* Business Mart */}
        <section className="lp-section lp-mart" id="mart" aria-labelledby="mart-h">
          <h2 id="mart-h">{t('Business Mart: the shops’ own wholesale bazaar', 'Business Mart: दुकानों का अपना थोक बाज़ार', 'Business Mart: dukaanon ka apna wholesale bazaar')}</h2>
          <p className="lp-section-sub">{t('Stop calling five wholesalers for one rate. Post once, compare quotes, order the best. Free for every business, always.', 'एक रेट के लिए पाँच फ़ोन नहीं। एक बार बताइए, quote मिलाइए, सबसे अच्छा order कीजिए। हर बिज़नेस के लिए हमेशा मुफ़्त।', 'Ek rate ke liye paanch phone nahi. Ek baar batao, quote milao, best order karo. Har business ke liye hamesha free.')}</p>
          <ol className="lp-steps">
            {martSteps.map(([h, p]) => <li key={h}><b>{h}</b><span>{p}</span></li>)}
          </ol>
          <figure className="lp-shot">
            <img src="/landing/mart-compare.webp?v=c" alt={t('Comparing wholesaler quotes side by side', 'थोक वालों के quote की तुलना', 'Wholesaler quotes ki tulna')} loading="lazy" width={1400} height={875} />
            <figcaption>{t('Quotes compared on landed cost, delivery days and the seller’s record.', 'पूरी लागत, delivery और seller के रिकॉर्ड पर तुलना।', 'Poori laagat, delivery aur seller ke record pe tulna.')}</figcaption>
          </figure>
          <p className="lp-mart-sell">{t('Selling wholesale? Set up your seller profile and catalogue, get matching leads from shops and send quotes from the same app.', 'थोक बेचते हैं? Seller profile और catalogue बनाइए, दुकानों से leads पाइए, उसी ऐप से quote भेजिए।', 'Wholesale bechte ho? Seller profile aur catalogue banao, dukaanon se leads pao, usi app se quote bhejo.')}</p>
        </section>

        {/* a day */}
        <section className="lp-section" aria-labelledby="day-h">
          <h2 id="day-h">{t('A day with BizYour', 'BizYour के साथ एक दिन', 'BizYour ke saath ek din')}</h2>
          <ol className="lp-day">
            {day.map(([when, h, p]) => <li key={when}><span className="lp-day-when">{when}</span><b>{h}</b><span>{p}</span></li>)}
          </ol>
        </section>

        {/* who */}
        <section className="lp-section" aria-labelledby="who-h">
          <h2 id="who-h">{t('Made for shops that sell goods', 'सामान बेचने वाली दुकानों के लिए', 'Saaman bechne wali dukaanon ke liye')}</h2>
          <p className="lp-section-sub">{t('If you make bills, keep stock and give credit, BizYour fits.', 'अगर आप बिल बनाते हैं, स्टॉक रखते हैं और उधार देते हैं — BizYour आपके लिए है।', 'Agar aap bill banate ho, stock rakhte ho aur udhaar dete ho — BizYour aapke liye hai.')}</p>
          <ul className="lp-who">
            {who.map(([h, p]) => <li key={h}><b>{h}</b><span>{p}</span></li>)}
          </ul>
        </section>

        {/* pricing */}
        <section className="lp-section" id="pricing" aria-labelledby="price-h">
          <h2 id="price-h">{t('What it costs', 'कितना लगेगा', 'Kitna lagega')}</h2>
          <div className="lp-price">
            <div className="lp-price-col lp-price-mart">
              <h3>Business Mart</h3>
              <div className="lp-price-big">{t('Free', 'मुफ़्त', 'Free')}</div>
              <p>{t('For every business, always. Post requests, send quotes, place and receive orders. Even if your Workspace plan ends.', 'हर बिज़नेस के लिए, हमेशा। Request, quote, order — Workspace plan खत्म होने पर भी।', 'Har business ke liye, hamesha. Request, quote, order — Workspace plan khatam hone pe bhi.')}</p>
            </div>
            <div className="lp-price-col lp-price-ws">
              <h3>Workspace</h3>
              <div className="lp-price-big">{t('30 days free', '30 दिन मुफ़्त', '30 din free')}</div>
              <p>{t('Every feature open, no card needed. After 30 days choose a monthly or yearly plan in Settings. If you don’t, your data stays safe and readable, and you can renew any time.', 'हर feature खुला, कोई card नहीं। 30 दिन बाद Settings में महीने या साल का plan लें। न लें तो भी डेटा सुरक्षित और दिखता रहेगा, कभी भी renew करें।', 'Har feature khula, koi card nahi. 30 din baad Settings me monthly ya yearly plan lo. Na lo to bhi data safe aur dikhta rahega, kabhi bhi renew karo.')}</p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="lp-section" id="faq" aria-labelledby="faq-h">
          <h2 id="faq-h">{t('Questions', 'सवाल', 'Sawaal')}</h2>
          <div className="lp-faq">
            <Faq q={t('Is Business Mart really free?', 'क्या Business Mart सच में मुफ़्त है?', 'Kya Business Mart sach me free hai?')} a={t('Yes. Business Mart is free for every business, with no trial and no end date. Only Workspace has a 30-day trial and then a paid plan.', 'हाँ। Business Mart हर बिज़नेस के लिए मुफ़्त है, कोई ट्रायल या आख़िरी तारीख नहीं। सिर्फ़ Workspace का 30 दिन ट्रायल, फिर plan।', 'Haan. Business Mart har business ke liye free hai, koi trial ya last date nahi. Sirf Workspace ka 30 din trial, phir plan.')} />
            <Faq q={t('What happens after the Workspace trial?', 'Workspace ट्रायल के बाद क्या?', 'Workspace trial ke baad kya?')} a={t('You choose a monthly or yearly plan. If you wait, Workspace turns read-only: you can still see and export everything, nothing is deleted. Business Mart keeps working.', 'महीने या साल का plan चुनें। रुकें तो Workspace सिर्फ़ देखने लायक रहेगा — सब दिखेगा और export होगा, कुछ delete नहीं। Business Mart चलता रहेगा।', 'Monthly ya yearly plan chuno. Ruko to Workspace sirf dekhne layak rahega — sab dikhega aur export hoga, kuch delete nahi. Business Mart chalta rahega.')} />
            <Faq q={t('Does it handle GST?', 'क्या GST होता है?', 'Kya GST hota hai?')} a={t('Yes. GST bills, a GST report and a GSTR-1 file for your CA, all from the same data. Shops without GST can turn it off.', 'हाँ। GST बिल, GST रिपोर्ट और CA के लिए GSTR-1 फ़ाइल। बिना GST वाली दुकान इसे बंद कर सकती है।', 'Haan. GST bill, GST report aur CA ke liye GSTR-1 file. Bina GST wali dukaan ise band kar sakti hai.')} />
            <Faq q={t('Can my staff use it?', 'क्या स्टाफ चला सकता है?', 'Kya staff chala sakta hai?')} a={t('Yes. Each staff member gets their own login with limits, like billing only. Profit and reports stay with the owner.', 'हाँ। हर स्टाफ का अपना login, जैसे सिर्फ़ बिलिंग। मुनाफ़ा और रिपोर्ट सिर्फ़ मालिक को।', 'Haan. Har staff ka apna login, jaise sirf billing. Profit aur report sirf owner ko.')} />
            <Faq q={t('Do I need a computer?', 'क्या कंप्यूटर चाहिए?', 'Kya computer chahiye?')} a={t('No. It runs in the browser on a phone, tablet or computer. Open bizyour.in and log in.', 'नहीं। फ़ोन, टैबलेट या कंप्यूटर के browser में चलता है। bizyour.in खोलें और login करें।', 'Nahi. Phone, tablet ya computer ke browser me chalta hai. bizyour.in kholo aur login karo.')} />
            <Faq q={t('Is my data safe?', 'क्या डेटा सुरक्षित है?', 'Kya data safe hai?')} a={t('Your data is yours. Every shop sees only its own data, and you can back up or export it whenever you want.', 'डेटा आपका है। हर दुकान सिर्फ़ अपना डेटा देखती है, और आप कभी भी backup या export कर सकते हैं।', 'Data aapka hai. Har dukaan sirf apna data dekhti hai, aur aap kabhi bhi backup ya export kar sakte ho.')} />
          </div>
        </section>

        {/* builders */}
        <section className="lp-team" aria-labelledby="team-h">
          <div className="lp-team-in">
            <div className="lp-team-copy">
              <img src="/bizyour-mark-512.png?v=c" alt="" width={52} height={52} />
              <h2 id="team-h">{t('Built by IITians at DILIGENCE', 'DILIGENCE के IITians ने बनाया', 'DILIGENCE ke IITians ne banaya')}</h2>
              <p>{t('BizYour is not a faceless corporate product. Team DILIGENCE builds it line by line, around how Indian shops actually run.', 'BizYour कोई बेनाम कॉर्पोरेट प्रोडक्ट नहीं। Team DILIGENCE इसे भारतीय दुकानों के असली काम के हिसाब से बनाती है।', 'BizYour koi benaam corporate product nahi. Team DILIGENCE ise Indian dukaanon ke asli kaam ke hisaab se banati hai.')}</p>
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
              <p>{t('Two minutes to sign up with your email. Business Mart free forever, Workspace free for 30 days.', 'email से दो मिनट में signup। Business Mart हमेशा मुफ़्त, Workspace 30 दिन मुफ़्त।', 'Email se do minute me signup. Business Mart hamesha free, Workspace 30 din free.')}</p>
            </div>
            <div className="lp-final-act">
              <Link to="/signup" className="btn btn-primary btn-lg">{t('Create free account', 'मुफ़्त account बनाएं', 'Free account banao')}</Link>
              <Link to="/login" className="lp-final-login">{t('Already have an account? Log in', 'पहले से account है? Log in', 'Pehle se account hai? Log in')}</Link>
            </div>
          </div>
        </section>
      </main>

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
            <a href="#workspace">{t('Workspace', 'Workspace', 'Workspace')}</a>
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
            <p>{t('Help is built into the app, in Hindi too.', 'Help ऐप के अंदर ही है, हिंदी में भी।', 'Help app ke andar hi hai, Hindi me bhi.')}</p>
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
