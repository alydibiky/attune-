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
import { readDeadlines } from "./deadlines.js";
import { parsePayment } from "./yusr/paytext.js";

const RECEIPT_W = /\b(?:receipt|invoice|total|subtotal|paid|payment (?:of|successful|received)|transaction|transfer(?:red)?|amount|cashier|thank you for (?:shopping|your (?:order|purchase))|order (?:no|#|number))\b|إيصال|ايصال|فاتورة|الإجمالي|الاجمالي|المبلغ|تم الدفع|تم التحويل|تم خصم|عملية|(?<![\p{L}])(?:reçu|facture|recibo|factura|quittung|rechnung|fiş|fatura|struk|kwitansi|чек|रसीद|رسید|রসিদ|risiti|ใบเสร็จ|hóa đơn|收据|発票|領収書|영수증)(?![\p{L}])/iu;

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
  const sb = readSubscription(text, opts);
  if (sb && (sb.service || sb.sure)) return { kind: "subscription", sure: sb.sure, data: sb, why: sb.why, ask: sb.sure ? "" : sb.why };
  // 5. a receipt / a transfer
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
