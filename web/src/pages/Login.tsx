import { lazy, Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { ApiError, post } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';
import type { Me } from '../lib/types';
import { Button, Field, Input } from '../components/ui';
import { LangSwitch } from '../components/shell/AppShell';

// Everything a logged-out visitor can do, on the existing auth API
// (no backend change): log in, sign up → email code → shop setup, and
// forgot → code → new password. Codes are sent by the server's SMTP
// settings (Brevo in production); a local demo without mail settings
// prints the code in the server terminal, and the screen says so.

const Landing = lazy(() => import('./Landing'));

// Logged-out routes: the public home page at "/", the auth screens beside it.
// Any other path (an old bookmark to /bills, say) asks to log in first.
export function AuthRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Suspense fallback={<div className="boot"><img src="/bizyour-mark-512.png?v=c" alt="BizYour" width={56} height={56} /></div>}><Landing /></Suspense>} />
      <Route path="/signup" element={<AuthLayout><Signup /></AuthLayout>} />
      <Route path="/verify" element={<AuthLayout><Verify /></AuthLayout>} />
      <Route path="/forgot" element={<AuthLayout><Forgot /></AuthLayout>} />
      <Route path="*" element={<AuthLayout><Login /></AuthLayout>} />
    </Routes>
  );
}

function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="login">
      <div className="login-side" aria-hidden>
        <div className="login-ledger">
          <div className="ll-row"><span>Wheat Flour 10kg × 2</span><span className="num">₹970</span></div>
          <div className="ll-row"><span>Sugar 1kg × 3</span><span className="num">₹135</span></div>
          <div className="ll-row"><span>Mustard Oil 1L</span><span className="num">₹175</span></div>
          <div className="ll-total"><span>Total</span><span className="num">₹1,280</span></div>
        </div>
        <p className="login-quote">{t('The shop counter and the wholesale market, in one app.', 'दुकान का काउंटर और थोक बाज़ार — एक ही app में।', 'Dukaan ka counter aur thok bazaar — ek hi app me.')}</p>
      </div>
      <main className="login-main">
        <div className="login-card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 32 }}>
            <Link to="/" className="row" style={{ gap: 10, color: 'var(--ink)', textDecoration: 'none' }}>
              <img src="/bizyour-mark-512.png?v=c" alt="" width={32} height={32} />
              <span style={{ fontWeight: 600, fontSize: 18 }}>BizYour</span>
            </Link>
            <LangSwitch />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

/* ---------- log in ---------- */
function Login() {
  const { t, err } = useI18n();
  const { login } = useSession();
  const nav = useNavigate();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await login(id.trim(), pw); }
    catch (x) {
      // Signed up but never entered the email code → finish that instead.
      if (x instanceof ApiError && x.code === 'email_not_verified' && id.includes('@')) {
        nav(`/verify?email=${encodeURIComponent(id.trim().toLowerCase())}&resend=1`);
        return;
      }
      // DB-backed lockout (founder rule): name the wait in minutes.
      if (x instanceof ApiError && x.code === 'too_many_attempts') {
        const min = Math.max(1, Number(x.data?.retry_after_min) || 15);
        setError(t(`Too many wrong tries. This login is locked — try again in ${min} minutes.`, `बहुत ज़्यादा गलत कोशिशें। यह login बंद है — ${min} मिनट बाद फिर कोशिश करें।`, `Bahut zyada galat koshish. Ye login band hai — ${min} minute baad phir try karo.`));
        return;
      }
      setError(err(x));
    } finally { setBusy(false); }
  };

  return (
    <>
      <h1>{t('Log in to your shop', 'अपनी दुकान में login करें', 'Apni dukaan me login karo')}</h1>
      <p className="muted" style={{ marginTop: 6, marginBottom: 24 }}>{t('Use the email or mobile number you signed up with.', 'Signup वाला email या mobile नंबर डालें।', 'Signup wala email ya mobile number daalo.')}</p>
      <form onSubmit={submit} className="stack" style={{ gap: 16 }}>
        <Field label={t('Email or mobile', 'Email या mobile', 'Email ya mobile')}>
          {(fid) => <Input id={fid} size2="lg" autoComplete="username" value={id} onChange={(e) => setId(e.target.value)} required autoFocus />}
        </Field>
        <Field label={t('Password', 'पासवर्ड', 'Password')}>
          {(fid) => <Input id={fid} size2="lg" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required />}
        </Field>
        {error && <div className="banner banner-owed" role="alert">{error}</div>}
        <Button type="submit" variant="primary" size="lg" block loading={busy}>{t('Log in', 'लॉग इन', 'Log in')}</Button>
      </form>
      <div className="login-links">
        <Link to={`/forgot${id.includes('@') ? `?email=${encodeURIComponent(id.trim())}` : ''}`}>{t('Forgot password?', 'पासवर्ड भूल गए?', 'Password bhool gaye?')}</Link>
        <Link to="/signup">{t('New here? Create a free account', 'नए हैं? मुफ़्त account बनाएं', 'Naye ho? Free account banao')}</Link>
      </div>
    </>
  );
}

/* ---------- sign up ---------- */
function Signup() {
  const { t, err } = useI18n();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', mobile: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReactNode>('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (f.password.length < 8) { setError(t('Use at least 8 characters for the password.', 'Password कम से कम 8 अक्षर का रखें।', 'Password kam se kam 8 character ka rakho.')); return; }
    setBusy(true); setError('');
    const email = f.email.trim().toLowerCase();
    try {
      const r = await post<{ mail_configured: boolean; otp_sent: boolean }>('/api/auth/signup', { name: f.name.trim(), email, mobile: f.mobile.trim(), password: f.password });
      nav(`/verify?email=${encodeURIComponent(email)}${r.mail_configured ? '' : '&nomail=1'}`);
    } catch (x) {
      const code = x instanceof ApiError ? x.code : '';
      if (code === 'email_pending_verification') { nav(`/verify?email=${encodeURIComponent(email)}&resend=1`); return; }
      if (code === 'email already registered') setError(<>{t('This email already has an account.', 'इस email का account पहले से है।', 'Is email ka account pehle se hai.')} <Link to="/login">{t('Log in instead', 'login करें', 'Login karo')}</Link></>);
      else if (code === 'mobile_taken') setError(t('This mobile number is already used by another account.', 'यह mobile नंबर दूसरे account में है।', 'Ye mobile number doosre account me hai.'));
      else if (code === 'invalid_mobile' || code === 'mobile_required') setError(t('Enter a 10-digit Indian mobile number.', '10 अंकों का mobile नंबर डालें।', '10 digit ka mobile number daalo.'));
      else setError(err(x));
    } finally { setBusy(false); }
  };

  return (
    <>
      <h1>{t('Create your free account', 'मुफ़्त account बनाएं', 'Free account banao')}</h1>
      <p className="muted" style={{ marginTop: 6, marginBottom: 24 }}>{t('Business Mart is free, always. Workspace is free for 30 days — no card. We’ll email you a code to confirm it’s you.', 'Business Mart हमेशा मुफ़्त। Workspace 30 दिन मुफ़्त — कोई card नहीं। पुष्टि के लिए email पर code भेजेंगे।', 'Business Mart hamesha free. Workspace 30 din free — koi card nahi. Confirm karne ke liye email pe code bhejenge.')}</p>
      <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
        <Field label={t('Your name', 'आपका नाम', 'Aapka naam')}>{(id) => <Input id={id} size2="lg" autoComplete="name" value={f.name} onChange={set('name')} required autoFocus />}</Field>
        <Field label={t('Email', 'Email', 'Email')}>{(id) => <Input id={id} size2="lg" type="email" autoComplete="email" value={f.email} onChange={set('email')} required />}</Field>
        <Field label={t('Mobile number', 'मोबाइल नंबर', 'Mobile number')} hint={t('You can log in with this too.', 'इससे भी login कर सकते हैं।', 'Isse bhi login kar sakte ho.')}>{(id) => <Input id={id} size2="lg" type="tel" inputMode="tel" autoComplete="tel" value={f.mobile} onChange={set('mobile')} required />}</Field>
        <Field label={t('Password', 'पासवर्ड', 'Password')} hint={t('At least 8 characters.', 'कम से कम 8 अक्षर।', 'Kam se kam 8 character.')}>{(id) => <Input id={id} size2="lg" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} required minLength={8} />}</Field>
        {error && <div className="banner banner-owed" role="alert">{error}</div>}
        <Button type="submit" variant="primary" size="lg" block loading={busy}>{t('Create account', 'account बनाएं', 'Account banao')}</Button>
      </form>
      <div className="login-links"><Link to="/login">{t('Already have an account? Log in', 'account है? login करें', 'Account hai? Login karo')}</Link></div>
    </>
  );
}

/* ---------- email code (signup) ---------- */
function useCooldown(start: number) {
  const [left, setLeft] = useState(start);
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  return [left, setLeft] as const;
}

function CodeInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const { t } = useI18n();
  return (
    <Field label={t('6-digit code', '6 अंकों का code', '6 digit code')}>
      {(id) => <input id={id} className="input input-lg code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••"
        value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))} autoFocus={autoFocus} />}
    </Field>
  );
}

function codeError(x: unknown, t: ReturnType<typeof useI18n>['t'], err: ReturnType<typeof useI18n>['err']) {
  const code = x instanceof ApiError ? x.code : '';
  if (code === 'invalid_otp') {
    const n = Number((x as ApiError).data?.attempts_left);
    return t(`That code isn’t right. ${n} tries left.`, `Code गलत है। ${n} कोशिश बाकी।`, `Code galat hai. ${n} koshish baaki.`);
  }
  if (code === 'otp_expired') return t('That code has expired. Send a new one.', 'Code की समय-सीमा खत्म। नया मंगाएं।', 'Code expire ho gaya. Naya mangao.');
  if (code === 'otp_attempts_exceeded' || code === 'otp_not_found') return t('Too many wrong tries. Send a new code.', 'बहुत गलत कोशिशें। नया code मंगाएं।', 'Bahut galat koshish. Naya code mangao.');
  if (code === 'otp_resend_too_soon') return t('Wait a minute before asking for another code.', 'नए code के लिए एक मिनट रुकें।', 'Naye code ke liye ek minute ruko.');
  return err(x);
}

function Verify() {
  const { t, err } = useI18n();
  const { adopt } = useSession();
  const [sp] = useSearchParams();
  const email = sp.get('email') || '';
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [noMail, setNoMail] = useState(sp.get('nomail') === '1');
  const [left, setLeft] = useCooldown(sp.get('resend') === '1' ? 0 : 60);
  const sentOnce = useRef(false);

  const resend = async () => {
    setError(''); setNote('');
    try {
      const r = await post<{ mail_configured: boolean }>('/api/auth/resend-otp', { email, purpose: 'signup' });
      setNoMail(!r.mail_configured); setLeft(60);
      setNote(t('New code sent.', 'नया code भेजा।', 'Naya code bheja.'));
    } catch (x) {
      if (x instanceof ApiError && x.code === 'otp_resend_too_soon') setLeft(Number(x.data?.retry_after) || 60);
      setError(codeError(x, t, err));
    }
  };
  // Came here from login / repeat signup: send a fresh code once.
  useEffect(() => { if (sp.get('resend') === '1' && email && !sentOnce.current) { sentOnce.current = true; resend(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (code.length !== 6) return;
    setBusy(true); setError('');
    try {
      const r = await post<{ token: string } & Me>('/api/auth/verify-otp', { email, otp: code });
      adopt(r); // → shop setup (business has no name yet)
    } catch (x) { setError(codeError(x, t, err)); setCode(''); } finally { setBusy(false); }
  };
  useEffect(() => { if (code.length === 6) submit(); }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!email) return <Navigate to="/signup" replace />;
  return (
    <>
      <span className="auth-icon"><MailCheck size={22} /></span>
      <h1>{t('Check your email', 'अपना email देखें', 'Apna email dekho')}</h1>
      <p className="muted" style={{ marginTop: 6, marginBottom: 24 }}>{t(`We sent a 6-digit code to ${email}. It works for 10 minutes.`, `${email} पर 6 अंकों का code भेजा है। 10 मिनट तक चलेगा।`, `${email} pe 6 digit ka code bheja hai. 10 minute tak chalega.`)}</p>
      {noMail && <div className="banner banner-warn" style={{ marginBottom: 16 }}>{t('Email sending isn’t set up on this server (local demo). The code is printed in the Terminal window running BizYour, on a line starting with [DEV-MAIL].', 'इस server पर email सेट नहीं है (local demo)। Code BizYour वाली Terminal window में [DEV-MAIL] लाइन पर दिखेगा।', 'Is server pe email set nahi hai (local demo). Code BizYour wali Terminal window me [DEV-MAIL] line pe dikhega.')}</div>}
      <form onSubmit={submit} className="stack" style={{ gap: 16 }}>
        <CodeInput value={code} onChange={setCode} autoFocus />
        {error && <div className="banner banner-owed" role="alert">{error}</div>}
        {note && !error && <div className="banner banner-info" role="status">{note}</div>}
        <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={code.length !== 6}>{t('Confirm', 'पुष्टि करें', 'Confirm karo')}</Button>
      </form>
      <div className="login-links">
        <Link to="/signup"><ArrowLeft size={13} style={{ verticalAlign: '-2px' }} /> {t('Wrong email?', 'गलत email?', 'Galat email?')}</Link>
        <button className="link-btn" onClick={resend} disabled={left > 0}>{left > 0 ? t(`Send a new code in ${left}s`, `${left} सेकंड में नया code`, `${left} sec me naya code`) : t('Send a new code', 'नया code भेजें', 'Naya code bhejo')}</button>
      </div>
    </>
  );
}

/* ---------- forgot / reset password ---------- */
function Forgot() {
  const { t, err } = useI18n();
  const { login } = useSession();
  const [sp] = useSearchParams();
  const [step, setStep] = useState<'ask' | 'reset'>('ask');
  const [email, setEmail] = useState(sp.get('email') || '');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [noMail, setNoMail] = useState(false);
  const [left, setLeft] = useCooldown(0);

  const ask = async (e?: FormEvent) => {
    e?.preventDefault();
    const em = email.trim().toLowerCase();
    if (!em.includes('@')) { setError(t('Enter the email you signed up with.', 'Signup वाला email डालें।', 'Signup wala email daalo.')); return; }
    setBusy(true); setError('');
    try {
      const r = await post<{ mail_configured: boolean }>('/api/auth/forgot-password', { email: em });
      setNoMail(!r.mail_configured); setStep('reset'); setLeft(60);
    } catch (x) {
      if (x instanceof ApiError && x.code === 'otp_resend_too_soon') { setStep('reset'); setLeft(Number(x.data?.retry_after) || 60); }
      else if (x instanceof ApiError && x.code === 'email_not_verified') setError(t('This account was never confirmed. Sign up again with the same email to get a new code.', 'यह account confirm नहीं हुआ। उसी email से फिर signup करें।', 'Ye account confirm nahi hua. Usi email se phir signup karo.'));
      else setError(codeError(x, t, err));
    } finally { setBusy(false); }
  };
  const reset = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) { setError(t('Enter the 6-digit code from the email.', 'Email वाला 6 अंकों का code डालें।', 'Email wala 6 digit code daalo.')); return; }
    if (pw.length < 8) { setError(t('Use at least 8 characters for the new password.', 'नया password कम से कम 8 अक्षर का।', 'Naya password kam se kam 8 character ka.')); return; }
    setBusy(true); setError('');
    try {
      await post('/api/auth/reset-password', { email: email.trim().toLowerCase(), otp: code, password: pw });
      await login(email.trim().toLowerCase(), pw); // straight in with the new password
    } catch (x) { setError(codeError(x, t, err)); } finally { setBusy(false); }
  };

  return step === 'ask' ? (
    <>
      <h1>{t('Reset your password', 'पासवर्ड बदलें', 'Password reset karo')}</h1>
      <p className="muted" style={{ marginTop: 6, marginBottom: 24 }}>{t('We’ll email a code to the address you signed up with.', 'Signup वाले email पर code भेजेंगे।', 'Signup wale email pe code bhejenge.')}</p>
      <form onSubmit={ask} className="stack" style={{ gap: 16 }}>
        <Field label={t('Email', 'Email', 'Email')}>{(id) => <Input id={id} size2="lg" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />}</Field>
        {error && <div className="banner banner-owed" role="alert">{error}</div>}
        <Button type="submit" variant="primary" size="lg" block loading={busy}>{t('Send code', 'code भेजें', 'Code bhejo')}</Button>
      </form>
      <div className="login-links"><Link to="/login"><ArrowLeft size={13} style={{ verticalAlign: '-2px' }} /> {t('Back to log in', 'login पर वापस', 'Login pe wapas')}</Link></div>
    </>
  ) : (
    <>
      <span className="auth-icon"><MailCheck size={22} /></span>
      <h1>{t('Enter the code and a new password', 'code और नया password डालें', 'Code aur naya password daalo')}</h1>
      <p className="muted" style={{ marginTop: 6, marginBottom: 24 }}>{t(`If ${email.trim()} has an account, a code is on its way. It works for 10 minutes.`, `अगर ${email.trim()} का account है तो code आ रहा है। 10 मिनट चलेगा।`, `Agar ${email.trim()} ka account hai to code aa raha hai. 10 minute chalega.`)}</p>
      {noMail && <div className="banner banner-warn" style={{ marginBottom: 16 }}>{t('Email sending isn’t set up on this server (local demo). The code is printed in the Terminal window running BizYour, on a line starting with [DEV-MAIL].', 'इस server पर email सेट नहीं है (local demo)। Code Terminal में [DEV-MAIL] लाइन पर दिखेगा।', 'Is server pe email set nahi hai (local demo). Code Terminal me [DEV-MAIL] line pe dikhega.')}</div>}
      <form onSubmit={reset} className="stack" style={{ gap: 16 }}>
        <CodeInput value={code} onChange={setCode} autoFocus />
        <Field label={t('New password', 'नया पासवर्ड', 'Naya password')} hint={t('At least 8 characters. You’ll be logged out everywhere else.', 'कम से कम 8 अक्षर। बाकी जगह से logout हो जाएंगे।', 'Kam se kam 8 character. Baaki jagah se logout ho jaoge.')}>{(id) => <Input id={id} size2="lg" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} />}</Field>
        {error && <div className="banner banner-owed" role="alert">{error}</div>}
        <Button type="submit" variant="primary" size="lg" block loading={busy}>{t('Save password and log in', 'password सेव करें और login', 'Password save karo aur login')}</Button>
      </form>
      <div className="login-links">
        <button className="link-btn" onClick={() => { setStep('ask'); setCode(''); setError(''); }}><ArrowLeft size={13} style={{ verticalAlign: '-2px' }} /> {t('Change email', 'email बदलें', 'Email badlo')}</button>
        <button className="link-btn" onClick={() => ask()} disabled={left > 0}>{left > 0 ? t(`Send a new code in ${left}s`, `${left} सेकंड में नया code`, `${left} sec me naya code`) : t('Send a new code', 'नया code भेजें', 'Naya code bhejo')}</button>
      </div>
    </>
  );
}
