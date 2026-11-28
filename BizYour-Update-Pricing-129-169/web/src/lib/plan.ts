// Workspace plans — LOCKED by the founder 28 Nov 2026 (exclusive of GST 18%; GST added at payment).
// Udhaar FREE (max 25 customers, 100 khata transactions/month) · Billing +
// Stock ₹129/mo or ₹1,299/yr · Everything ₹169/mo or ₹1,699/yr (hero).
// The server enforces every gate; this file is only the UI's view of it:
// hide what a plan cannot use, show a lock card instead. An unknown plan
// ('') means the session has not loaded the effective plan yet — treat it
// as full access so nothing is wrongly hidden before /api/me answers.

export type PlanTier = 'free' | 'billing' | 'everything' | '';

export const PLAN_RANK: Record<string, number> = { '': 3, free: 0, billing: 1, everything: 2 };

export function planRank(p?: string | null): number {
  return PLAN_RANK[p || ''] ?? 3;
}

/** True when the shop's effective plan reaches at least `min`. */
export function planAtLeast(plan: string | undefined | null, min: 'billing' | 'everything'): boolean {
  return planRank(plan) >= planRank(min);
}

export function planName(p?: string | null): string {
  if (p === 'free') return 'Udhaar (Free)';
  if (p === 'billing') return 'Billing + Stock';
  if (p === 'everything') return 'Everything';
  return '';
}

export interface PlanCard {
  tier: 'free' | 'billing' | 'everything';
  name: string;
  monthly: string;
  yearly: string;
  blurb: string;
  hero?: boolean;
}

export const PLAN_CARDS: PlanCard[] = [
  {
    tier: 'free', name: 'Udhaar', monthly: 'FREE', yearly: 'Free forever',
    blurb: 'Udhaar / khata + Mart buying. Up to 25 customers, 100 transactions a month. No billing, no stock.'
  },
  {
    tier: 'billing', name: 'Billing + Stock', monthly: '₹129/month', yearly: '₹1,299/year',
    blurb: 'Everything in Udhaar, plus billing, stock, estimates, expenses and GST reports.'
  },
  {
    tier: 'everything', name: 'Everything', monthly: '₹169/month', yearly: '₹1,699/year',
    blurb: 'Everything in Billing + Stock, plus partywise P&L, restore, balance sheet, custom fields, reminders and Basic accounts.',
    hero: true
  }
];
