import { todayStr } from './format';

// 'YYYY-MM' helpers shared by Expenses and Reports.
export const ymNow = () => todayStr().slice(0, 7);
export function ymShift(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function ymRange(ym: string): { from: string; to: string } {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` };
}
export function monthLabel(ym: string, lang = 'en'): string {
  const [y, m] = ym.split('-').map(Number);
  return new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
}
export const EXPENSE_CATS: Record<string, [string, string, string]> = {
  Rent: ['Rent', 'किराया', 'Kiraya'], Salary: ['Salary', 'तनख़्वाह', 'Tankhwah'], Electricity: ['Electricity', 'बिजली', 'Bijli'],
  Transport: ['Transport', 'आना-जाना / भाड़ा', 'Bhaada'], Packing: ['Packing', 'पैकिंग', 'Packing'], Food: ['Food', 'खाना-पीना', 'Khana-peena'],
  Maintenance: ['Maintenance', 'मरम्मत', 'Marammat'], Other: ['Other', 'अन्य', 'Other']
};
