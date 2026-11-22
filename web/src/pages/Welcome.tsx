import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpenText, ShoppingCart, LogOut } from 'lucide-react';
import { get } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';
import { lastPath, picked } from '../lib/mode';
import type { Subscription } from '../lib/types';
import { LangSwitch } from '../components/shell/AppShell';

// The side-by-side door after signup or login: Workspace on one side,
// Business Mart on the other — same as the original app. Mart is free for
// good; only Workspace runs on the 30-day trial.
export default function WelcomePage() {
  const { t } = useI18n();
  const { me, can, logout } = useSession();
  const nav = useNavigate();
  const { data } = useQuery({ queryKey: ['subscription'], queryFn: () => get<{ subscription: Subscription }>('/api/subscription'), enabled: can.owner, staleTime: 300_000 });
  const s = data?.subscription;
  useEffect(() => { document.title = 'BizYour'; }, []);

  const go = (m: 'workspace' | 'mart') => { picked(); nav(lastPath(m), { replace: true }); };
  const wsAllowed = can.billing || can.stock;
  // Two-stage workflow: the Mart door is always open, but the Workspace
  // door leads to the shop SETUP until the owner finishes it (staff land
  // on the setup-pending notice via the route guard).
  const wsActive = !!me?.business?.workspace_active;
  const goWorkspace = () => { if (!wsActive && can.owner) { picked(); nav('/setup', { replace: true }); } else go('workspace'); };
  // Only one side open to this login (e.g. billing-only staff)? Skip the door.
  useEffect(() => { if (!can.mart) goWorkspace(); else if (!wsAllowed) go('mart'); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const first = (me?.user.name || '').split(' ')[0];

  let wsTag = t('Free for 30 days', '30 दिन मुफ़्त', '30 din free');
  if (!wsActive) wsTag = t('Set up your shop first', 'पहले दुकान setup करें', 'Pehle dukaan setup karo');
  else if (s?.read_only) wsTag = t('Plan ended · read-only', 'Plan खत्म · सिर्फ़ देखें', 'Plan khatam · sirf dekho');
  else if (s?.status === 'trial') wsTag = t(`Trial · ${s.days_left} ${s.days_left === 1 ? 'day' : 'days'} left`, `ट्रायल · ${s.days_left} दिन बाकी`, `Trial · ${s.days_left} din baaki`);
  else if (s) wsTag = t('Active plan', 'Plan चालू', 'Plan chalu');

  return (
    <div className="welcome">
      <header className="welcome-top">
        <img src="/bizyour-mark-512.png?v=c" alt="" width={32} height={32} />
        <div className="grow">
          <div className="welcome-brand">BizYour</div>
          <div className="muted" style={{ fontSize: 12 }}>{me?.business?.name}</div>
        </div>
        <LangSwitch />
        <button className="icon-btn icon-btn-sm" onClick={logout} aria-label={t('Log out', 'लॉग आउट', 'Log out')} title={t('Log out', 'लॉग आउट', 'Log out')}><LogOut size={16} /></button>
      </header>

      <main className="welcome-main">
        <h1>{first ? t(`Where to, ${first}?`, `${first}, कहाँ चलें?`, `${first}, kahan chalein?`) : t('Where to?', 'कहाँ चलें?', 'Kahan chalein?')}</h1>
        <p className="welcome-sub">{t('One login, two sides. Switch any time from the top of the menu.', 'एक login, दो हिस्से। menu के ऊपर से कभी भी बदलें।', 'Ek login, do hisse. Menu ke upar se kabhi bhi badlo.')}</p>

        <div className="doors">
          <button className="door door-ws" onClick={goWorkspace} disabled={!wsAllowed} data-testid="door-workspace">
            <span className="door-tag">{wsTag}</span>
            <BookOpenText size={30} strokeWidth={1.5} aria-hidden />
            <span className="door-title">Workspace</span>
            <span className="door-lede">{wsActive ? t('Run your own shop.', 'अपनी दुकान चलाइए।', 'Apni dukaan chalao.') : t('Two minutes of shop details, then your 30-day free trial starts.', 'दुकान की details के 2 मिनट, फिर 30 दिन का मुफ़्त trial शुरू।', 'Dukaan ki details ke 2 minute, phir 30 din ka free trial shuru.')}</span>
            <ul className="door-list">
              <li>{t('GST bills in seconds, UPI QR on every bill', 'सेकंडों में GST बिल, हर बिल पर UPI QR', 'Seconds me GST bill, har bill pe UPI QR')}</li>
              <li>{t('Stock that updates itself', 'स्टॉक अपने आप अपडेट', 'Stock apne aap update')}</li>
              <li>{t('Udhaar khata with WhatsApp reminders', 'उधार खाता, WhatsApp याद-दिहानी', 'Udhaar khata, WhatsApp reminder')}</li>
              <li>{t('Profit, GST and day-end reports', 'मुनाफ़ा, GST और दिन-अंत रिपोर्ट', 'Profit, GST aur day-end report')}</li>
            </ul>
            <span className="door-go">{wsActive ? t('Open Workspace', 'Workspace खोलें', 'Workspace kholo') : t('Set up my shop', 'मेरी दुकान setup करें', 'Meri dukaan setup karo')}</span>
          </button>

          <button className="door door-mart" onClick={() => go('mart')} disabled={!can.mart} data-testid="door-mart">
            <span className="door-tag">{t('Free, always', 'हमेशा मुफ़्त', 'Hamesha free')}</span>
            <ShoppingCart size={30} strokeWidth={1.5} aria-hidden />
            <span className="door-title">Business Mart</span>
            <span className="door-lede">{t('Buy from and sell to other businesses.', 'दूसरे बिज़नेस से खरीदें और उन्हें बेचें।', 'Dusre business se khareedo aur unhe becho.')}</span>
            <ul className="door-list">
              <li>{t('Post what you need, get quotes from wholesalers', 'ज़रूरत बताइए, थोक वालों से quote पाइए', 'Zaroorat batao, wholesalers se quote pao')}</li>
              <li>{t('Compare rates side by side, order the best', 'रेट साथ-साथ देखें, सबसे अच्छा order करें', 'Rate saath-saath dekho, best order karo')}</li>
              <li>{t('Goods received go straight into stock', 'माल आते ही स्टॉक में', 'Maal aate hi stock me')}</li>
              <li>{t('Sell: get leads, send quotes, list your catalogue', 'बेचें: लीड, quote, अपना catalogue', 'Becho: leads, quote, apna catalogue')}</li>
            </ul>
            <span className="door-go">{t('Open Business Mart', 'Business Mart खोलें', 'Business Mart kholo')}</span>
          </button>
        </div>
      </main>
    </div>
  );
}
