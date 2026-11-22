// Shapes returned by the existing API (verified against live responses).

export type Role = 'owner' | 'staff' | 'superadmin';
export type Access = 'all' | 'billing' | 'stock';
export type Lang = 'en' | 'hi' | 'hg';

export interface User { id: number; business_id: number | null; name: string; email: string; mobile: string | null; role: Role; access: Access; blocked?: boolean }
export interface Business {
  id: number; name: string; owner_name: string; phone: string; city: string;
  category: string; address: string; landmark: string; pincode: string; state: string;
  workspace_active: boolean; workspace_activated_at: string | null;
  gst_enabled: boolean; gstin: string; upi_id: string; upi_payee_name: string; payment_qr: string | null;
  logo: string | null; shop_photo: string | null;
  language: Lang; setup_complete: boolean;
}
export interface Me { user: User; business: Business | null }

export interface Product {
  id: number; name: string; category: string; unit: string; buy_price: number; sell_price: number;
  gst_rate: number; hsn_code: string; stock_qty: number; low_stock_limit: number; status: 'ok' | 'low' | 'out';
}
export interface BillingProduct { id: number; name: string; unit: string; sell_price: number; gst_rate: number; stock_qty: number }

export interface Customer {
  id: number; name: string; phone: string; city: string; gstin: string;
  total_billed: number; total_received: number; total_returns: number; pending: number; hisab_enabled: boolean;
}
export interface Supplier { id: number; name: string; phone: string; city: string; total_purchased: number; total_paid: number; pending: number }

export type BillStatus = 'paid' | 'partial' | 'pending';
export interface Invoice {
  id: number; bill_no: number; customer_id: number | null; customer_name: string; date: string;
  subtotal: number; discount: number; gst_enabled: boolean; gst_amount: number; total: number;
  paid_amount: number; pending_amount: number; status: BillStatus; payment_mode: string | null;
  due_date: string | null; kind: 'sale' | 'opening'; cancelled: boolean; cancel_reason: string | null;
}
export interface InvoiceItem { id: number; product_id: number; product_name?: string; name?: string; qty: number; sell_price: number; amount: number; gst_rate: number; unit?: string }
export interface Payment { id?: number; date: string; amount: number; mode: string; note?: string }

export interface Purchase {
  id: number; supplier_id: number; supplier_name: string; bill_no: string; date: string; due_date: string | null;
  kind: string; total: number; paid_amount: number; pending_amount: number; status: BillStatus;
}
export interface PurchaseItem { id: number; product_id: number; product_name: string; product_unit: string; qty: number; buy_price: number; amount: number }

export interface Subscription {
  status: 'none' | 'trial' | 'active' | 'grace' | 'expired'; days_left: number; read_only: boolean; ends_at: string;
}
