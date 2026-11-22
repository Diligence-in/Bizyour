import {
  Home, Receipt, ReceiptText, Users, Package, Truck, Factory, Wallet, BarChart3, Store, Tags,
  Settings, LifeBuoy, History, ShoppingCart, Bell, Search, PackageCheck, type LucideIcon
} from 'lucide-react';
import type { T } from '../../lib/i18n';

// One source of truth for navigation: sidebar, mobile "More" sheet and the
// command palette all read from here.

export type Perm = 'billing' | 'stock' | 'finance' | 'owner' | 'mart';
export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  to: string;            // in-app route, or /classic/#go=... for classic screens
  classic?: boolean;
  perm?: Perm;
  kbd?: string;
  keywords?: string;
  badgeKey?: 'mart-buy' | 'mart-sell' | 'mart-notifs';
}
// Which side of the app a group belongs to. The sidebar shows one side at
// a time (Workspace | Business Mart switch, as in the original app); the
// command palette still searches both.
export type Mode = 'workspace' | 'mart';
export interface NavGroup { id: string; label: string; items: NavItem[]; tone?: 'mart'; mode: Mode | 'both' }

export function navGroups(t: T): NavGroup[] {
  return [
    { id: 'home', mode: 'workspace', label: '', items: [
      { id: 'home', label: t('Home', 'होम', 'Home'), icon: Home, to: '/', kbd: 'G H', keywords: 'dashboard today' }
    ] },
    { id: 'sell', mode: 'workspace', label: t('Sell', 'बिक्री', 'Bikri'), items: [
      { id: 'pos', label: t('New bill', 'नया बिल', 'Naya bill'), icon: Receipt, to: '/pos', perm: 'billing', kbd: 'N', keywords: 'invoice sale counter pos bill' },
      { id: 'bills', label: t('Bills', 'बिल', 'Bills'), icon: ReceiptText, to: '/bills', perm: 'billing', kbd: 'G B', keywords: 'invoices returns' },
      { id: 'estimates', label: t('Estimates', 'एस्टीमेट', 'Estimate'), icon: Tags, to: '/estimates', perm: 'billing', keywords: 'quotation' }
    ] },
    { id: 'collect', mode: 'workspace', label: t('Collect', 'वसूली', 'Vasooli'), items: [
      { id: 'customers', label: t('Customers & udhaar', 'ग्राहक और उधार', 'Customers aur udhaar'), icon: Users, to: '/customers', perm: 'billing', kbd: 'G C', keywords: 'credit khata pending reminder hisab' }
    ] },
    { id: 'stock', mode: 'workspace', label: t('Stock', 'स्टॉक', 'Stock'), items: [
      { id: 'products', label: t('Products', 'सामान', 'Saaman'), icon: Package, to: '/products', perm: 'stock', kbd: 'G P', keywords: 'items inventory stock' },
      { id: 'purchases', label: t('Purchases', 'खरीद', 'Khareed'), icon: Truck, to: '/purchases', perm: 'stock', keywords: 'buy stock in' },
      { id: 'suppliers', label: t('Suppliers', 'सप्लायर', 'Supplier'), icon: Factory, to: '/suppliers', perm: 'stock', keywords: 'vendor payable dena' }
    ] },
    { id: 'money', mode: 'workspace', label: t('Money', 'हिसाब', 'Hisaab'), items: [
      { id: 'expenses', label: t('Expenses', 'खर्चा', 'Kharcha'), icon: Wallet, to: '/expenses', perm: 'finance', keywords: 'kharcha rent salary' },
      { id: 'reports', label: t('Reports & GST', 'रिपोर्ट और GST', 'Report aur GST'), icon: BarChart3, to: '/reports', perm: 'finance', keywords: 'profit gst gstr1 monthly day end' }
    ] },
    { id: 'mart', mode: 'mart', label: '', tone: 'mart', items: [
      { id: 'mart-buy', label: t('Mart home', 'मार्ट होम', 'Mart home'), icon: ShoppingCart, to: '/mart', perm: 'mart', badgeKey: 'mart-buy', kbd: 'G M', keywords: 'inquiry quote wholesaler restock request' },
      { id: 'mart-browse', label: t('Browse wholesalers', 'थोक वाले देखें', 'Wholesaler dekho'), icon: Search, to: '/mart/browse', perm: 'mart', keywords: 'sellers products catalog find supplier' },
      { id: 'mart-orders', label: t('Mart orders', 'मार्ट ऑर्डर', 'Mart orders'), icon: PackageCheck, to: '/mart/orders', perm: 'mart', keywords: 'order received dispatch margin' },
      { id: 'mart-sell', label: t('Sell to businesses', 'बेचें', 'Becho'), icon: Store, to: '/mart/sell', perm: 'mart', badgeKey: 'mart-sell', keywords: 'leads quotes catalog seller profile' },
      { id: 'mart-notifs', label: t('Mart notifications', 'मार्ट सूचनाएं', 'Mart notifications'), icon: Bell, to: '/mart/notifications', perm: 'mart', badgeKey: 'mart-notifs' }
    ] },
    { id: 'admin', mode: 'workspace', label: t('Business', 'बिज़नेस', 'Business'), items: [
      { id: 'history', label: t('History', 'हिस्ट्री', 'History'), icon: History, to: '/history', perm: 'owner', keywords: 'audit log' }
    ] },
    { id: 'account', mode: 'both', label: t('Account', 'अकाउंट', 'Account'), items: [
      { id: 'settings', label: t('Settings', 'सेटिंग', 'Settings'), icon: Settings, to: '/settings', keywords: 'gst upi staff backup subscription language' },
      { id: 'help', label: t('Help', 'मदद', 'Help'), icon: LifeBuoy, to: '/help' }
    ] }
  ];
}

export function allowed(item: NavItem, can: Record<Perm, boolean>) {
  return !item.perm || can[item.perm];
}
