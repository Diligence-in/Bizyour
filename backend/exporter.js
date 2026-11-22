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

const FORMATS = { csv: 'text/csv; charset=utf-8', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pdf: 'application/pdf' };

// ---------------------------------------------------------------------------
// Single-bill PDF (WhatsApp share / download). A designed A4 document in the
// app's bill style — the shop's name is the sender identity. NOTE: none of
// the bundled Plex subsets contain the ₹ glyph (U+20B9), so the rupee sign
// is drawn as vector strokes (rsGlyph) and amounts are composed with the
// money() helper instead of embedding ₹ in text.
// ---------------------------------------------------------------------------
function maskGstin(g) { g = String(g || ''); return g.length > 3 ? g.slice(0, -3) + '###' : g; }
function billPdf(data) {
  const PDFDocument = require('pdfkit');
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 44, bufferPages: true, info: { Title: `Bill ${data.invoice.bill_no} — ${data.business.name || ''}`, Author: 'BizYour by DILIGENCE' } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.registerFont('r', FONT('plex-400.woff')); doc.registerFont('b', FONT('plex-600.woff'));
    doc.registerFont('dr', FONT('plex-deva-400.woff')); doc.registerFont('db', FONT('plex-deva-600.woff'));
    const font = (s, bold) => (DEVA.test(String(s)) ? (bold ? 'db' : 'dr') : (bold ? 'b' : 'r'));

    const NAVY = '#14213A', INK = '#1C2733', MUTED = '#66788F', LINE = '#D8E0EC', OWED = '#B4321F';
    const x0 = doc.page.margins.left, W = doc.page.width - x0 - doc.page.margins.right, xR = x0 + W;
    const bottomLimit = () => doc.page.height - doc.page.margins.bottom - 30;

    const fmt = (n) => {
      const v = Number(n) || 0;
      return v.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
    };
    const qtyFmt = (n) => { const v = Number(n) || 0; return Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000); };

    // ₹ as strokes: gw = glyph advance width for the given font size.
    // Shape: double top bar, short left stem, a bowl bulging right, then the
    // diagonal leg down to the bottom-left (the official ₹ silhouette).
    const rsGlyph = (x, y, size, color) => {
      const gw = size * 0.56, lw = Math.max(0.7, size * 0.085);
      doc.save().strokeColor(color).lineWidth(lw).lineCap('round').lineJoin('round');
      doc.moveTo(x, y + size * 0.13).lineTo(x + gw, y + size * 0.13).stroke();
      doc.moveTo(x, y + size * 0.29).lineTo(x + gw, y + size * 0.29).stroke();
      doc.moveTo(x + gw * 0.03, y + size * 0.29).lineTo(x + gw * 0.03, y + size * 0.52)
        .bezierCurveTo(x + gw * 0.05, y + size * 0.33, x + gw * 0.62, y + size * 0.31, x + gw * 0.64, y + size * 0.52)
        .lineTo(x + gw * 0.10, y + size * 0.99).stroke();
      doc.restore();
      return gw;
    };
    // Right-aligned money ending at xRight: [₹ glyph][amount]. Returns total width used.
    const money = (xRight, y, value, size, bold, color) => {
      const t = fmt(value);
      doc.font(font(t, bold)).fontSize(size);
      const tw = doc.widthOfString(t);
      const gw = size * 0.56 + size * 0.16;
      doc.fillColor(color).text(t, xRight - tw, y, { lineBreak: false });
      rsGlyph(xRight - tw - gw, y, size, color);
      return tw + gw;
    };
    const txt = (s, x, y, size, bold, color, opts) => {
      doc.font(font(s, bold)).fontSize(size).fillColor(color).text(String(s ?? ''), x, y, opts || { lineBreak: false });
    };
    const rule = (y, color, w) => { doc.save().strokeColor(color || LINE).lineWidth(w || 0.7).moveTo(x0, y).lineTo(xR, y).stroke(); doc.restore(); };

    const biz = data.business || {}, inv = data.invoice || {}, cust = data.customer || null;
    const gst = !!inv.gst_enabled;
    let y = doc.page.margins.top;

    // ---- header: shop identity (the sender) + document title ----
    txt(biz.name || 'BizYour', x0, y, 20, true, NAVY);
    const title = gst ? 'TAX INVOICE' : 'BILL';
    doc.font('b').fontSize(13).fillColor(NAVY);
    const titleW = doc.widthOfString(title);
    doc.text(title, xR - titleW, y + 2, { lineBreak: false });
    doc.font('r').fontSize(9.5).fillColor(MUTED);
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const niceDate = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : String(s || ''); };
    const noLine = `#${inv.bill_no} · ${niceDate(inv.date)}`;
    doc.text(noLine, xR - doc.widthOfString(noLine), y + 20, { lineBreak: false });
    y += 30;
    const addrBits = [biz.address, biz.landmark, [biz.city, biz.state].filter(Boolean).join(', '), biz.pincode ? `PIN ${biz.pincode}` : ''].filter(Boolean);
    if (addrBits.length) { txt(addrBits.join(' · '), x0, y, 9, false, MUTED, { width: W - 150 }); y += 13; }
    const subBits = [biz.phone ? `Phone ${biz.phone}` : '', gst && biz.gstin ? `GSTIN ${maskGstin(biz.gstin)}` : ''].filter(Boolean);
    if (subBits.length) { txt(subBits.join(' · '), x0, y, 9, false, MUTED); y += 13; }
    if (inv.cancelled_at) { txt('CANCELLED', x0, y + 1, 11, true, OWED); y += 16; }
    y += 4; rule(y); y += 12;

    // ---- billed to ----
    txt(gst ? 'Billed to' : 'Customer', x0, y, 8.5, false, MUTED);
    txt(data.customerName || (cust && cust.name) || 'Walk-in', x0, y + 12, 11.5, true, INK);
    const custBits = [cust && cust.phone, cust && cust.gstin ? `GSTIN ${maskGstin(cust.gstin)}` : ''].filter(Boolean);
    if (custBits.length) txt(custBits.join(' · '), x0, y + 27, 9, false, MUTED);
    if (inv.due_date && data.balance > 0) {
      const dl = `Pay by ${niceDate(inv.due_date)}`;
      doc.font('r').fontSize(9).fillColor(MUTED);
      doc.text(dl, xR - doc.widthOfString(dl), y + 14, { lineBreak: false });
    }
    y += 46;

    // ---- items table ----
    const cItem = x0, cQtyR = x0 + (gst ? 292 : 322), cRateR = x0 + (gst ? 378 : 420), cGstR = x0 + 438, cAmtR = xR;
    const head = () => {
      rule(y - 3); 
      txt('ITEM', cItem, y, 8.5, true, MUTED);
      const h = (s, xr) => { doc.font('b').fontSize(8.5).fillColor(MUTED); doc.text(s, xr - doc.widthOfString(s), y, { lineBreak: false }); };
      h('QTY', cQtyR); h('RATE', cRateR); if (gst) h('GST', cGstR); h('AMOUNT', cAmtR);
      y += 12; rule(y); y += 7;
    };
    head();
    const num = (s, xr, size, bold, color) => { doc.font(font(s, bold)).fontSize(size).fillColor(color); doc.text(s, xr - doc.widthOfString(s), y, { lineBreak: false }); };
    for (const it of data.items) {
      if (y + 20 > bottomLimit()) { doc.addPage(); y = doc.page.margins.top; head(); }
      txt(it.product_name || '', cItem, y, 9.5, false, INK, { width: cQtyR - cItem - 60, ellipsis: true, lineBreak: false });
      num(`${qtyFmt(it.qty)}${it.unit ? ' ' + it.unit : ''}`, cQtyR, 9.5, false, INK);
      money(cRateR, y, it.sell_price, 9.5, false, INK);
      if (gst) num(`${qtyFmt(it.gst_rate)}%`, cGstR, 9.5, false, MUTED);
      money(cAmtR, y, it.amount, 9.5, false, INK);
      y += 17;
      doc.save().strokeColor('#EDF1F7').lineWidth(0.5).moveTo(x0, y - 3).lineTo(xR, y - 3).stroke(); doc.restore();
    }
    if (!data.items.length) { txt('—', cItem, y, 9.5, false, MUTED); y += 17; }
    y += 6;

    // ---- totals (right) + payment box (left) ----
    if (y + 120 > bottomLimit()) { doc.addPage(); y = doc.page.margins.top; }
    const totX = xR - 196, totLabelR = xR - 108;
    const totRow = (label, value, size, bold, color, labelColor) => {
      doc.font(font(label, bold)).fontSize(size).fillColor(labelColor || MUTED);
      doc.text(label, totLabelR - doc.widthOfString(label), y, { lineBreak: false });
      money(xR, y, value, size, bold, color);
      y += size + 7;
    };
    const totalsStartY = y;
    totRow('Items', inv.subtotal, 10, false, INK);
    if (Number(inv.discount) > 0) totRow('Discount', -Math.abs(Number(inv.discount)), 10, false, INK);
    if (gst) {
      const half = fmt((Number(inv.gst_amount) || 0) / 2);
      const gl = `GST included (CGST ${half} + SGST ${half})`;
      doc.font(font(gl, false)).fontSize(8).fillColor(MUTED);
      doc.text(gl, totLabelR - doc.widthOfString(gl), y + 1, { lineBreak: false });
      money(xR, y, inv.gst_amount, 9, false, MUTED);
      y += 15;
    }
    if (data.returnsTotal > 0) totRow('Returned', -Math.abs(data.returnsTotal), 10, false, INK);
    rule(y - 2); rule(y + 1.6);
    y += 5;
    doc.font('b').fontSize(13).fillColor(NAVY);
    doc.text('TOTAL', totLabelR - doc.widthOfString('TOTAL'), y, { lineBreak: false });
    money(xR, y, data.netTotal, 13.5, true, NAVY);
    y += 22;
    totRow('Paid', inv.paid_amount, 10, false, INK);
    doc.font('b').fontSize(11).fillColor(data.balance > 0 ? OWED : NAVY);
    doc.text('Balance', totLabelR - doc.widthOfString('Balance'), y, { lineBreak: false });
    money(xR, y, data.balance, 11, true, data.balance > 0 ? OWED : NAVY);
    y += 20;

    // payment box (shop's OWN uploaded QR only — never a generated one)
    let boxY = totalsStartY;
    const qrBuf = (() => {
      const q = biz.payment_qr;
      if (!q || typeof q !== 'string') return null;
      const m = /^data:image\/(jpeg|jpg|png);base64,(.+)$/.exec(q);
      if (!m) return null;
      try { return { buf: Buffer.from(m[2], 'base64'), fmt: m[1] === 'png' ? 'PNG' : 'JPEG' }; } catch { return null; }
    })();
    if (data.balance > 0 && (qrBuf || biz.upi_id)) {
      if (qrBuf) {
        try { doc.image(qrBuf.buf, x0, boxY, { width: 82, height: 82 }); } catch { /* bad image bytes — skip the box image */ }
        txt('Scan to pay', x0 + 94, boxY + 4, 9.5, true, NAVY);
        doc.font('b').fontSize(9.5);
        const spW = doc.widthOfString('Scan to pay');
        const amtT = fmt(data.balance);
        doc.font('b').fontSize(10.5);
        const amtW = doc.widthOfString(amtT);
        rsGlyph(x0 + 94 + spW + 8, boxY + 4, 10.5, NAVY);
        doc.fillColor(NAVY).text(amtT, x0 + 94 + spW + 8 + 10.5 * 0.56 + 3, boxY + 4, { lineBreak: false });
        void amtW;
        if (biz.upi_id) txt(`UPI: ${biz.upi_id}`, x0 + 94, boxY + 22, 9, false, MUTED);
        if (biz.upi_payee_name) txt(biz.upi_payee_name, x0 + 94, boxY + 35, 8.5, false, MUTED);
        boxY += 88;
      } else {
        txt('Pay by UPI', x0, boxY, 9.5, true, NAVY);
        txt(`UPI: ${biz.upi_id}${biz.upi_payee_name ? ' · ' + biz.upi_payee_name : ''}`, x0, boxY + 15, 9, false, MUTED);
        boxY += 34;
      }
    }
    y = Math.max(y, boxY) + 16;

    // ---- footer: thanks + signatory ----
    rule(y); y += 12;
    txt(biz.language === 'hi' ? 'धन्यवाद!' : 'Thank you!', x0, y, 11, true, NAVY);
    txt(`— ${biz.name || ''}`, x0, y + 16, 9, false, MUTED);
    const forLine = `For ${biz.name || ''}`;
    doc.font(font(forLine, false)).fontSize(9).fillColor(MUTED);
    doc.text(forLine, xR - doc.widthOfString(forLine), y, { lineBreak: false });
    const sig = 'Authorised Signatory';
    doc.font('r').fontSize(8).fillColor(MUTED);
    doc.text(sig, xR - doc.widthOfString(sig), y + 26, { lineBreak: false });

    const range = doc.bufferedPageRange();
    for (let p = 0; p < range.count; p++) {
      doc.switchToPage(p);
      doc.font('r').fontSize(7.5).fillColor(MUTED);
      const fy = doc.page.height - doc.page.margins.bottom + 4;
      doc.page.margins.bottom = 0;
      doc.text(biz.name || '', x0, fy, { width: W / 2, lineBreak: false });
      doc.text('BizYour by DILIGENCE', x0 + W / 2, fy, { width: W / 2, align: 'right', lineBreak: false });
    }
    doc.end();
  });
}

module.exports = { toCsv, toXlsx, toPdf, billPdf, FORMATS };
