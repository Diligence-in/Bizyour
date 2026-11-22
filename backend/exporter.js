// Table exporter: one set of header + rows → CSV, Excel (.xlsx) or PDF.
// Rows of length 0 are spacers, rows of length 1 are section headings
// (used by the GSTR-1 register). Amounts stay plain numbers so Excel can sum.
const path = require('path');

const FONT = (n) => path.join(__dirname, 'fonts', n);
const DEVA = /[ऀ-ॿ]/;
const isNum = (v) => typeof v === 'number' || (typeof v === 'string' && v !== '' && /^-?\d+(\.\d+)?$/.test(v));

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function toCsv(header, rows) {
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

// A column is numeric (right-aligned) when every non-empty data cell is a number.
function numericCols(header, rows) {
  return header.map((_, i) => {
    const cells = rows.filter((r) => r.length > 1).map((r) => r[i]).filter((v) => v !== '' && v !== null && v !== undefined);
    return cells.length > 0 && cells.every(isNum);
  });
}

async function toXlsx(title, subtitle, header, rows) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BizYour by DILIGENCE';
  const ws = wb.addWorksheet(String(title).slice(0, 30).replace(/[\\/?*[\]:]/g, ' '), { views: [{ state: 'frozen', ySplit: 1 }] });
  const num = numericCols(header, rows);
  ws.addRow(header);
  const hr = ws.getRow(1);
  hr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14213A' } };
  hr.alignment = { vertical: 'middle' };
  hr.height = 22;
  rows.forEach((r) => {
    if (r.length === 0) { ws.addRow([]); return; }
    if (r.length === 1) { const x = ws.addRow([r[0]]); x.font = { bold: true }; return; }
    const x = ws.addRow(r.map((v, i) => (num[i] && isNum(v) ? Number(v) : (v === null || v === undefined ? '' : v))));
    x.eachCell((c, i) => { if (num[i - 1]) c.alignment = { horizontal: 'right' }; });
  });
  header.forEach((h, i) => {
    const w = Math.max(String(h).length, ...rows.filter((r) => r.length > 1).map((r) => String(r[i] ?? '').length));
    ws.getColumn(i + 1).width = Math.min(Math.max(w + 3, 10), 42);
    if (num[i]) ws.getColumn(i + 1).alignment = { horizontal: 'right' };
  });
  ws.getRow(1).eachCell((c, i) => { if (num[i - 1]) c.alignment = { horizontal: 'right', vertical: 'middle' }; });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function toPdf(title, subtitle, header, rows) {
  const PDFDocument = require('pdfkit');
  return new Promise((resolve, reject) => {
    const landscape = header.length > 6;
    const doc = new PDFDocument({ size: 'A4', layout: landscape ? 'landscape' : 'portrait', margin: 36, bufferPages: true, info: { Title: title, Author: 'BizYour by DILIGENCE' } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.registerFont('r', FONT('plex-400.woff')); doc.registerFont('b', FONT('plex-600.woff'));
    doc.registerFont('dr', FONT('plex-deva-400.woff')); doc.registerFont('db', FONT('plex-deva-600.woff'));
    const font = (s, bold) => (DEVA.test(String(s)) ? (bold ? 'db' : 'dr') : (bold ? 'b' : 'r'));

    const NAVY = '#14213A', MUTED = '#66788F', LINE = '#E1E7F1', ZEBRA = '#F4F6FA';
    const x0 = doc.page.margins.left, W = doc.page.width - x0 - doc.page.margins.right, bottom = () => doc.page.height - doc.page.margins.bottom - 18;
    const num = numericCols(header, rows);
    const pad = 6, fs = 8.5;

    // column widths ∝ content length (clamped), scaled to the page
    const want = header.map((h, i) => {
      const L = Math.max(String(h).length, ...rows.filter((r) => r.length > 1).map((r) => String(r[i] ?? '').length));
      return Math.min(Math.max(L, 5), 28);
    });
    const sum = want.reduce((a, b) => a + b, 0);
    const cw = want.map((w) => (w / sum) * W);

    doc.font('b').fontSize(15).fillColor(NAVY).text(title, x0, doc.y);
    doc.font('r').fontSize(9).fillColor(MUTED).text(subtitle, x0, doc.y + 2);
    doc.moveDown(0.8);

    const cell = (text, i, y, bold, color) => {
      const t = text === null || text === undefined ? '' : String(text);
      doc.font(font(t, bold)).fontSize(fs).fillColor(color).text(t, x0 + cw.slice(0, i).reduce((a, b) => a + b, 0) + pad, y, { width: cw[i] - pad * 2, height: 12, ellipsis: true, lineBreak: false, align: num[i] ? 'right' : 'left' });
    };
    const head = () => {
      const y = doc.y;
      doc.rect(x0, y, W, 20).fill(NAVY);
      header.forEach((h, i) => cell(h, i, y + 6, true, '#FFFFFF'));
      doc.y = y + 20;
    };
    head();
    let n = 0;
    rows.forEach((r) => {
      if (doc.y + 22 > bottom()) { doc.addPage(); head(); }
      const y = doc.y;
      if (r.length === 0) { doc.y = y + 10; return; }
      if (r.length === 1) { doc.font(font(r[0], true)).fontSize(9.5).fillColor(NAVY).text(String(r[0]), x0, y + 6, { width: W }); doc.y = y + 24; n = 0; return; }
      if (n++ % 2 === 1) doc.rect(x0, y, W, 20).fill(ZEBRA);
      r.forEach((v, i) => cell(v, i, y + 6, false, '#14213A'));
      doc.moveTo(x0, y + 20).lineTo(x0 + W, y + 20).lineWidth(0.5).strokeColor(LINE).stroke();
      doc.y = y + 20;
    });
    if (!rows.length) doc.font('r').fontSize(9).fillColor(MUTED).text('Nothing to show yet.', x0, doc.y + 10);

    const range = doc.bufferedPageRange();
    for (let p = 0; p < range.count; p++) {
      doc.switchToPage(p);
      doc.font('r').fontSize(7.5).fillColor(MUTED);
      const fy = doc.page.height - doc.page.margins.bottom + 2;
      doc.page.margins.bottom = 0; // footer sits in the margin; stop pdfkit adding a page for it
      doc.text('BizYour by DILIGENCE', x0, fy, { width: W / 2, lineBreak: false });
      doc.text(`Page ${p + 1} of ${range.count}`, x0 + W / 2, fy, { width: W / 2, align: 'right', lineBreak: false });
    }
    doc.end();
  });
}

// The BizYour mark (the same image as the app's loading animation) for the
// bill's "Bill by BizYour" credit. Read once; a missing file just drops it.
let _markBuf;
function bizyourMark() {
  if (_markBuf !== undefined) return _markBuf;
  const fs = require('fs');
  const tries = [path.join(__dirname, '..', 'frontend', 'brand', 'bizyour-mark-512.png'), path.join(__dirname, '..', 'web', 'public', 'bizyour-mark-512.png')];
  _markBuf = null;
  for (const t of tries) { try { _markBuf = fs.readFileSync(t); break; } catch { /* try next */ } }
  return _markBuf;
}

const FORMATS = { csv: 'text/csv; charset=utf-8', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pdf: 'application/pdf' };

// ---------------------------------------------------------------------------
// Single-bill PDF (WhatsApp share / download). A designed A4 document in the
// app's bill style — the shop's name is the sender identity. NOTE: none of
// the bundled Plex subsets contain the ₹ glyph (U+20B9), so the rupee sign
// is drawn as vector strokes (rsGlyph) and amounts are composed with the
// money() helper instead of embedding ₹ in text.
// ---------------------------------------------------------------------------
// Indian-system amount in words (lakh / crore), e.g. 1,25,000 → "One Lakh
// Twenty Five Thousand Rupees Only"; paise are added when present.
function amountInWords(value) {
  const v = Math.round((Number(value) || 0) * 100) / 100;
  let n = Math.floor(v);
  const paise = Math.round((v - n) * 100);
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x) => (x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : ''));
  const three = (x) => (Math.floor(x / 100) ? ones[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' : '') : '') + (x % 100 ? two(x % 100) : '');
  let out = '';
  const cr = Math.floor(n / 10000000); n %= 10000000;
  const lk = Math.floor(n / 100000); n %= 100000;
  const th = Math.floor(n / 1000); n %= 1000;
  if (cr) out += (cr > 999 ? String(cr) : three(cr)) + ' Crore ';
  if (lk) out += two(lk) + ' Lakh ';
  if (th) out += two(th) + ' Thousand ';
  if (n) out += three(n);
  out = (out.trim() || 'Zero') + ' Rupees';
  if (paise) out += ' and ' + two(paise) + ' Paise';
  return out + ' Only';
}

// GST state codes (first two digits of a GSTIN) → state name, for the
// "State: Delhi (07)" line every tax invoice should carry.
const GST_STATES = { '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat', '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh' };

// ---------------------------------------------------------------------------
// Single-bill PDF (WhatsApp share / download / print) — 23 Nov 2026 format,
// matching the founder's approved invoice: shop identity + INVOICE/GSTIN
// header, a bill-no / date / customer box, S.No·Item·Qty·Rate·Amount table
// between black rules, Subtotal → Taxable value → CGST/SGST, GRAND TOTAL
// between heavy rules, amount in words, and note + signatory + thank-you
// pinned to the page bottom. Added: HSN and GST % columns when used, the
// customer's phone/GSTIN, paid / balance status, and a UPI "Scan to pay"
// block (the shop's uploaded QR, or a QR for the exact amount made from the
// UPI ID). Labels follow the shop's language (English / हिंदी / Hinglish).
// CGST/SGST are printed per GST rate at HALF the item rate (5% GST →
// CGST 2.5% + SGST 2.5%). NOTE: the bundled Plex subsets have no ₹ glyph,
// so the rupee sign is drawn as vector strokes wherever "₹" appears.
// ---------------------------------------------------------------------------
function billPdf(data) {
  const PDFDocument = require('pdfkit');
  return new Promise((resolve, reject) => {
    const biz = data.business || {}, inv = data.invoice || {}, cust = data.customer || null;
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true, info: { Title: `Bill ${inv.bill_no} — ${biz.name || ''}`, Author: 'BizYour by DILIGENCE' } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.registerFont('r', FONT('plex-400.woff')); doc.registerFont('b', FONT('plex-600.woff'));
    doc.registerFont('dr', FONT('plex-deva-400.woff')); doc.registerFont('db', FONT('plex-deva-600.woff'));
    const font = (s, bold) => (DEVA.test(String(s)) ? (bold ? 'db' : 'dr') : (bold ? 'b' : 'r'));

    const lang = biz.language === 'hi' ? 'hi' : biz.language === 'hg' ? 'hg' : 'en';
    const L = (en, hi, hg) => (lang === 'hi' ? hi : lang === 'hg' ? hg : en);
    const BLACK = '#111827', INK = '#1F2937', MUTED = '#5B6676', SOFT = '#8A94A3', LINE = '#E3E8F0', BOX = '#C9D1DD', RED = '#B4321F', GREEN = '#137A3A', BLUE = '#1A47B8';
    const x0 = doc.page.margins.left, W = doc.page.width - x0 - doc.page.margins.right, xR = x0 + W;
    const pageBottom = () => doc.page.height - doc.page.margins.bottom;

    const fmt = (n) => { const v = Number(n) || 0; return v.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }); };
    const fmt2 = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const qtyFmt = (n) => { const v = Number(n) || 0; return Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000); };
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const niceDate = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : String(s || ''); };

    // Mixed-script text. The Latin Plex subset has no ₹ and no Devanagari;
    // the Devanagari subset has ₹ and Devanagari but no Latin letters, digits
    // or punctuation. So every string is drawn as runs, each in the font
    // that actually has its characters — a real ₹ glyph, and Hindi labels
    // that keep their English words, digits and punctuation.
    const DEVA_CH = /[ऀ-ॿ᳐-᳿꣠-ꣿ‌‍₹◌]/;
    const runsOf = (str) => {
      const out = [];
      for (const ch of String(str ?? '')) {
        const d = DEVA_CH.test(ch), last = out[out.length - 1];
        if (last && (ch === ' ' || last.d === d)) last.t += ch; else out.push({ t: ch, d });
      }
      return out;
    };
    const fontFor = (d, bold) => (d ? (bold ? 'db' : 'dr') : (bold ? 'b' : 'r'));
    const measure = (str, size, bold, cs = 0) => runsOf(str).reduce((w, r) => { doc.font(fontFor(r.d, bold)).fontSize(size); return w + doc.widthOfString(r.t, { characterSpacing: cs }); }, 0);
    // one line, aligned left/right/center at x (right: x is the right edge)
    const rich = (str, x, y, size, bold, color, align = 'left', extra = {}) => {
      const cs = extra.characterSpacing || 0;
      const total = measure(str, size, bold, cs);
      let cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
      for (const r of runsOf(str)) {
        doc.font(fontFor(r.d, bold)).fontSize(size).fillColor(color);
        const w = doc.widthOfString(r.t, { characterSpacing: cs });
        doc.text(r.t, cx, y, { lineBreak: false, characterSpacing: cs, oblique: r.d ? undefined : extra.oblique });
        cx += w;
      }
      return total;
    };
    // shorten with an ellipsis to fit maxW
    const fit = (str, maxW, size, bold) => {
      let s0 = String(str ?? '');
      if (measure(s0, size, bold) <= maxW) return s0;
      while (s0.length > 1 && measure(s0 + '…', size, bold) > maxW) s0 = s0.slice(0, -1);
      return s0.trimEnd() + '…';
    };
    // word-wrapped paragraph; returns the y below it
    const wrap = (str, x, y, maxW, size, bold, color, gap = 3) => {
      const words = String(str ?? '').split(/\s+/).filter(Boolean);
      let lineTxt = '';
      for (const w of words) {
        const next = lineTxt ? lineTxt + ' ' + w : w;
        if (lineTxt && measure(next, size, bold) > maxW) { rich(lineTxt, x, y, size, bold, color); y += size + gap; lineTxt = w; }
        else lineTxt = next;
      }
      if (lineTxt) { rich(lineTxt, x, y, size, bold, color); y += size + gap; }
      return y;
    };
    const rule = (y, w = 0.7, color = LINE, from = x0, to = xR) => { doc.save().strokeColor(color).lineWidth(w).moveTo(from, y).lineTo(to, y).stroke(); doc.restore(); };
    const dashed = (y) => { doc.save().strokeColor(BOX).lineWidth(0.8).dash(3, { space: 3 }).moveTo(x0, y).lineTo(xR, y).stroke().undash(); doc.restore(); };

    const gst = !!inv.gst_enabled;
    const gstOn = gst && Number(inv.gst_amount) > 0;
    let y = doc.page.margins.top;

    // ---------------- header ----------------
    // Shop mark: the shop's own logo when it uploaded one (setup or
    // Settings), else its initial in a rounded tile — S for Sharma, M for
    // Mehta. The shop, not BizYour, is the sender of the bill.
    let drewLogo = false;
    const lm = biz.logo ? /^data:image\/(jpeg|jpg|png);base64,(.+)$/.exec(String(biz.logo)) : null;
    if (lm) {
      try {
        const buf = Buffer.from(lm[2], 'base64');
        doc.save().roundedRect(x0, y, 46, 46, 11).fill('#FFFFFF').restore();
        doc.save().roundedRect(x0, y, 46, 46, 11).clip();
        doc.image(buf, x0, y, { fit: [46, 46], align: 'center', valign: 'center' });
        doc.restore();
        doc.save().roundedRect(x0 + 0.4, y + 0.4, 45.2, 45.2, 10.6).lineWidth(0.8).strokeColor(BOX).stroke().restore();
        drewLogo = true;
      } catch { drewLogo = false; }
    }
    if (!drewLogo) {
      const initial = (String(biz.name || 'B').trim()[0] || 'B').toUpperCase();
      doc.save().roundedRect(x0, y, 46, 46, 11).fill(BLACK).restore();
      rich(initial, x0 + 23, y + 9, 23, true, '#FFFFFF', 'center');
    }
    const nameX = x0 + 58, rightW = 190;
    rich(fit(biz.name || 'BizYour', W - 58 - rightW, 20, true), nameX, y + 1, 20, true, BLACK);
    const sub = [biz.city, biz.phone ? `${L('Ph.', 'फ़ोन', 'Ph.')} ${biz.phone}` : ''].filter(Boolean).join('  ·  ');
    if (sub) rich(sub, nameX, y + 28, 9.5, false, MUTED);
    let leftY = y + 46;
    const addr = [biz.address, biz.landmark, [biz.state, biz.pincode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    if (addr) leftY = Math.max(leftY, wrap(addr, nameX, y + 42, W - 58 - rightW, 8.5, false, SOFT, 2) + 2);
    // right: title + GSTIN + state
    const title = gst ? 'TAX INVOICE' : 'INVOICE';
    rich(title, xR, y + 2, gst ? 16 : 19, true, BLACK, 'right', { characterSpacing: gst ? 3.2 : 5.5 });
    let rightY = y + 26;
    if (gst && biz.gstin) {
      rich(`GSTIN ${biz.gstin}`, xR, rightY, 9.5, true, BLACK, 'right'); rightY += 13;
      const sc = String(biz.gstin).slice(0, 2);
      const st = GST_STATES[sc] || biz.state;
      if (st) { rich(`${L('State', 'राज्य', 'State')}: ${st} (${sc})`, xR, rightY, 8.5, false, MUTED, 'right'); rightY += 12; }
    }
    if (inv.cancelled_at) { rich(L('CANCELLED', 'रद्द', 'CANCELLED'), xR, rightY + 2, 12, true, RED, 'right'); rightY += 18; }
    y = Math.max(leftY, rightY) + 8;
    rule(y, 1.8, BLACK); y += 12;

    // ---------------- bill no / date / customer box ----------------
    const custName = data.customerName || (cust && cust.name) || 'Walk-in';
    const extras = [
      cust && cust.phone ? `${L('Ph.', 'फ़ोन', 'Ph.')} ${cust.phone}` : '',
      cust && cust.gstin ? `${L('Customer GSTIN', 'ग्राहक GSTIN', 'Customer GSTIN')} ${cust.gstin}` : '',
      inv.payment_mode ? `${L('Paid by', 'भुगतान', 'Payment')}: ${inv.payment_mode}` : '',
      inv.due_date && data.balance > 0 ? `${L('Pay by', 'भुगतान की तारीख', 'Pay by')}: ${niceDate(inv.due_date)}` : ''
    ].filter(Boolean);
    const boxH = extras.length ? 44 : 30;
    doc.save().roundedRect(x0, y, W, boxH, 7).lineWidth(0.9).strokeColor(BOX).stroke().restore();
    const kv = (label, value, x, align, maxV = 200) => {
      const v = fit(String(value), maxV, 10.5, true);
      const lw = measure(label + ' ', 10, false), vw = measure(v, 10.5, true);
      const start = align === 'right' ? x - lw - vw : align === 'center' ? x - (lw + vw) / 2 : x;
      rich(label + ' ', start, y + 9, 10, false, MUTED);
      rich(v, start + lw, y + 8.5, 10.5, true, BLACK);
    };
    kv(`${L('Bill No', 'बिल नं.', 'Bill No')}:`, inv.bill_no, x0 + 14, 'left');
    kv(`${L('Date', 'तारीख', 'Date')}:`, niceDate(inv.date), x0 + W / 2, 'center');
    kv(`${L('Customer', 'ग्राहक', 'Customer')}:`, custName, xR - 14, 'right');
    if (extras.length) {
      rich(fit(extras.join('   ·   '), W - 28, 8.5, false), xR - 14, y + 27, 8.5, false, MUTED, 'right');
    }
    y += boxH + 16;

    // ---------------- items table ----------------
    const items = data.items || [];
    const showHsn = items.some((it) => it.hsn_code);
    const showGst = gstOn;
    // column right edges (numbers right-aligned under their headings)
    const cAmtR = xR - 4;
    const cGstR = showGst ? cAmtR - 92 : null;
    const cRateR = (showGst ? cGstR - 46 : cAmtR - 98);
    const cQtyR = cRateR - 80;
    const cHsnL = showHsn ? cQtyR - 120 : null;
    const cSno = x0 + 6, cItem = x0 + 40;
    const itemW = (showHsn ? cHsnL : cQtyR - 60) - cItem - 8;
    const head = () => {
      rule(y, 1.4, BLACK); y += 8;
      const hs = 9.5;
      rich(L('S.No', 'क्र.', 'S.No'), cSno, y, hs, true, BLACK);
      rich(L('Item', 'सामान', 'Item'), cItem, y, hs, true, BLACK);
      if (showHsn) rich('HSN', cHsnL, y, hs, true, BLACK);
      rich(L('Qty', 'मात्रा', 'Qty'), cQtyR, y, hs, true, BLACK, 'right');
      rich(L('Rate (₹)', 'दर (₹)', 'Rate (₹)'), cRateR, y, hs, true, BLACK, 'right');
      if (showGst) rich('GST', cGstR, y, hs, true, BLACK, 'right');
      rich(L('Amount (₹)', 'रकम (₹)', 'Amount (₹)'), cAmtR, y, hs, true, BLACK, 'right');
      y += 17; rule(y, 1.4, BLACK); y += 9;
    };
    head();
    items.forEach((it, i) => {
      if (y + 24 > pageBottom() - 40) { doc.addPage(); y = doc.page.margins.top; head(); }
      rich(String(i + 1), cSno, y, 10, false, MUTED);
      rich(fit(it.product_name || '', itemW, 10, false), cItem, y, 10, false, INK);
      if (showHsn && it.hsn_code) rich(String(it.hsn_code), cHsnL, y, 9.5, false, MUTED);
      rich(`${qtyFmt(it.qty)}${it.unit && it.unit !== 'piece' ? ' ' + it.unit : ''}`, cQtyR, y, 10, false, INK, 'right');
      rich(fmt2(it.sell_price), cRateR, y, 10, false, INK, 'right');
      if (showGst) rich(Number(it.gst_rate) > 0 ? `${qtyFmt(it.gst_rate)}%` : '—', cGstR, y, 9.5, false, MUTED, 'right');
      rich(fmt2(it.amount), cAmtR, y, 10, false, INK, 'right');
      y += 15; rule(y, 0.6, LINE); y += 9;
    });
    if (!items.length) { rich('—', cItem, y, 10, false, MUTED); y += 24; }
    y += 6;

    // ---------------- totals ----------------
    if (y + 150 > pageBottom() - 40) { doc.addPage(); y = doc.page.margins.top; }
    const line = (label, value, opts = {}) => {
      rich(label, x0, y, opts.size || 10.5, !!opts.bold, opts.labelColor || MUTED);
      rich(value, xR, y, opts.size || 10.5, !!opts.bold, opts.color || INK, 'right');
      y += (opts.size || 10.5) + 9;
    };
    line(L('Subtotal', 'उप-योग', 'Subtotal'), `₹${fmt(inv.subtotal)}`, { bold: true, labelColor: INK, color: BLACK });
    if (Number(inv.discount) > 0) line(L('Discount', 'छूट', 'Discount'), `− ₹${fmt(inv.discount)}`);
    if (gstOn) {
      // Per-rate split of the bill's GST (prices are GST-inclusive). The
      // per-rate parts are scaled to the stored gst_amount so the lines
      // always add up to exactly what the app recorded.
      const byRate = new Map();
      items.forEach((it) => { const r = Number(it.gst_rate) || 0; if (r > 0) byRate.set(r, (byRate.get(r) || 0) + Number(it.amount) * r / (100 + r)); });
      const rawSum = [...byRate.values()].reduce((a, b) => a + b, 0) || 1;
      const totalGst = Math.round(Number(inv.gst_amount) * 100) / 100;
      const taxable = Math.round((Number(inv.total) - totalGst) * 100) / 100;
      line(L('Taxable value', 'कर योग्य राशि', 'Taxable value'), `₹${fmt(taxable)}`);
      const rates = [...byRate.keys()].sort((a, b) => a - b);
      let left = totalGst;
      rates.forEach((r, k) => {
        const part = k === rates.length - 1 ? left : Math.round((byRate.get(r) / rawSum) * totalGst * 100) / 100;
        left = Math.round((left - part) * 100) / 100;
        const c = Math.round((part / 2) * 100) / 100, sg = Math.round((part - c) * 100) / 100;
        const half = qtyFmt(r / 2);
        line(`CGST @ ${half}%`, `₹${fmt(c)}`);
        line(`SGST @ ${half}%`, `₹${fmt(sg)}`);
      });
    }
    if (data.returnsTotal > 0) line(L('Returned (credit note)', 'वापसी (क्रेडिट नोट)', 'Return (credit note)'), `− ₹${fmt(data.returnsTotal)}`);
    y += 1; rule(y, 2.2, BLACK); y += 12;
    rich(L('GRAND TOTAL', 'कुल रकम', 'GRAND TOTAL'), x0, y, 17, true, BLACK);
    rich(`₹${fmt(data.netTotal)}`, xR, y, 18, true, BLACK, 'right');
    y += 28; rule(y, 2.2, BLACK); y += 9;
    rich(`${L('Amount in words', 'रकम शब्दों में', 'Rakam shabdon me')}: ${amountInWords(data.netTotal)}`, xR, y, 9.5, false, MUTED, 'right', { oblique: 10 });
    y += 14;
    if (gstOn) { rich(L('(GST is included in the total)', '(GST कुल रकम में शामिल है)', '(GST total me shaamil hai)'), xR, y, 9, false, SOFT, 'right', { oblique: 10 }); y += 14; }
    y += 12;

    // ---------------- payment: status (left) + UPI (right) ----------------
    const upi = data.upi || null; // { modules?: boolean[][], image?: {buf, fmt}, label }
    const hasUpi = !!(upi && (upi.modules || upi.image)) || !!biz.upi_id;
    const payH = hasUpi ? 104 : 54;
    if (y + payH + 120 > pageBottom()) { doc.addPage(); y = doc.page.margins.top; }
    const colW = hasUpi ? W * 0.44 : W;
    // status card
    const paid = Number(inv.paid_amount) || 0;
    const full = data.balance <= 0.004 && !inv.cancelled_at;
    doc.save().roundedRect(x0, y, colW, payH, 8).fill(full ? '#EAF6EE' : '#F6F8FB').restore();
    if (full) {
      rich(L('PAID IN FULL', 'पूरा भुगतान हुआ', 'POORA PAID'), x0 + 14, y + 14, 12, true, GREEN);
      rich(`${L('Received', 'मिला', 'Mila')} ₹${fmt(paid)}${inv.payment_mode ? ` · ${inv.payment_mode}` : ''}`, x0 + 14, y + 33, 9.5, false, MUTED);
    } else {
      rich(L('Payment', 'भुगतान', 'Payment'), x0 + 14, y + 12, 8.5, true, SOFT);
      rich(L('Paid', 'मिला', 'Paid'), x0 + 14, y + 28, 10, false, MUTED);
      rich(`₹${fmt(paid)}`, x0 + colW - 14, y + 28, 10, false, INK, 'right');
      rich(L('Balance due', 'बाकी', 'Baaki'), x0 + 14, y + 46, 11.5, true, RED);
      rich(`₹${fmt(data.balance)}`, x0 + colW - 14, y + 45.5, 12.5, true, RED, 'right');
      if (inv.due_date && payH > 70) rich(`${L('Please pay by', 'कृपया भुगतान करें', 'Kripya pay karein')} ${niceDate(inv.due_date)}`, x0 + 14, y + 68, 9, false, MUTED);
    }
    // UPI card
    if (hasUpi) {
      const ux = x0 + colW + 14, uw = W - colW - 14;
      doc.save().roundedRect(ux, y, uw, payH, 8).lineWidth(0.9).dash(3, { space: 3 }).strokeColor(BOX).stroke().undash().restore();
      const qs = payH - 20, qx = ux + 10, qy = y + 10;
      let drew = false;
      if (upi && upi.image) {
        try { doc.image(upi.image.buf, qx, qy, { fit: [qs, qs], align: 'center', valign: 'center' }); drew = true; } catch { /* unreadable image bytes */ }
      }
      if (!drew && upi && upi.modules) {
        const m = upi.modules, n = m.length, cell = qs / (n + 2);
        doc.save().rect(qx, qy, qs, qs).fill('#FFFFFF');
        doc.fillColor('#000000');
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) doc.rect(qx + (c + 1) * cell, qy + (r + 1) * cell, cell + 0.05, cell + 0.05);
        doc.fill(); doc.restore(); drew = true;
      }
      const tx = drew ? qx + qs + 12 : ux + 14, tw = ux + uw - tx - 10;
      const due = data.balance > 0.004;
      rich(due ? L('Scan to pay', 'Scan करके भुगतान करें', 'Scan karke pay karo') : L('Pay by UPI', 'UPI से भुगतान', 'UPI se pay karo'), tx, y + 16, 11, true, BLUE);
      if (due) rich(`₹${fmt(data.balance)}`, tx, y + 32, 15, true, BLACK);
      let ty = due ? y + 54 : y + 34;
      if (biz.upi_id) { rich(fit(`UPI ID: ${biz.upi_id}`, tw, 9, false), tx, ty, 9, false, INK); ty += 13; }
      const payee = biz.upi_payee_name || biz.name;
      if (payee) { rich(fit(payee, tw, 8.5, false), tx, ty, 8.5, false, MUTED); ty += 12; }
      rich(fit('GPay · PhonePe · Paytm · BHIM', tw, 7.5, false), tx, ty + 2, 7.5, false, SOFT);
    }
    y += payH + 18;

    // ---------------- bottom block: note + signatory, thanks + credit ----------------
    const blockH = 104;
    let by = Math.max(y, pageBottom() - blockH);
    if (by + blockH > pageBottom() + 1) { doc.addPage(); by = pageBottom() - blockH; }
    const forLine = `${L('For', 'वास्ते', 'For')} `;
    const shopSig = fit(biz.name || '', 220, 10.5, true);
    const nw = rich(shopSig, xR, by - 0.5, 10.5, true, BLACK, 'right');
    rich(forLine, xR - nw, by, 10, false, INK, 'right');
    rule(by + 44, 1.2, BLACK, xR - 180, xR);
    rich(L('Authorised Signatory', 'अधिकृत हस्ताक्षर', 'Authorised Signatory'), xR - 90, by + 51, 9.5, false, MUTED, 'center');
    const note = L('Note: Please check the goods against this bill on delivery. For any difference, contact the shop.',
      'नोट: कृपया सामान मिलते ही बिल से मिला लें। कोई फ़र्क हो तो दुकान पर संपर्क करें।',
      'Note: Kripya saaman milte hi bill se mila lein. Koi farak ho to dukaan par sampark karein.');
    wrap(note, x0, by + 34, W - 230, 8.5, false, MUTED, 3);
    dashed(by + 72);
    rich(L('Thank you! Please visit again.', 'धन्यवाद! फिर ज़रूर आइए।', 'Dhanyavaad! Phir zaroor aaiye.'), x0, by + 84, 11, true, BLACK);
    // "Bill by [mark] BizYour · DILIGENCE" — 2x the old 8.5pt, with the logo
    const cs = 17, cy = by + 80, mark = bizyourMark(), mSize = 20;
    const w3 = rich(' · DILIGENCE', xR, cy, cs, false, MUTED, 'right');
    const w2 = rich('BizYour', xR - w3, cy, cs, true, BLACK, 'right');
    let left = xR - w3 - w2;
    if (mark) {
      try { doc.image(mark, left - mSize - 5, cy + 1, { width: mSize, height: mSize }); left -= mSize + 5; } catch { /* unreadable image */ }
    }
    rich('Bill by ', left - 3, cy, cs, false, MUTED, 'right');

    // page numbers when the bill runs past one page
    const range = doc.bufferedPageRange();
    if (range.count > 1) {
      for (let p = 0; p < range.count; p++) {
        doc.switchToPage(p);
        const fy = doc.page.height - 24;
        doc.page.margins.bottom = 0;
        rich(`${biz.name || ''} · Bill ${inv.bill_no} · Page ${p + 1} of ${range.count}`, x0 + W / 2, fy, 7.5, false, SOFT, 'center');
      }
    }
    doc.end();
  });
}

module.exports = { toCsv, toXlsx, toPdf, billPdf, amountInWords, FORMATS };
