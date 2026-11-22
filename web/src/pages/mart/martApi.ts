// Business Mart — types for /api/mart/* (verified against live responses)
// plus small shared helpers. No endpoint was changed for the new UI.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get } from '../../lib/api';

export interface Meta { categories: string[]; units: string[]; frequencies: string[]; payment_terms: string[] }
export interface SellerCard {
  business_id: number; name: string; city: string; area: string; about: string; categories: string[];
  service_cities: string[]; all_india: boolean; is_seller: boolean; gst_registered: boolean; verified: boolean;
  since: string; deals: number; rating: number | null; ratings_count: number; repeat_buyers: number;
  is_favourite?: boolean; mine?: boolean;
}
export interface Inquiry {
  id: number; product: string; category: string; qty: number; unit: string; target_price: number | null; city: string;
  need_by: string | null; frequency: string; notes: string; show_name: boolean; verified_only: boolean;
  status: 'open' | 'ordered' | 'closed' | 'expired'; source: string; product_id: number | null; target_business_id: number | null;
  group_id: string | null; notified: number; created_at: string; updated_at: string;
  quotes_count?: number; new_quotes?: number; best_price?: number | null; views?: number;
}
export type QuoteStatus = 'sent' | 'accepted' | 'declined' | 'closed' | 'withdrawn' | 'cancelled' | 'expired';
export interface Quote {
  id: number; inquiry_id: number; seller_business_id: number; price: number; moq: number; delivery_days: number;
  payment_terms: string; advance_percent: number | null; credit_days: number | null; valid_days: number; note: string;
  status: QuoteStatus; created_at: string; updated_at: string;
}
export interface BuyerQuote extends Quote { seller: SellerCard; messages: number }
export interface BuyerLabel { name: string; hidden: boolean; gst_registered: boolean; verified: boolean }
export type OrderStatus = 'placed' | 'confirmed' | 'dispatched' | 'delivered' | 'cancelled';
export interface Order {
  id: number; order_no: string; inquiry_id: number; quote_id: number; role: 'buyer' | 'seller';
  product: string; qty: number; unit: string; price: number; total: number; payment_terms: string;
  advance_percent: number | null; credit_days: number | null; delivery_days: number;
  expected_delivery_date: string | null; transporter_name: string; status: OrderStatus; step: number;
  purchase_id: number | null; rating: number | null; review: string | null;
  other_party: { business_id: number; name: string; city: string; phone: string; gst_registered: boolean; verified: boolean; rating: number | null };
  created_at: string; updated_at: string;
}
export interface BuyerInquiryDetail { role: 'buyer'; inquiry: Inquiry; quotes: BuyerQuote[]; order: Order | null }
export interface SellerInquiryDetail {
  role: 'seller'; inquiry: Inquiry; buyer: BuyerLabel; my_quote: Quote | null; quotes_count: number;
  can_quote: boolean; cannot_quote_reason: 'not_seller' | 'closed' | 'gst_required' | null;
}
export interface Lead extends Inquiry { buyer: BuyerLabel; matched: boolean; direct: boolean; quotes_count: number; my_quote: Quote | null; can_quote: boolean }
export interface SentQuote extends Quote { inquiry: Inquiry; buyer: BuyerLabel; order: { id: number; order_no: string; status: OrderStatus } | null }
export interface Listing { id: number; business_id: number; product_id: number | null; name: string; category: string; unit: string; price: number; moq: number; photo: string | null; active: boolean; updated_at: string; mine?: boolean; seller?: SellerCard }
export interface MartProfile { display_name: string; city: string; area: string; about: string; categories: string[]; service_cities: string[]; all_india: boolean; is_seller: boolean; gst_registered: boolean; verified: boolean; phone: string }
export interface Summary {
  buying: { open_inquiries: number; new_quotes: number; active_orders: number; spend: number };
  selling: { is_seller: boolean; new_leads: number; quotes_sent: number; won: number; active_orders: number; sales: number };
  unread: number;
}
export interface RestockItem { product_id: number; name: string; unit: string; stock_qty: number; low_stock_limit: number; suggested_qty: number; last_price: number | null; last_supplier: string | null; last_date: string | null; category: string; open_inquiry_id: number | null }
export interface Notification { id: number; kind: string; text: string; link_view: string; link_id: number | null; read: boolean; created_at: string }
export interface Message { id: number; mine: boolean; kind: 'text' | 'counter' | 'update'; body: string; amount: number | null; created_at: string }

export const useMeta = () => useQuery({ queryKey: ['mart-meta'], queryFn: () => get<Meta>('/api/mart/meta'), staleTime: Infinity });
export const useMartSummary = (enabled = true) => useQuery({ queryKey: ['mart-summary'], queryFn: () => get<Summary>('/api/mart/summary'), enabled, refetchInterval: 30_000 });
export const useMartProfile = () => useQuery({ queryKey: ['mart-profile'], queryFn: () => get<{ profile: MartProfile }>('/api/mart/profile') });

/** After any Mart write, everything Mart-related may have changed (counts, lists, notifications). */
export function useMartRefresh() {
  const qc = useQueryClient();
  return () => {
    for (const k of ['mart-summary', 'mart-inquiries', 'mart-inquiry', 'mart-orders', 'mart-leads', 'mart-sent', 'mart-notifs', 'mart-chat', 'mart-listings', 'mart-my-listings', 'mart-restock', 'mart-report', 'mart-sellers', 'mart-seller', 'mart-favs', 'mart-profile']) {
      qc.invalidateQueries({ queryKey: [k] });
    }
    // Receiving an order writes a Workspace purchase + stock.
    for (const k of ['products', 'billing-products', 'purchases', 'suppliers', 'alerts']) qc.invalidateQueries({ queryKey: [k] });
  };
}

/** Days until the quote stops being valid (valid_days counted from last update). */
export function quoteDaysLeft(q: Quote): number {
  const t = Date.parse(q.updated_at.replace(' ', 'T') + 'Z');
  return Math.ceil((t + q.valid_days * 86400000 - Date.now()) / 86400000);
}

/** One readable line for a quote's payment terms, including the optional split. */
export function termsText(q: { payment_terms: string; advance_percent: number | null; credit_days: number | null }): string {
  const extra: string[] = [];
  if (q.advance_percent != null) extra.push(`${q.advance_percent}% advance`);
  if (q.credit_days != null) extra.push(`${q.credit_days}-day credit`);
  return extra.length ? `${q.payment_terms} (${extra.join(', ')})` : q.payment_terms;
}

/**
 * Tags for a set of live quotes — same rule as the classic app so the two
 * never disagree: Best value weighs price, delivery, rating, GST and credit.
 */
export function quoteTags(live: BuyerQuote[]) {
  if (live.length < 2) return { best: null as number | null, cheapest: null as number | null, fastest: null as number | null };
  const minP = Math.min(...live.map((q) => q.price));
  const score = (q: BuyerQuote) => (q.price / minP) * 60 + q.delivery_days * 4 - (q.seller.rating || 3.5) * 5 - (q.seller.gst_registered ? 4 : 0) - (/credit/.test(q.payment_terms) ? 3 : 0);
  return {
    best: [...live].sort((a, b) => score(a) - score(b))[0].id,
    cheapest: [...live].sort((a, b) => a.price - b.price)[0].id,
    fastest: [...live].sort((a, b) => a.delivery_days - b.delivery_days)[0].id
  };
}

/** Resize a picked image to ≤900px JPEG data URL (server accepts ≤400 KB). */
export function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) { reject(new Error('not_image')); return; }
    const img = new Image();
    img.onload = () => {
      const sc = Math.min(1, 900 / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(img.width * sc));
      cv.height = Math.max(1, Math.round(img.height * sc));
      cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(img.src);
      let q = 0.82;
      let out = cv.toDataURL('image/jpeg', q);
      while (out.length > 390000 && q > 0.4) { q -= 0.1; out = cv.toDataURL('image/jpeg', q); }
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error('bad_image')); };
    img.src = URL.createObjectURL(file);
  });
}
