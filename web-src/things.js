/* ---- v9.9.24 B6 X3 What I own (Ali picked A — "option to edit things that can be edited"; combined screen OK'd 12 Nov). A receipt photo
   becomes a thing's card: price = the receipt's TOTAL line (money-pages receiptTotal), the date printed on the receipt, the shop (its top
   line), the warranty if the receipt says it ("warranty 2 years", «ضمان سنتين», "garantie 24 mois"); the box photo later adds the serial
   (S/N, «الرقم المسلسل») or IMEI (15 digits, checked by its Luhn check digit). Every field stays editable; anything not sure is marked
   (yellow on the card) — never guessed: no TOTAL line → the price is "check"; two different dates → the date is "check". Pure.
   Tests: tests/x3/gen.mjs (10,000 receipts and boxes) + tests/unit/v9924x3.test.mjs. */
import { receiptTotal } from "./money-pages.js";
const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0)).replace(/٫/g, ".").replace(/٬/g, ",");
const pad = (n) => String(n).padStart(2, "0");
const TOTAL = /\b(grand\s*total|total|amount\s*due|net\s*(total|amount)|to\s*pay)\b|الإجمالي|الاجمالي|إجمالي|اجمالي|المجموع|الصافي|المطلوب|total|montant|summe|gesamt|toplam|jumlah/i;
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
/** Every date printed in the text → ["YYYY-MM-DD"] (day-first, as receipts in the 30 countries print it; YYYY-MM-DD too). */
export function datesIn(text, now = Date.now()) {
  const t = latin(text), out = new Set(), yNow = new Date(now).getFullYear();
  const ok = (y, m, d) => { if (y < 100) y += 2000; if (m < 1 || m > 12 || d < 1 || d > 31) return; const dt = new Date(y, m - 1, d); if (dt.getMonth() !== m - 1) return;
    if (y < yNow - 15 || dt.getTime() > now + 864e5) return; out.add(y + "-" + pad(m) + "-" + pad(d)); };
  for (const m of t.matchAll(/(?<!\d)(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/g)) ok(+m[1], +m[2], +m[3]);
  for (const m of t.matchAll(/(?<!\d)(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?![\d:])/g)) ok(+m[3], +m[2], +m[1]);
  for (const m of t.matchAll(/(?<!\d)(\d{1,2})[\s-]*([a-z]{3})[a-z]*[\s-,]*(\d{4})/gi)) { const mo = MONTHS[m[2].toLowerCase()]; if (mo) ok(+m[3], mo, +m[1]); }
  return [...out];
}
/** "warranty 2 years" / «ضمان سنتين» / «ضمان ١٨ شهر» / "garantie 24 mois" / "Garantie: 2 Jahre" → months | 0 */
export function warrantyMonths(text) {
  const t = latin(text).toLowerCase();
  if (!/warrant|guarant|ضمان|الضمان|garant|gewähr|garanti|garansi/.test(t)) return 0;
  const W = /(warrant\w*|guarant\w*|ضمان|الضمان|garant\w*|gewähr\w*|garanti\w*|garansi)[^\n]{0,24}/.exec(t); const s = W ? W[0] : t;
  if (/سنتين|عامين/.test(s)) return 24; if (/(^|\s)سنه|(^|\s)سنة|(^|\s)عام(\s|$)/.test(s) && !/\d/.test(s)) return 12;
  const m = /(\d+)\s*(years?|yrs?|سنين|سنوات|سنة|سنه|ans?|años?|anos?|jahre?|yıl|tahun|months?|mos?|شهر|شهور|أشهر|mois|meses|monate?|ay|bulan)/.exec(s);
  if (!m) return 0; const n = +m[1]; return /year|yr|سن|an|año|ano|jahr|yıl|tahun/.test(m[2]) ? n * 12 : n;
}
/** IMEI check (Luhn). */
export function imeiOk(s) { if (!/^\d{15}$/.test(s)) return false; let sum = 0; for (let i = 0; i < 15; i++) { let d = +s[i]; if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; } sum += d; } return sum % 10 === 0; }
/** A box / label photo → { serial, imei, model, sure } */
export function readBox(text) {
  const t = latin(text), r = { serial: "", imei: "", model: "" };
  const im = [...t.matchAll(/(?<!\d)(\d{15})(?!\d)/g)].map((m) => m[1]).filter(imeiOk); if (im.length) r.imei = im[0];
  const sn = /(?:s\/?n|serial\s*(?:no\.?|number|#)?|الرقم\s*المسلسل|الرقم\s*التسلسلي|رقم\s*مسلسل|n°\s*de\s*s[ée]rie|seriennummer|seri\s*no)\s*[:#.]?\s*([A-Z0-9][A-Z0-9-]{4,24})/i.exec(t);
  if (sn) r.serial = sn[1].toUpperCase();
  const md = /(?:model|mod[eè]le|modell|موديل|الموديل|طراز)\s*(?:no\.?|number)?\s*[:#.]?\s*([A-Z0-9][A-Z0-9-/]{2,24})/i.exec(t); if (md) r.model = md[1].toUpperCase();
  r.sure = !!(r.imei || r.serial);
  return r;
}
/** A receipt (the phone's text reader lines) → the thing's card fields, each with sure / check. */
export function readReceipt(lines, now = Date.now()) {
  const L = (lines || []).map((l) => String((l && (l.text != null ? l.text : l)) || "")).filter((s) => s.trim()), text = L.join("\n");
  // the price: the amount on the last TOTAL line (any of the languages); only then "sure" — else the old reader's guess, marked "check"
  let tot = null;
  for (let i = L.length - 1; i >= 0 && tot == null; i--) { const x = latin(L[i]); if (!TOTAL.test(x) || /sub\s*-?\s*total|subtotal|vat|tax|mwst|tva|iva|kdv|ppn|ضريبة|قبل/i.test(x)) continue;
    const ms = [...x.matchAll(/(?<![\d.])(\d{1,3}(?:[,\s]\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?![\d])/g)].map((m) => +m[1].replace(/[,\s]/g, "")).filter((v) => v > 0);
    if (ms.length) tot = ms[ms.length - 1]; }
  const price = tot != null ? tot : receiptTotal(L), hasTotal = tot != null;
  const ds = datesIn(text, now);
  const store = (L.find((l) => /\p{L}{3,}/u.test(l) && !/receipt|invoice|tax|فاتورة|فاتوره|ايصال|إيصال|tel|phone|vat|\d{5,}/i.test(l)) || "").trim().slice(0, 40);
  // the thing: the line with the biggest amount that isn't the total / a tax line
  let name = "", best = 0;
  for (const l of L) { const x = latin(l); if (TOTAL.test(x) || /vat|tax|ضريبة|خدمة|service|discount|خصم|cash|change|الباقي|mwst|tva|iva|kdv|ppn/i.test(x)) continue;
    // never a phone number, a date line or a long code (a 10-digit phone looks like the biggest "amount")
    if (/\b(tel|phone|fax|mob)\b|هاتف|تليفون|موبايل|\b(date|datum|fecha|tarih|tanggal)\b|التاريخ|تاريخ|\d{7,}/i.test(x) || datesIn(x, now).length) continue;
    const AMT = /(\d{1,3}(?:[,\s]\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s*(egp|le|sar|aed|usd|ج\.?م|جنيه|ريال)?\s*$/i;   // (thousands with , or a space: "11 000")
    const am = AMT.exec(x), nm = (am ? x.slice(0, am.index) : x).replace(/^\s*\d+\s*[x×]\s*/i, "").trim(), v = am ? +am[1].replace(/[,\s]/g, "") : 0;
    if (v > best && /\p{L}{2,}/u.test(nm) && nm !== store) { best = v; name = nm.slice(0, 60); } }
  const wm = warrantyMonths(text), date = ds.length === 1 ? ds[0] : ds.length ? ds.sort().reverse()[0] : "";
  let until = ""; if (wm && date) { const [y, m, d] = date.split("-").map(Number); const dt = new Date(y, m - 1 + wm, 1); const last = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate(); until = dt.getFullYear() + "-" + pad(dt.getMonth() + 1) + "-" + pad(Math.min(d, last)); }
  return { name, store, price: price || 0, date, warrantyMonths: wm, until,
    sure: { price: !!price && hasTotal, date: ds.length === 1, name: !!name, store: !!store, warranty: !!wm } };
}

/* ---- v10.1 T1 (Ali, 16 Nov 2026: My things lives in Follow-ups "and can be linked to Money"): a thing's price ↔ its payment in Money.
   paymentFor(thing, txns, taken) → the id of the expense that IS this purchase, or "":
     · the amount is the price (within 1%, at least 1 — "24,999" vs 25,000.00 card fee rounding is not the same payment: 1% max);
     · bought on a date → the payment is within 3 days of it (a card posts a day or two later); no date → only when ONE expense of
       that amount exists in the last 60 days (else unsure → nothing linked);
     · a payment already linked to another thing, an income, a transfer → never;
     · two that fit → the one whose note names the shop or the thing, else the closest day; still two → "" (never a guess).
   expenseFor(thing) → the Money line saved when the receipt isn't in Money yet. Tests: tests/thingpay/gen.mjs (10,000 cases). */
const wordsOf = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").split(" ").filter((w) => w.length >= 3);
const dayMs = 864e5, dOf = (s) => (s ? Date.parse(String(s).slice(0, 10) + "T12:00:00") : NaN);
export function paymentFor(t, txns = [], taken = [], now = Date.now()) {
  const price = +(t && t.price) || 0; if (!(price > 0)) return "";
  const tk = new Set(taken || []), bought = dOf(t.date);
  const fits = (txns || []).filter((x) => x && x.type === "expense" && !tk.has(x.id) && Math.abs((+x.amount || 0) - price) <= Math.max(1, price * 0.01)).filter((x) => {
    const d = dOf(x.date); if (isNaN(d)) return false;
    return !isNaN(bought) ? Math.abs(d - bought) <= 3 * dayMs : now - d <= 60 * dayMs && d <= now + dayMs;
  });
  if (!fits.length) return "";
  if (fits.length === 1) return fits[0].id;
  // (the 10,000 run: "2B" and "B.TECH" are short / dotted — the shop is also matched as one squeezed word inside the note)
  const want = new Set([...wordsOf(t.store), ...wordsOf(t.name)]), sq = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ""), shop = sq(t.store);
  const named = fits.filter((x) => { const note = [x.note, x.payee, x.merchant].join(" "); return wordsOf(note).some((w) => want.has(w)) || (shop.length >= 2 && new RegExp("(^|[^\\p{L}\\p{N}])" + shop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|[^\\p{L}\\p{N}])", "iu").test(note.toLowerCase().replace(/[.\-]/g, ""))); });
  if (named.length === 1) return named[0].id;
  const pool = named.length ? named : fits;
  if (isNaN(bought)) return "";
  const byDay = pool.map((x) => [Math.abs(dOf(x.date) - bought), x]).sort((a, b) => a[0] - b[0]);
  return byDay.length === 1 || byDay[0][0] < byDay[1][0] ? byDay[0][1].id : "";
}
export const expenseFor = (t, today) => ({ type: "expense", amount: Math.round((+t.price || 0) * 100) / 100, cat: "shopping", note: [t.name, t.store].filter(Boolean).join(" · ").slice(0, 120) || "Purchase", date: t.date || today, source: "things" });
