/* ---- v10.9.4 Scan anything — the conductor (SCAN_PLAN.md jobs 4, 5, 7; Ali's OK-SS: "accuracy is everything", then "add a specific model
   for each thing and make them work together"). The text the phone's text readers got from a screenshot / photo / shared file →
   WHAT it is and its fields, by one code reader per kind, in a fixed order (the most exact first):
     1. passport / visa / ID card — the code lines at the bottom (mrz.js; every field has its check digit)
     2. bank card — the card number's shape + VALID THRU (bankcard.js; only the last 4 are ever kept, never the CVC)
     3. Egyptian national ID — the 14 digits decoded (egid.js: birth date, governorate, a real date)
     4. subscription — a service, ONE price, a period, the next date, "yours" (subread.js)
     5. receipt / transfer — an amount that moved (Money's own reader, paytext.js) with receipt words
     6. a date to remember — deadlines.js (a ticket, a renewal, an appointment)
     7. nothing — left alone
   → { kind, sure, data, why, ask }. `sure` = every number passed its own check; when not sure the card asks ONE question (`ask`), and a
   bank card always asks before it is kept. Readers that need a model (Arabic text, a layout code can't read) come in front of this
   (SCAN_PLAN S3/S4): whatever they read is judged here the same way. Pure; tests: tests/scan/kinds.mjs (10,000 mixed, HARD). */
import { readMrz } from "./mrz.js";
import { readBankCard } from "./bankcard.js";
import { findIds, decodeId } from "./egid.js";
import { readSubscription } from "./subread.js";
import { readDeadlines, datesIn } from "./deadlines.js";
import { parsePayment } from "./yusr/paytext.js";

const RECEIPT_W = /\b(?:receipt|invoice|total|subtotal|paid|payment (?:of|successful|received)|transaction|transfer(?:red)?|amount|cashier|thank you for (?:shopping|your (?:order|purchase))|order (?:no|#|number))\b|إيصال|ايصال|فاتورة|الإجمالي|الاجمالي|المبلغ|تم الدفع|تم التحويل|تم خصم|عملية|(?<![\p{L}])(?:reçu|facture|recibo|factura|quittung|rechnung|fiş|fatura|struk|kwitansi|чек|रसीद|رسید|রসিদ|risiti|ใบเสร็จ|hóa đơn|收据|発票|領収書|영수증)(?![\p{L}])/iu;

// ---- v10.9.4 (Ali's real screenshots, 23 Nov: a PayPal payment, an Enzu invoice) -------------------------------------------------
const CURS = [["USD", /\$|\busd\b|us\$/i], ["EUR", /€|\beur\b/i], ["GBP", /£|\bgbp\b/i], ["EGP", /\b[eE][gG][pP]\b|ج\.?\s?م|جنيه|\bLE\b|L\.E/], ["SAR", /\bsar\b|ر\.?\s?س/i], ["AED", /\baed\b|د\.?\s?إ/i], ["KWD", /\bkwd\b/i], ["QAR", /\bqar\b/i], ["TRY", /₺|\btry\b/i], ["INR", /₹|\binr\b/i]];
const ARD = (s) => String(s).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/٫/g, ".").replace(/٬/g, ",");
const AMT = /(?:(\$|€|£|₺|₹|usd|eur|gbp|egp|sar|aed|kwd|qar|ج\.?\s?م)\s?)?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?!\d)\s?(usd|eur|gbp|egp|sar|aed|kwd|qar|try|inr|ج\.?\s?م|جنيه)?/i;
/** The amount right after a label ("Amount Due: $65.00 USD", "Total\n65.00 USD") → { amount, currency } */
function labelled(lines, label) {
  for (let i = 0; i < lines.length; i++) {
    const at = lines[i].search(label); if (at < 0) continue;
    for (const part of [lines[i].slice(at), lines[i + 1] || ""]) {
      const m = ARD(part).match(AMT); if (!m || !(m[1] || m[3])) continue;
      const cur = (CURS.find(([, re]) => re.test((m[1] || "") + " " + (m[3] || ""))) || [""])[0];
      const v = +m[2].replace(/,/g, ""); if (v > 0 && cur) return { amount: v, currency: cur };
    }
  }
  return null;
}
/** The paper's own date order: "11/17/2026" can only be month/day (an American invoice); "17/11/2026" only day/month. */
export function orderOf(text, fallback = "dmy") {
  for (const m of ARD(text).matchAll(/(?<!\d)(\d{1,2})\/(\d{1,2})\/(\d{4})(?!\d)/g)) { if (+m[2] > 12 && +m[1] <= 12) return "mdy"; if (+m[1] > 12 && +m[2] <= 12) return "dmy"; }
  return fallback;
}
const BILL_W = /amount due|balance due|due date|due on|payment due|invoice (?:has been )?generated|please pay|pay now|unpaid|المبلغ المستحق|تاريخ الاستحقاق|مستحق الدفع/i;
const PAID_W = /amount paid|paid on|you paid|you've been charged|thank you for your payment|payment (?:received|successful)|تم الدفع|تم خصم/i;

/** The text of a paper → what it is. opts: { now, order (dmy | mdy), home (currency) } */
export function readScan(text0, opts = {}) {
  const text = String(text0 || "");
  if (!text.trim()) return { kind: "nothing", sure: false, why: "empty" };
  const now = opts.now || Date.now();
  // 1. the code lines of a passport / visa / ID card
  const mz = readMrz(text);
  if (mz && mz.expiry) return { kind: mz.doc === "visa" ? "visa" : mz.doc === "id" ? "id" : "passport", sure: !!mz.sure, data: mz, why: mz.sure ? "" : "checkdigit", ask: mz.sure ? "" : "check" };
  // 2. a bank card (always asks before it is kept — Ali's rule on the OK'd page)
  const bc = readBankCard(text);
  if (bc && bc.last4) return { kind: "card", sure: !!bc.expiry, data: bc, why: bc.expiry ? "" : "expiry", ask: "keep" };
  // 3. an Egyptian national ID (the 14 digits must decode to a real person: century, date, governorate)
  const eg = findIds(text).map((n) => decodeId(n, now)).find((x) => x.ok);
  if (eg && /بطاقة|تحقيق الشخصية|جمهورية مصر|national id|\bid card\b|الرقم القومي/i.test(text)) return { kind: "egid", sure: true, data: eg, why: "" };
  // 4. a subscription
  const sb = readSubscription(text, { ...opts, order: orderOf(text, opts.order || "dmy") });
  if (sb && (sb.service || sb.sure)) return { kind: "subscription", sure: sb.sure, data: sb, why: sb.why, ask: sb.sure ? "" : sb.why };
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean), order = orderOf(text, opts.order || "dmy");
  // 5a. a bill not paid yet → a reminder on its due date (never an expense in Money)
  if (BILL_W.test(text) && !PAID_W.test(text)) {
    const due = labelled(lines, /amount due|balance due|المبلغ المستحق/i) || labelled(lines, /^total\b|\btotal:/i);
    const dl = lines.find((l) => /due date|due on|payment due|تاريخ الاستحقاق/i.test(l)) || "";
    let ds = []; try { ds = datesIn(dl.replace(/^.*?(?:date|on|due)\s*:?\s*/i, ""), { now, order }); } catch (e) {}
    const d = ds[0] ? new Date(ds[0].t) : null, iso = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "";
    const from = (text.match(/regards,?\s*\n\s*([^\n]{2,40})/i) || [])[1] || lines[0] || "";
    if (due) return { kind: "bill", sure: !!iso, data: { ...due, due: iso, title: from.replace(/\s+staff$/i, "").slice(0, 40) }, why: iso ? "" : "date", ask: iso ? "" : "date" };
  }
  // 5b. a receipt: the total; when the card was charged in the home currency too (PayPal: "3,531.67 EGP = 65.00 USD"), Money keeps that
  { const total = labelled(lines, /^(?:total|amount paid|total paid|grand total)\b|الإجمالي|الاجمالي|المبلغ المدفوع/i);
    if (total && (RECEIPT_W.test(text) || PAID_W.test(text) || /\bpayment\b|paid with/i.test(text))) {
      const home = opts.home || "";
      let inHome = null;
      if (home && total.currency !== home) {
        // the exchange line ties the two: "3,531.67 EGP = 65.00 USD" (its dollars must be the total's)
        for (const l of lines) { const m = ARD(l).match(/(\d[\d,]*(?:\.\d+)?)\s*([A-Z]{3}|ج\.?\s?م)\s*=\s*[$€£]?\s?(\d[\d,]*(?:\.\d+)?)\s*([A-Z]{3})?/);
          if (!m) continue; const a = +m[1].replace(/,/g, ""), b = +m[3].replace(/,/g, ""), ca = (CURS.find(([, re]) => re.test(m[2])) || [""])[0];
          if (ca === home && Math.abs(b - total.amount) < 0.005 && a > 0) { inHome = { amount: a, currency: home }; break; } }
      }
      return { kind: "receipt", sure: true, data: inHome ? { ...inHome, original: total, direction: "out" } : { ...total, direction: "out" }, why: "" }; } }
  // 5c. a receipt / a transfer read the way a bank message is
  if (RECEIPT_W.test(text)) {
    let p = null; try { p = parsePayment(text.replace(/\s*\n\s*/g, " · "), { home: opts.home || "", order: opts.order || "dmy", now }); } catch (e) { p = null; }
    if (p && p.ok && p.amount > 0) return { kind: "receipt", sure: p.confidence === "high", data: { amount: p.amount, currency: p.currency || opts.home || "", direction: p.direction || "out", party: p.party || "" }, why: p.confidence === "high" ? "" : "amount", ask: p.confidence === "high" ? "" : "amount" };
  }
  // 6. a date to remember
  let ds = []; try { ds = readDeadlines(text, { now, order: opts.order || "dmy" }); } catch (e) { ds = []; }
  if (ds.length) return { kind: "date", sure: ds.length === 1, data: ds, why: ds.length === 1 ? "" : "dates", ask: ds.length === 1 ? "" : "which" };
  if (sb) return { kind: "subscription", sure: false, data: sb, why: sb.why, ask: sb.why };
  return { kind: "nothing", sure: false, why: "nothing" };
}
