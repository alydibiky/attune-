/* ---- v8.7 (persona 4, idea 9 — Ali: "do all"): one camera that knows what it sees ---------------------------------------------
   The photo's text is read on the phone first (ML Kit, NativeBridge.readText — already in the app), then CODE decides where the
   photo goes: a receipt → Money, a bill → Follow-ups (its due date), a page of text → Saved / ask about it, a sign or a menu in
   another language → Translate, a barcode → the product, little or no text → a plate → Fit & Food. No model, instant.
   ocr = { text, lines: [{text, h, y}] } (may be empty); codes = barcodes found ([string]).                                       */
const MONEY_WORDS = /\b(total|subtotal|sub-total|vat|tax|cash|change|visa|mastercard|receipt|invoice|amount due|qty|item)\b|الإجمالي|الاجمالي|المجموع|ضريبة|فاتورة|كاش|الباقي|نقدا|إيصال|ايصال/i;
const BILL_WORDS = /\b(electricity|water|gas|internet|phone|mobile|bill|due date|pay by|account no|meter|consumption|kwh)\b|كهرباء|كهربا|مياه|غاز|انترنت|إنترنت|فاتورة|تاريخ الاستحقاق|آخر موعد|اخر موعد|رقم الحساب|العداد|الاستهلاك/i;
const PRICE = /(\d[\d,]*\.\d{2}|\d[\d,]{2,})\s*(egp|le|l\.e|ج\.?م|جنيه|sar|aed|\$|€|£)?/gi;

/** → { kind: "receipt"|"bill"|"document"|"sign"|"barcode"|"plate", why } */
export function photoKind(ocr = {}, codes = [], appLang = "en") {
  if ((codes || []).some((c) => /^\d{8,14}$/.test(String(c)))) return { kind: "barcode", why: "a product barcode" };
  const text = String((ocr && ocr.text) || ""), lines = ((ocr && ocr.lines) || []).filter((l) => String(l.text || "").trim().length > 1);
  const words = (text.match(/[\p{L}]{2,}/gu) || []).length, prices = (text.match(PRICE) || []).length;
  if (lines.length < 3 && words < 6) return { kind: "plate", why: "little or no text" };
  if (BILL_WORDS.test(text) && /\b(due|pay by)\b|استحقاق|آخر موعد|اخر موعد|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/i.test(text) && prices >= 1) return { kind: "bill", why: "a bill with a due date" };
  if (MONEY_WORDS.test(text) && prices >= 2) return { kind: "receipt", why: "prices and a total" };
  // a sign or a menu in another language than the app's: short lines, few words a line
  const latin = (text.match(/[A-Za-z]/g) || []).length, arabic = (text.match(/[؀-ۿ]/g) || []).length;
  const foreign = appLang === "ar" ? latin > arabic * 1.5 && !/[؀-ۿ]/.test(text.slice(0, 40)) : arabic > latin || /[぀-ヿ一-鿿Ѐ-ӿ฀-๿]/.test(text);
  const avg = words / Math.max(1, lines.length);
  if (foreign && avg <= 6) return { kind: "sign", why: "short lines in another language" };
  if (lines.length >= 8 || words >= 40) return { kind: "document", why: "a page of text" };
  if (foreign) return { kind: "sign", why: "text in another language" };
  return { kind: "document", why: "text" };
}

/** Where each kind goes, and the words said about it. */
export const KIND_SAY = {
  receipt: ["A receipt — adding it to Money", "إيصال — بضيفه للفلوس"], bill: ["A bill — I'll watch its due date", "فاتورة — هراقب ميعادها"],
  document: ["A document — ask anything about it", "مستند — اسأل أي حاجة عنه"], sign: ["Text in another language — translating it", "كلام بلغة تانية — بترجمه"],
  barcode: ["A product barcode — looking it up", "باركود — بدوّر على المنتج"], plate: ["A plate — reading the food", "طبق — بقرا الأكل"],
};
