/* ---- v6.32: gold and currency savings tracker (roadmap: "gold and currency savings tracker (feeds zakat)") ----------------
   Type what you keep the way you'd say it: «جنيه ذهب», «سبيكة 10 جرام عيار 24 اشتريتها بـ 38,000», "50 g gold 21k bought for
   150,000", "500 g silver", "2,000 USD savings". Code reads it (no model). Today's prices are yours to set (gold per gram 24k,
   silver per gram, a rate per currency) — the same gold price Money's Zakat page uses, so one price serves both. Shows: what it
   is worth today, what you paid, the gain, pure gold in grams, and whether it reaches the niṣāb (85 g of pure gold, or 595 g of
   silver) and has been held a lunar year (354 days) — then the zakat (2.5 %), with "Send to Zakat" filling Money's Zakat page.
   Pure; tests: tests/unit/v736gold.test.mjs.                                                                                   */
import { amountsIn } from "./life.js";
import { payCurrency } from "./yusr/paytext.js";
import { homeCurrency } from "./locale.js";

export const NISAB_GOLD = 85, NISAB_SILVER = 595, HAWL_DAYS = 354, ZAKAT_RATE = 0.025;
// coins and bars with a standard weight (the Egyptian "gold pound" is 8 g of 21k; a guinea/sovereign 7.99 g of 22k)
const PIECES = [
  [/جنيه (?:ذهب|دهب)|(?:ذهب|دهب) جنيه|gold pound|جنيهات (?:ذهب|دهب)/i, 8, 21],
  [/نص جنيه|نصف جنيه|half pound/i, 4, 21],
  [/ربع جنيه|quarter pound/i, 2, 21],
  [/sovereign|guinea|ليره (?:ذهب|دهب)|ليرة (?:ذهب|دهب)|ليره رشادي|ليرة رشادي/i, 7.99, 22],
  [/(?:1|one)\s*(?:oz|ounce)|اونصه|أونصة|اوقيه|أوقية/i, 31.1035, 24],
];
const AR_D = "٠١٢٣٤٥٦٧٨٩";
const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => AR_D.indexOf(d)).replace(/٫/g, ".").replace(/٬/g, ",");
const r2 = (x) => Math.round(x * 100) / 100;

/** One sentence → a holding { kind: "gold"|"silver"|"cash", grams, karat, pieces, amount, currency, cost, costCurrency, note }, or null. */
export function parseHolding(text, { currency = homeCurrency() } = {}) {
  const raw = String(text || "").trim(); if (!raw) return null;
  const t = latin(raw).toLowerCase();
  const gold = /\bgold\b|ذهب|دهب|\boro\b|\bor\b|\bouro\b|\baltın|\bemas\b|سبيكه|سبيكة|غوايش|دبله|دبلة|سلسله|سلسلة|خاتم|اسوره|أسورة|انسيال/i.test(t) || PIECES.some((p) => p[0].test(t));
  const silver = /\bsilver\b|فضه|فضة|\bplata\b|\bargent\b|\bprata\b|\bgümüş|\bperak\b/i.test(t);
  const k = /(?:عيار|karat|carat|kt?\b|k\s|ct\b|قيراط)\s*(\d{2})|(\d{2})\s*(?:k\b|kt\b|karat|carat|ct\b|قيراط)/i.exec(t + " ");
  const karat = k ? Math.min(24, +(k[1] || k[2])) : 0;
  const cost = /(?:bought (?:it )?(?:for|at)|paid|cost|اشتريت(?:ها|ه)?\s*(?:ب|بـ|ب ـ)?|دفعت|بسعر|سعره|سعرها|for)\s*(\d[\d,.]*\s*(?:k|الف|ألف)?)/i.exec(t);
  let costVal = 0;
  if (cost) { const a = amountsIn(cost[1], currency); costVal = a.length ? a[0].value : 0; }
  const date = (/(\d{4}-\d{2}-\d{2})/.exec(t) || [])[1] || "";
  if (gold || silver) {
    // grams: "50 g", "10 جرام", "10 جم"; a known coin or bar; "3 جنيهات ذهب" = 3 coins
    const g = /(\d+(?:[.,]\d+)?)\s*(?:g\b|gr\b|grams?|gm\b|جرام|جم\b|غرام|gramos|grammes|gramas|gramm)/i.exec(t);
    let grams = g ? +g[1].replace(",", ".") : 0, k2 = karat, pieces = 0;
    if (!grams) for (const [re, w, kk] of PIECES) if (re.test(t)) {
      const n = (/(\d+)\s*(?:جنيه|جنيهات|ليره|ليرات|coins?|pounds?|sovereigns?|ounces?|oz)/i.exec(t) || [])[1];
      pieces = n ? +n : 1; grams = r2(w * pieces); k2 = k2 || kk; break;
    }
    if (!grams) return null;
    return { kind: silver && !gold ? "silver" : "gold", grams, karat: silver && !gold ? 0 : k2 || 21, pieces, cost: costVal, costCurrency: currency, date, note: raw };
  }
  // currency savings: "2,000 USD", «٥٠٠ دولار», "€300 savings"
  const cur = payCurrency(raw, "");
  if (cur && cur !== currency) {
    const a = amountsIn(raw, cur).filter((x) => x.value > 0);
    if (a.length) return { kind: "cash", amount: a[0].value, currency: cur, cost: costVal, costCurrency: currency, date, note: raw };
  }
  return null;
}

/** Pure gold in a holding (21k = 21/24 of its weight). */
export const pureGold = (h) => (h.kind === "gold" ? r2(h.grams * (h.karat || 24) / 24) : 0);

/** What a holding is worth today in your currency, with prices { gold24, silver, fx: { USD: 49.5 } }; null when no price is set. */
export function worth(h, prices = {}) {
  if (h.kind === "gold") return prices.gold24 > 0 ? r2(pureGold(h) * prices.gold24) : null;
  if (h.kind === "silver") return prices.silver > 0 ? r2(h.grams * prices.silver) : null;
  if (h.kind === "cash") { const r = (prices.fx || {})[h.currency]; return r > 0 ? r2(h.amount * r) : null; }
  return null;
}

/** Everything together: totals, gain, pure gold, the niṣāb and the zakat. now: for the lunar year. */
export function summary(holdings, prices = {}, now = Date.now()) {
  const rows = (holdings || []).map((h) => { const w = worth(h, prices); return { ...h, worth: w, gain: w != null && h.cost ? r2(w - h.cost) : null }; });
  const known = rows.filter((r) => r.worth != null);
  const total = r2(known.reduce((a, r) => a + r.worth, 0));
  const cost = r2(rows.filter((r) => r.cost && r.worth != null).reduce((a, r) => a + r.cost, 0));
  const gain = r2(rows.filter((r) => r.cost && r.worth != null).reduce((a, r) => a + (r.worth - r.cost), 0));
  const pure = r2(rows.reduce((a, r) => a + pureGold(r), 0)), silverG = r2(rows.filter((r) => r.kind === "silver").reduce((a, r) => a + r.grams, 0));
  const nisabValue = prices.gold24 > 0 ? r2(NISAB_GOLD * prices.gold24) : null;
  const held = (r) => !r.date || (now - Date.parse(r.date + "T12:00:00")) / 86400000 >= HAWL_DAYS;   // no date given: counted as held a year
  const reaches = nisabValue != null ? total >= nisabValue : pure >= NISAB_GOLD || silverG >= NISAB_SILVER;
  const heldValue = r2(known.filter(held).reduce((a, r) => a + r.worth, 0));
  const zakat = reaches && nisabValue != null ? r2(heldValue * ZAKAT_RATE) : null;
  const waiting = known.filter((r) => !held(r)).map((r) => ({ id: r.id, from: r.date, due: isoAdd(r.date, HAWL_DAYS) }));
  return { rows, total, cost, gain, gainPct: cost ? r2((gain / cost) * 100) : null, pure, silver: silverG, nisabValue, reaches, zakat, waiting,
    missing: rows.filter((r) => r.worth == null).map((r) => (r.kind === "cash" ? r.currency : r.kind)) };
}
function isoAdd(d, days) { const x = new Date(Date.parse(d + "T12:00:00") + days * 86400000); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; }

// ---- storage + Money's Zakat page -------------------------------------------------------------------------------------------
const KEY = "attune:gold:v1";
export function loadGold(ls = typeof localStorage !== "undefined" ? localStorage : null) {
  try { const j = JSON.parse((ls && ls.getItem(KEY)) || "null"); if (j && Array.isArray(j.items)) return { prices: { fx: {} }, ...j }; } catch (e) {}
  return { items: [], prices: { gold24: zakatGoldPrice(ls), silver: 0, fx: {} } };
}
export function saveGold(d, ls = typeof localStorage !== "undefined" ? localStorage : null) { try { ls && ls.setItem(KEY, JSON.stringify(d)); } catch (e) {} return d; }
export function addHolding(d, h, now = Date.now()) { return { ...d, items: [...d.items, { ...h, id: "g" + now.toString(36) + Math.random().toString(36).slice(2, 5), date: h.date || isoAdd(new Date(now).toISOString().slice(0, 10), 0) }] }; }
export function removeHolding(d, id) { return { ...d, items: d.items.filter((x) => x.id !== id) }; }
/** The gold price Money's Zakat page already has (24k per gram), so it is typed once. */
export function zakatGoldPrice(ls = typeof localStorage !== "undefined" ? localStorage : null) {
  try { const L = JSON.parse((ls && ls.getItem("ledger.v3")) || "null"); return +(L && L.zakat && L.zakat.goldPrice) || 0; } catch (e) { return 0; }
}
/** "Send to Zakat": Money's Zakat page gets your gold (as pure 24k grams), silver and today's prices. Nothing else there changes. */
export function toZakat(d, ls = typeof localStorage !== "undefined" ? localStorage : null) {
  try {
    const L = JSON.parse((ls && ls.getItem("ledger.v3")) || "null"); if (!L || typeof L !== "object") return false;
    const s = summary(d.items, d.prices);
    L.zakat = { ...(L.zakat || {}), goldGrams: s.pure, goldKarat: 24, silverGrams: s.silver, ...(d.prices.gold24 > 0 ? { goldPrice: d.prices.gold24 } : {}), ...(d.prices.silver > 0 ? { silverPrice: d.prices.silver } : {}) };
    ls.setItem("ledger.v3", JSON.stringify(L)); return true;
  } catch (e) { return false; }
}
