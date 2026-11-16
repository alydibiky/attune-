/* ---- v10.0.3 (Ali, 16 Nov 2026: he scanned his bank card in Dates and the note was filled with "CB WealthEGP5576 0199 17 3251…" —
   the card's whole number as a note, and no expiry date: "too stupid"). A photo of a bank card, read by code:
     readBankCard(text) → null (not a bank card) | { last4, expiry: "YYYY-MM-DD" (the last day of its month) | "", bank, network }
   · the number: 12–19 digits in groups ("5576 0199 1723 3251", also with an OCR gap) — ONLY its last 4 are ever kept;
   · the expiry: MM/YY or MM/YYYY ("VALID THRU 08/29", "EXP 08-2029", «صالحة حتى ٠٨/٢٩»); with "valid from" too, the later one;
   · the bank (CIB, NBE, Banque Misr, QNB, HSBC…) and the network (Visa, Mastercard, Meeza, Amex).
   The card's number is never written anywhere — title "CIB card ·· 3251". Pure; tests: tests/bankcard/gen.mjs (10,000 cards). */
const AR_D = (s) => String(s || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
const BANKS = [["CIB", /\bc\s?i\s?b\b|commercial international|التجاري الدولي/i], ["NBE", /\bnbe\b|national bank of egypt|البنك الاهلي|البنك الأهلي|الاهلي المصري|الأهلي المصري/i], ["Banque Misr", /banque\s*misr|بنك مصر/i],
  ["QNB", /\bqnb\b/i], ["HSBC", /\bhsbc\b/i], ["AAIB", /\baaib\b|arab african/i], ["Alex Bank", /alex\s*bank|bank of alexandria|بنك الاسكندرية|بنك الإسكندرية/i], ["Banque du Caire", /banque du caire|بنك القاهرة/i],
  ["ADIB", /\badib\b|abu dhabi islamic/i], ["Faisal Islamic", /faisal islamic|بنك فيصل/i], ["Crédit Agricole", /cr[eé]dit agricole/i], ["Emirates NBD", /emirates\s*nbd/i], ["Al Rajhi", /al\s?rajhi|الراجحي/i], ["SNB", /\bsnb\b|saudi national bank/i],
  ["FAB", /\bfab\b|first abu dhabi/i], ["Mashreq", /mashreq/i], ["Telda", /\btelda\b/i], ["Revolut", /revolut/i], ["Wise", /\bwise\b/i], ["Barclays", /barclays/i], ["Chase", /\bchase\b/i]];
const NETS = [["Visa", /\bvisa\b/i], ["Mastercard", /master\s?card|\bmaestro\b/i], ["Meeza", /\bmeeza\b|ميزة/i], ["American Express", /american express|\bamex\b/i], ["UnionPay", /union\s?pay/i]];
const CARD_WORD = /\b(?:visa|master\s?card|maestro|meeza|amex|american express|valid|thru|through|expires?|exp|debit|credit|platinum|titanium|gold|wealth|prime|signature|infinite|world|cardholder|member since|bank|banque)\b|بنك|بطاقة|صالحة|ميزة/i;
const lastDay = (y, m) => { const d = new Date(Date.UTC(y, m, 0)).getUTCDate(); return y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0"); };

export function readBankCard(text0) {
  // (the OCR glues the card's currency to its neighbours: "CB WealthEGP5576 …")
  const text = AR_D(text0).replace(/[‎‏]/g, "").replace(/(EGP|USD|EUR|GBP|SAR|AED)(?=\d)/g, " $1 ").replace(/(?<=[a-z])(EGP|USD|EUR|GBP|SAR|AED)\b/g, " $1");
  if (!text.trim()) return null;
  // the number: a run of digit groups (spaces / dashes between), 12–19 digits in all, at least 3 groups or 15+ digits glued after letters
  let num = "";
  for (const m of text.matchAll(/\d(?:[ \-]{0,2}\d){11,22}/g)) {
    const run = m[0], digits = run.replace(/\D/g, ""), groups = run.trim().split(/[ \-]+/).filter(Boolean);
    if (digits.length < 12 || digits.length > 19) continue;
    if (groups.length < 3 && !(digits.length >= 15 && digits.length <= 16)) continue;
    if (groups.length < 3 && /^(?:2|3)\d{13}$/.test(digits)) continue;   // an Egyptian national ID (14 digits), not a card
    if (!num || digits.length > num.length) num = digits;
  }
  const net = (NETS.find(([, re]) => re.test(text)) || [""])[0], bank = (BANKS.find(([, re]) => re.test(text)) || [""])[0];
  if (!num || !(CARD_WORD.test(text) || net || bank || /(?:^|\D)(?:0[1-9]|1[0-2])\s?[\/\-]\s?\d{2}(?:\D|$)/.test(text))) return null;
  // the expiry: every MM/YY on the card — the latest is "valid thru" (the other is "valid from" / "member since")
  let best = "";
  for (const m of text.matchAll(/(?:^|[^\d\/])(0[1-9]|1[0-2])\s?[\/\-]\s?(20\d{2}|\d{2})(?![\d\/\-])/g)) {
    const y = m[2].length === 2 ? 2000 + +m[2] : +m[2]; if (y < 2015 || y > 2060) continue;
    // "VALID FROM 05/22", "MEMBER SINCE 08/24" is when it started — never the expiry, also when it is the only date read
    if (/(?:from|since|issued?|start|منذ|من)\s*:?\s*$/i.test(text.slice(Math.max(0, m.index - 14), m.index + 1))) continue;
    const d = lastDay(y, +m[1]); if (d > best) best = d;
  }
  return { last4: num.slice(-4), expiry: best, bank, network: net };
}
/** The Dates entry's title for a scanned card: the bank (or network), "Bank card" in the person's language, and ONLY the last 4. */
export const cardTitle = (c, docName = "Bank card") => [c.bank || c.network || "", docName, "·· " + c.last4].filter(Boolean).join(" ");
