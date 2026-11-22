import { fetchBlob } from './api';
import { rupees, waPhone } from './format';

type T = (en: string, hi: string, hg: string) => string;

/** The WhatsApp message — the SHOP's name leads, in the tone of the
    server's existing bill messages. `attached` picks the last line: the
    PDF rides with the message (share sheet) or was just downloaded for
    the shopkeeper to attach in the chat (wa.me fallback). */
export function billShareMessage(t: T, a: {
  shop: string; customerName: string; billNo: number; total: number; balance: number; attached: boolean;
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
    : t('The bill PDF has downloaded — please attach it in this chat. Thank you! 🙏', 'बिल की PDF डाउनलोड हो गई है — कृपया इसी चैट में जोड़ दें। धन्यवाद! 🙏', 'Bill ki PDF download ho gayi hai — is chat me attach kar dijiye. Dhanyavaad! 🙏');
  return `${head}\n${body}\n${tail}`;
}

// One-tap bill sharing on WhatsApp — always from the SHOPKEEPER's own
// WhatsApp (their number, their shop's name), never a server-side send:
//   1. Where the browser supports sharing files (phones), the bill PDF is
//      ATTACHED through the system share sheet — the shopkeeper picks
//      WhatsApp and presses send themselves.
//   2. Where it doesn't (most desktops), the PDF downloads and wa.me opens
//      with a ready summary message; the shopkeeper attaches the file in
//      the chat. The message itself says the PDF is downloaded for attach.
//   3. With no customer phone on the bill, the caller asks for a number
//      inline ('needs-phone') and then calls openWa().

export type ShareFileResult = 'shared' | 'cancelled' | 'unsupported';

export async function fetchBillPdf(invoiceId: number | string): Promise<Blob> {
  return fetchBlob(`/api/invoices/${invoiceId}/pdf`);
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
