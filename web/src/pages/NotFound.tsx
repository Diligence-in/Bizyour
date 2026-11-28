// 404 page — shown for any unknown URL, logged out or logged in.
// Before this, a wrong URL silently opened the login form (logged out)
// or bounced home (logged in), so a visitor never knew the page did not exist.
// Self-contained inline styles: it renders in AuthRoutes (no landing CSS
// loaded there) and inside AppShell alike. No backend change.
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../lib/i18n';

export default function NotFound() {
  const { t } = useI18n();
  useEffect(() => {
    document.title = 'Page not found — BizYour';
  }, []);
  return (
    <main style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: '48px 20px', textAlign: 'center', fontFamily: 'inherit' }}>
      <div>
        <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em', color: '#14213a' }}>404</div>
        <h1 style={{ fontSize: 22, margin: '16px 0 8px', color: '#14213a' }}>
          {t('This page doesn’t exist', 'Ye page nahi hai', 'Ye page nahi hai')}
        </h1>
        <p style={{ margin: '0 auto 24px', maxWidth: 420, color: '#5a6b8c', fontSize: 15, lineHeight: 1.6 }}>
          {t(
            'The link may be mistyped, or the page was moved. The homepage and login still work.',
            'Link galat likha ho sakta hai, ya page hat gaya hai. Homepage aur login ab bhi chalte hain.',
            'Link galat likha ho sakta hai, ya page hat gaya hai. Homepage aur login ab bhi chalte hain.',
          )}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/" style={{ background: '#2b3a8f', color: '#fff', textDecoration: 'none', padding: '11px 20px', borderRadius: 10, fontWeight: 600, fontSize: 15 }}>
            {t('Go to homepage', 'Homepage par jao', 'Homepage par jao')}
          </Link>
          <Link to="/login" style={{ border: '1.5px solid #2b3a8f', color: '#2b3a8f', textDecoration: 'none', padding: '11px 20px', borderRadius: 10, fontWeight: 600, fontSize: 15 }}>
            {t('Log in', 'लॉग इन', 'Log in')}
          </Link>
        </div>
      </div>
    </main>
  );
}
