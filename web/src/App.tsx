import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Store } from 'lucide-react';
import { shouldPick } from './lib/mode';
import { useSession } from './lib/session';
import { onWorkspaceSetup } from './lib/api';
import { useI18n } from './lib/i18n';
import { AppShell } from './components/shell/AppShell';
import { AuthRoutes } from './pages/Login';
import { SetupPage } from './pages/Setup';
import { HomePage } from './pages/Home';
import { Button, Empty, SkelRows, useToast } from './components/ui';
import type { Perm } from './components/shell/nav';

// Route-level code splitting: the counter and lists load on demand so the
// first paint (login / home) stays small on slow shop connections.
const PosPage = lazy(() => import('./pages/Pos'));
const BillsPage = lazy(() => import('./pages/Bills'));
const BillDetailPage = lazy(() => import('./pages/BillDetail'));
const CustomersPage = lazy(() => import('./pages/Customers'));
const CustomerDetailPage = lazy(() => import('./pages/CustomerDetail'));
const ProductsPage = lazy(() => import('./pages/Products'));
const PurchasesPage = lazy(() => import('./pages/Purchases'));
const SuppliersPage = lazy(() => import('./pages/Suppliers'));
const EstimatesPage = lazy(() => import('./pages/Estimates'));
const ExpensesPage = lazy(() => import('./pages/Expenses'));
const ReportsPage = lazy(() => import('./pages/Reports'));
const HistoryPage = lazy(() => import('./pages/History'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const HelpPage = lazy(() => import('./pages/Help'));
const PrivacyPage = lazy(() => import('./pages/Privacy'));
const WelcomePage = lazy(() => import('./pages/Welcome'));
const MartHome = lazy(() => import('./pages/mart/MartHome'));
const MartInquiry = lazy(() => import('./pages/mart/InquiryDetail'));
const MartOrders = lazy(() => import('./pages/mart/MartOrders'));
const MartSell = lazy(() => import('./pages/mart/MartSell'));
const MartBrowse = lazy(() => import('./pages/mart/MartBrowse'));
const MartSeller = lazy(() => import('./pages/mart/MartBrowse').then((m) => ({ default: m.SellerProfile })));
const MartNotifs = lazy(() => import('./pages/mart/MartBrowse').then((m) => ({ default: m.MartNotifications })));
const MartChat = lazy(() => import('./pages/mart/MartBrowse').then((m) => ({ default: m.ChatRedirect })));

/** Shown to staff of a shop whose owner has not finished the shop setup
    yet (two-stage workflow). The owner completes setup; staff wait. */
function SetupPending() {
  const { t } = useI18n();
  return (
    <div className="page">
      <Empty
        icon={<Store size={30} />}
        title={t('Shop setup is pending', 'दुकान का setup बाकी है', 'Dukaan ka setup baaki hai')}
        body={t('The shop owner has not finished setting up this shop yet. The Workspace opens as soon as the owner completes the setup. Business Mart buying is already open.', 'दुकान के मालिक ने अभी setup पूरा नहीं किया है। मालिक के setup करते ही Workspace खुल जाएगा। Business Mart से खरीद अभी से खुली है।', 'Dukaan ke owner ne abhi setup poora nahi kiya hai. Owner ke setup karte hi Workspace khul jayega. Business Mart se khareed abhi se khuli hai.')}
        action={<Link to="/mart"><Button>{t('Open Business Mart', 'Business Mart खोलें', 'Business Mart kholo')}</Button></Link>}
      />
    </div>
  );
}

function Guard({ perm, ws, children }: { perm?: Perm; ws?: boolean; children: ReactNode }) {
  const { can, me } = useSession();
  const loc = useLocation();
  if (perm && !can[perm]) return <Navigate to="/" replace />;
  // Two-stage workflow: Workspace routes need an ACTIVE workspace. The
  // owner is sent to the setup flow; staff see the pending notice.
  if (ws && me?.business && !me.business.workspace_active) {
    if (can.owner) return <Navigate to="/setup" replace state={{ from: loc.pathname }} />;
    return <SetupPending />;
  }
  return <Suspense fallback={<div className="page"><SkelRows rows={8} /></div>}>{children}</Suspense>;
}

export function App() {
  const { me, loading } = useSession();
  const loc = useLocation();
  const nav = useNavigate();
  const toast = useToast();
  const { err } = useI18n();
  // Server backstop: any 403 workspace_not_setup sends the user to Setup.
  useEffect(() => onWorkspaceSetup((e) => {
    if (window.location.pathname !== '/setup') {
      toast({ text: err(e), tone: 'error' });
      nav('/setup', { state: { from: window.location.pathname } });
    }
  }), [nav, toast, err]);
  if (loading) return <div className="boot"><img src="/bizyour-mark-512.png?v=c" alt="BizYour" width={56} height={56} /></div>;
  if (!me) return <AuthRoutes />;
  // Super admin uses the classic admin panel (unchanged).
  if (me.user.role === 'superadmin') { window.location.replace('/classic/'); return null; }
  // Fresh login or new account: show the Workspace | Business Mart chooser once.
  if (shouldPick() && loc.pathname !== '/welcome' && loc.pathname !== '/setup') return <Navigate to="/welcome" replace />;
  return (
    <Routes>
      <Route path="welcome" element={<Guard><WelcomePage /></Guard>} />
      <Route path="setup" element={<Guard perm="owner"><SetupPage /></Guard>} />
      <Route path="privacy" element={<PrivacyPage />} />
      <Route element={<AppShell />}>
        <Route index element={<Guard ws><HomePage /></Guard>} />
        <Route path="pos" element={<Guard ws perm="billing"><PosPage /></Guard>} />
        <Route path="bills" element={<Guard ws perm="billing"><BillsPage /></Guard>} />
        <Route path="bills/:id" element={<Guard ws perm="billing"><BillDetailPage /></Guard>} />
        <Route path="customers" element={<Guard ws perm="billing"><CustomersPage /></Guard>} />
        <Route path="customers/:id" element={<Guard ws perm="billing"><CustomerDetailPage /></Guard>} />
        <Route path="products" element={<Guard ws perm="stock"><ProductsPage /></Guard>} />
        <Route path="purchases" element={<Guard ws perm="stock"><PurchasesPage /></Guard>} />
        <Route path="suppliers" element={<Guard ws perm="stock"><SuppliersPage /></Guard>} />
        <Route path="estimates" element={<Guard ws perm="billing"><EstimatesPage /></Guard>} />
        <Route path="expenses" element={<Guard ws perm="finance"><ExpensesPage /></Guard>} />
        <Route path="reports" element={<Guard ws perm="finance"><ReportsPage /></Guard>} />
        <Route path="history" element={<Guard ws perm="owner"><HistoryPage /></Guard>} />
        <Route path="settings" element={<Guard><SettingsPage /></Guard>} />
        <Route path="help" element={<Guard><HelpPage /></Guard>} />
        <Route path="mart" element={<Guard perm="mart"><MartHome /></Guard>} />
        <Route path="mart/requests/:id" element={<Guard perm="mart"><MartInquiry /></Guard>} />
        <Route path="mart/orders" element={<Guard perm="mart"><MartOrders /></Guard>} />
        <Route path="mart/sell" element={<Guard perm="mart"><MartSell /></Guard>} />
        <Route path="mart/browse" element={<Guard perm="mart"><MartBrowse /></Guard>} />
        <Route path="mart/sellers/:id" element={<Guard perm="mart"><MartSeller /></Guard>} />
        <Route path="mart/notifications" element={<Guard perm="mart"><MartNotifs /></Guard>} />
        <Route path="mart/chat/:id" element={<Guard perm="mart"><MartChat /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
