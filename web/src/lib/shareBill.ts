import { fetchBlob, get } from './api';
import { rupees, waPhone } from './format';

type T = (en: string, hi: string, hg: string) => string;

/** The WhatsApp message — the SHOP's name leads, in the tone of the
    server's existing bill messages. `attached` picks the last line: the
    PDF rides with the message (share sheet); otherwise the message
    carries the bill's public PDF link (`pdfUrl`), or just a thank-you
    when no link could be minted. */
export function billShareMessage(t: T, a: {
  shop: string; customerName: string; billNo: number; total: number; balance: number; attached: boolean; pdfUrl?: string;
}): string {
  const named = a.customerName && a.customerName.trim().toLowerCase() !== 'walk-in';
  const greet = named
    ? t(`Namaste ${a.customerName} ji, `, `नमस्ते ${a.customerName} जी, `, `Namaste ${a.customerName} ji, `)
    : t('Namaste, ', 'नमस्ते, ', 'Namaste, ');
  const head = `🧾 *${a.shop}* — ${t(`Bill #${a.billNo}`, `बिल #${a.billNo}`, `Bill #${a.billNo}`)}`;
  const body = t(
    `${greet}your bill is ready.\nTotal: ${rupees(a.total)} · Balance: ${rupees(a.balance)}`,
    `${greet}आपका बिल तैयार है।\nकुल: ${rupees(a.total)} · बाकी: ${rupees(a.balance)}`,
    `${greet}aapka bill tayyar hai.\nKul: ${rupees(a.total)} · Baaki: ${rupees(a.balance)}`);
  const tail = a.attached
    ? t('The bill PDF is attached with this message. Thank you! 🙏', 'बिल की PDF इस संदेश के साथ है। धन्यवाद! 🙏', 'Bill ki PDF is message ke saath hai. Dhanyavaad! 🙏')
    : a.pdfUrl
      ? t(`Bill PDF: ${a.pdfUrl}\nThank you! 🙏`, `बिल PDF: ${a.pdfUrl}\nधन्यवाद! 🙏`, `Bill PDF: ${a.pdfUrl}\nDhanyavaad! 🙏`)
      : t('Thank you! 🙏', 'धन्यवाद! 🙏', 'Dhanyavaad! 🙏');
  return `${head}\n${body}\n${tail}`;
}

// One-tap bill sharing on WhatsApp — always from the SHOPKEEPER's own
// WhatsApp (their number, their shop's name), never a server-side send:
// the message is plain text via wa.me and carries the bill's public PDF
// link, so the customer taps it and the PDF opens — no login, no file to
// attach. With no customer phone on the bill, the caller asks for a
// number inline ('needs-phone') and then calls openWa().
// (The share-sheet + attached-file path still lives in this lib via
// tryShareFile for callers that want it; the bill flows use text + link.)

/** Mint (on first share) and return the bill's public PDF link as an
    absolute URL for this page's origin. */
export async function fetchBillPdfUrl(invoiceId: number | string): Promise<string> {
  const r = await get<{ token: string; url_path: string }>(`/api/invoices/${invoiceId}/bill-link`);
  return window.location.origin + r.url_path;
}

export type ShareFileResult = 'shared' | 'cancelled' | 'unsupported';

export async function fetchBillPdf(invoiceId: number | string): Promise<Blob> {
  return fetchBlob(`/api/invoices/${invoiceId}/pdf`);
}

/** Open the bill PDF (same file that goes on WhatsApp) in a new tab, where
    the browser can print or save it. The tab is opened before the fetch so
    pop-up blockers allow it; if it was blocked, the PDF downloads instead. */
export async function openBillPdf(invoiceId: number | string, billNo?: number | string): Promise<void> {
  const w = window.open('', '_blank');
  try {
    const blob = await fetchBillPdf(invoiceId);
    const url = URL.createObjectURL(blob);
    if (w && !w.closed) { w.location.href = url; setTimeout(() => URL.revokeObjectURL(url), 60_000); }
    else downloadBlob(blob, `bill-${billNo ?? invoiceId}.pdf`);
  } catch (e) { if (w && !w.closed) w.close(); throw e; }
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

/** Try the native share sheet with the PDF attached. Quiet on cancel. */
export async function tryShareFile(blob: Blob, name: string, message: string): Promise<ShareFileResult> {
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; text: string }) => Promise<void>;
  };
  const file = new File([blob], name, { type: 'application/pdf' });
  if (!nav.canShare || !nav.share || !nav.canShare({ files: [file] })) return 'unsupported';
  try {
    await nav.share({ files: [file], text: message });
    return 'shared';
  } catch (e) {
    if (e && (e as Error).name === 'AbortError') return 'cancelled';
    return 'unsupported';
  }
}

/** Open wa.me for a raw phone input with a ready message. False = bad number. */
export function openWa(rawPhone: string, message: string): boolean {
  const p = waPhone(rawPhone);
  if (!p) return false;
  window.open(`https://wa.me/${p}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  return true;
}

export const hasPhone = (raw?: string | null): boolean => waPhone(raw || '') !== '';
