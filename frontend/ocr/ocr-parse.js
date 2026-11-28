/* BizYour — diary photo OCR parser (pure functions, no DOM).
   Turns raw OCR text from a paper bill / udhaar diary into editable rows.
   NOTHING here saves data: the app always shows a review screen first,
   because OCR of handwriting is imperfect by nature.
   Works in the browser (window.BizOcrParse) and in Node (module.exports)
   so the exact same code that ships is the code that is tested. */
(function (root) {
  'use strict';

  var DEVA_DIGITS = { '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9' };
  function devaToLatin(s) {
    return String(s || '').replace(/[०-९]/g, function (c) { return DEVA_DIGITS[c]; });
  }

  /* One raw token -> number or null. Tolerates ₹, commas (Indian grouping),
     trailing % and classic OCR digit confusions (O->0, l->1) when the token
     is otherwise numeric. */
  function numToken(tok) {
    if (tok === undefined || tok === null) return null;
    var t = String(tok).replace(/[₹,]/g, '').replace(/rs\.?$/i, '').trim();
    if (!t) return null;
    if (/^[0-9]+(\.[0-9]{1,2})?$/.test(t)) return Number(t);
    if (/^[0-9OoIl|SsB.]+$/.test(t) && /[0-9OoIl|]/.test(t)) {
      var fixed = t.replace(/O/g, '0').replace(/o/g, '0').replace(/I/g, '1').replace(/l/g, '1').replace(/\|/g, '1').replace(/S/g, '5').replace(/B/g, '8');
      if (/^[0-9]+(\.[0-9]{1,2})?$/.test(fixed)) return Number(fixed);
    }
    return null;
  }

  var UNIT_WORDS = /^(kg|kgs|g|gm|gms|gram|grams|ltr|l|ml|pcs|pc|nos|no|pkt|pack|box|dozen|dz|mtr|m|ft|bag|bags|tin|btl|bottle)$/i;
  var SKIP_LINE = /^(total|grand\s*total|kul|jod|योग|कुल|sub\s*total|bill|invoice|parchi|पर्ची|date|dinank|दिनांक|नाम|name|item|saaman|सामान|rate|bhav|भाव|amount|rakam|रकम)\b/i;
  var JAMA_WORDS = /(जमा|jama|jamaa|vasuli|वसूली|vasooli|payment|paid|received|jama\s*hua)/i;

  function cleanName(s) {
    return String(s || '')
      .replace(/^[\s\d]+[.\)\-:]/, '')           // leading serial "1." "2)"
      .replace(/[-–—:;,.]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function hasLetter(s) { return /[A-Za-z\u0900-\u097F]/.test(s); }

  /* Split one OCR line into { name, numbers:[...], phone } */
  function splitLine(raw) {
    var line = devaToLatin(raw).replace(/\u00A0/g, ' ');
    var phone = '';
    var pm = line.match(/(?:\+?91[\s-]?)?([6-9]\d{9})\b/);
    if (pm) { phone = pm[1]; line = line.replace(pm[0], ' '); }
    var tokens = line.split(/\s+/).filter(Boolean);
    var nums = [], words = [];
    tokens.forEach(function (tok) {
      var bare = tok.replace(/[-–—:;,]+$/g, '');
      var unit = bare.match(/^([0-9.,]+)(kg|kgs|gms?|ltr|ml|pcs|nos|mtr)$/i);
      var n = numToken(bare);
      // A number glued to a unit ("10kg") is a pack size, part of the
      // item's name — never a qty/rate/amount column.
      if (unit && numToken(unit[1]) !== null) { words.push(tok); return; }
      if (n !== null) { nums.push(n); return; }
      if (UNIT_WORDS.test(bare)) return;         // drop lone unit words
      words.push(tok);
    });
    return { name: cleanName(words.join(' ')), numbers: nums, phone: phone, raw: raw };
  }

  function round2(x) { return Math.round(x * 100) / 100; }

  /* Bill diary line -> { name, qty, rate, amount } */
  function billRow(p) {
    var n = p.numbers;
    if (!n.length || !hasLetter(p.name) || p.name.length < 2) return null;
    if (SKIP_LINE.test(p.name)) return null;
    var qty, rate, amount;
    if (n.length >= 3) {
      var a = n[n.length - 3], b = n[n.length - 2], c = n[n.length - 1];
      if (a >= 1 && a <= 10000 && Math.abs(a * b - c) <= Math.max(2, c * 0.03)) { qty = a; rate = b; amount = c; }
      else if (a >= 1 && a <= 10000) { qty = a; amount = c; rate = round2(c / a); }
      else { qty = 1; rate = b; amount = c; }
    } else if (n.length === 2) {
      var x = n[0], y = n[1];
      if (Number.isInteger(x) && x >= 1 && x <= 1000 && y > 0) { qty = x; amount = y; rate = round2(y / x); }
      else { qty = 1; rate = y; amount = y; }
    } else { qty = 1; rate = n[0]; amount = n[0]; }
    if (!(amount > 0)) return null;
    return { name: p.name, qty: qty, rate: rate, amount: round2(amount) };
  }

  function parseBillText(text) {
    return String(text || '').split(/\r?\n/)
      .map(function (l) { return billRow(splitLine(l)); })
      .filter(Boolean);
  }

  /* Udhaar diary line -> { name, phone, amount, kind: 'udhaar' | 'jama' } */
  function udhaarRow(p, rawLine) {
    var n = p.numbers;
    if (!n.length || !hasLetter(p.name) || p.name.length < 2) return null;
    if (SKIP_LINE.test(p.name)) return null;
    var amount = n[n.length - 1];
    if (!(amount > 0)) return null;
    var name = p.name.replace(JAMA_WORDS, '').replace(/\s+/g, ' ').trim();
    name = cleanName(name);
    if (!hasLetter(name) || name.length < 2) return null;
    return { name: name, phone: p.phone || '', amount: amount, kind: JAMA_WORDS.test(rawLine) ? 'jama' : 'udhaar' };
  }

  function parseUdhaarText(text) {
    return String(text || '').split(/\r?\n/)
      .map(function (l) { return udhaarRow(splitLine(l), l); })
      .filter(Boolean);
  }

  var api = { parseBillText: parseBillText, parseUdhaarText: parseUdhaarText, _numToken: numToken };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BizOcrParse = api;
})(typeof window !== 'undefined' ? window : globalThis);
