import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { planName } from '../lib/plan';

// Shown instead of a feature the shop's plan does not include (partywise
// P&L, restore, balance sheet, custom fields, reminders, Basic accounts
// need Everything; billing/stock need Billing). The server still enforces
// the gate — this is only the explanation + the way to upgrade. Checkout
// is not part of this pack: the upgrade goes to Settings → Plan, where
// the owner picks the tier and pays by UPI claim until checkout lands.
export function PlanLockCard({ need, feature }: { need: 'billing' | 'everything'; feature: string }) {
  const { t } = useI18n();
  return (
    <div className="banner banner-info" role="status" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <Lock size={18} style={{ flex: 'none', marginTop: 2 }} />
      <div className="grow">
        <div style={{ fontWeight: 600 }}>{t(`${feature} needs the ${planName(need)} plan`, `${feature} के लिए ${planName(need)} प्लान चाहिए`, `${feature} ke liye ${planName(need)} plan chahiye`)}</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
          {need === 'everything'
            ? t('Everything is ₹169/month or ₹1,699/year (+ 18% GST). Your data stays safe — upgrade and it opens right here.', 'Everything ₹169/महीना या ₹1,699/साल है (+ 18% GST)। आपका data safe है — upgrade करते ही यहीं खुल जाएगा।', 'Everything ₹169/month ya ₹1,699/year hai (+ 18% GST). Aapka data safe hai — upgrade karte hi yahin khul jayega.')
            : t('Billing + Stock is ₹129/month or ₹1,299/year (+ 18% GST).', 'Billing + Stock ₹129/महीना या ₹1,299/साल है (+ 18% GST)।', 'Billing + Stock ₹129/month ya ₹1,299/year hai (+ 18% GST).')}
        </div>
      </div>
      <Link to="/settings?tab=plan" className="btn btn-primary btn-sm" style={{ flex: 'none' }}>{t('See plans', 'Plans देखें', 'Plans dekho')}</Link>
    </div>
  );
}
