/* ---- v6.32: price memory — what you paid for the same thing over time (roadmap: "15 % more than last month") --------------
   Every price you pay or note is kept per THING (not per shop): «كيلو طماطم ١٥», "milk 1L 45 at Carrefour", "petrol 92 18.75 a
   litre", and the items in Money's own entries ("milk 45", «بنزين ٥٠٠»). Same thing in other words or languages is one item
   (milk = لبن = حليب). With an amount (1 kg, 2 L, 6 eggs) the price is compared per unit, so a bigger pack is not a "rise".
   → "Milk: 52, 15 % more than last month (45)". Chat answers «اللبن بكام آخر مرة؟» from it. Pure; no model.
   Tests: tests/unit/v736prices.test.mjs.                                                                                      */
import { normDigits } from "./yusr/logtext.js";

// one item, many words (English, Arabic incl. Egyptian, and a few world languages); the key is the English word
const SAME = {
  milk: /\bmilk\b|لبن|حليب|leche|\blait\b|\bleite\b|\bmilch\b|\bsüt\b|\bsusu\b/i, eggs: /\beggs?\b|بيض|huevos?|\boeufs?\b|\bovos?\b|\beier\b|yumurta|\btelur\b/i,
  bread: /\bbread\b|عيش|خبز|\bpan\b|\bpain\b|\bpão\b|\bbrot\b|ekmek|\broti\b/i, rice: /\brice\b|رز|ارز|أرز|\barroz\b|\briz\b|\breis\b|pirinç|\bberas\b/i,
  sugar: /\bsugar\b|سكر|azúcar|azucar|\bsucre\b|açúcar|zucker|şeker|\bgula\b/i, oil: /\b(?:cooking |sunflower )?oil\b|زيت|aceite|\bhuile\b|\bóleo\b/i,
  tomatoes: /\btomato(?:es)?\b|طماطم|بندوره|قوطه|tomates?|tomaten?|domates/i, potatoes: /\bpotato(?:es)?\b|بطاطس|بطاطا|patatas?|pommes de terre|batatas?|kartoffeln?|patates/i,
  onions: /\bonions?\b|بصل|cebollas?|oignons?|zwiebeln?|soğan/i, chicken: /\bchicken\b|فراخ|دجاج|pollo|\bpoulet\b|frango|hähnchen|tavuk|\bayam\b/i,
  meat: /\b(?:beef|meat)\b|لحمه|لحمة|لحم|carne|viande|fleisch|\bet\b|daging/i, fish: /\bfish\b|سمك|pescado|poisson|\bpeixe\b|\bfisch\b|balık|\bikan\b/i,
  cheese: /\bcheese\b|جبنه|جبنة|جبن|queso|fromage|queijo|käse|peynir|\bkeju\b/i, coffee: /\bcoffee\b|قهوه|قهوة|\bcafé\b|\bcafe\b|kaffee|kahve|\bkopi\b/i,
  tea: /\btea\b|شاي|\bté\b|\bthé\b|\bchá\b|\btee\b|\bçay\b|\bteh\b/i, water: /\b(?:bottled )?water\b|مياه|ميه|مياة|\bagua\b|\beau\b|\bágua\b|wasser|\bsu\b|\bair\b/i,
  petrol: /\b(?:petrol|gasoline|fuel|benzine?)\b|بنزين|سولار|gasolina|essence|benzin|bensin/i, diesel: /\bdiesel\b|سولار|gasóleo|gazole/i,
  "gas cylinder": /\bgas cylinder\b|انبوبه|أنبوبة|انبوبة|بوتاجاز/i, cigarettes: /\bcigarettes?\b|سجاير|سجائر|cigarrillos|cigarettes|zigaretten|sigara|rokok/i,
  diapers: /\bdiapers?\b|nappies|بامبرز|حفاضات|pañales|couches|fraldas|windeln|bebek bezi|popok/i, "baby formula": /\b(?:baby )?formula\b|لبن اطفال|لبن أطفال|حليب اطفال|حليب أطفال/i,
};
const UNIT = [   // a quantity next to the price: [regex, unit, factor to the base unit]
  [/(\d+(?:\.\d+)?)\s*(?:kg|kilo|kilos|كيلو|كجم|كغ)\b/i, "kg", 1], [/(\d+(?:\.\d+)?)\s*(?:g|gr|grams?|جرام|جم)\b/i, "kg", 0.001],
  [/(\d+(?:\.\d+)?)\s*(?:l|lt|litres?|liters?|لتر)\b/i, "L", 1], [/(\d+(?:\.\d+)?)\s*(?:ml|مل)\b/i, "L", 0.001],
  [/(\d+)\s*(?:eggs|pcs|pieces|pack|قطع|قطعه|حبه|حبات|بيضات)\b/i, "pc", 1],
];
const AR_HALF = /نص كيلو|نصف كيلو/;
const fold = (s) => normDigits(s).replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?=\s|$|[؟?.,،!])/g, "ه").toLowerCase();
const r2 = (x) => Math.round(x * 100) / 100;

/** The item a text names: "milk" for «لبن», else its own words (without amounts, units and shop). */
export function itemKey(text) {
  const t = fold(text);
  for (const [k, re] of Object.entries(SAME)) if (re.test(t) || re.test(String(text))) return k;
  const w = t.replace(/\b(?:at|from|in|for|a|an|the|of|per|each)\b.*$/i, "").replace(/(?:من|في|عند|ب)\s+\S+.*$/, "").replace(/[\d.,]+\s*\S*/g, " ")
    .replace(/\b(?:kg|kilo|g|l|litre|liter|ml|egp|usd|sar|aed|le|pounds?)\b|كيلو|جنيه|ج\.م|لتر|جرام|ريال|درهم/gi, " ").replace(/[^\p{L}\s]/gu, " ").replace(/\s+/g, " ").trim();
  return w.split(" ").slice(0, 3).join(" ");
}

/** One price from a sentence → { key, name, price, qty, unit, unitPrice, store, date } or null. */
export function parsePrice(text, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const raw = String(text || "").trim(); if (!raw) return null;
  const t = normDigits(raw);
  let qty = 0, unit = "", base = 1, qtyAt = -1, qtyLen = 0;
  if (AR_HALF.test(t)) { qty = 0.5; unit = "kg"; qtyAt = t.search(AR_HALF); qtyLen = 8; }
  else if (/(?:^|\s)(?:كيلو|kilo)(?:\s|$)/i.test(t) && !/\d+(?:\.\d+)?\s*(?:kg|kilo|كيلو)/i.test(t)) { qty = 1; unit = "kg"; }
  else if (/(?:^|\s)(?:لتر|litre|liter)(?:\s|$)/i.test(t) && !/\d+(?:\.\d+)?\s*(?:l|litre|liter|لتر)/i.test(t)) { qty = 1; unit = "L"; }
  for (const [re, u, f] of UNIT) { const m = re.exec(t); if (m && qtyAt < 0 && !qty) { qty = +m[1]; unit = u; base = f; qtyAt = m.index; qtyLen = m[0].length; break; } }
  // the price: the number that is not the quantity (the last one, the way people write "milk 1L 45")
  const nums = [...t.matchAll(/\d[\d,]*(?:\.\d+)?/g)].filter((m) => !(qtyAt >= 0 && m.index >= qtyAt && m.index < qtyAt + qtyLen) && !/^\s*%/.test(t.slice(m.index + m[0].length)));
  if (!nums.length) return null;
  const price = +nums[nums.length - 1][0].replace(/,/g, "");
  if (!(price > 0)) return null;
  const key = itemKey(raw); if (!key) return null;
  const store = ((/\b(?:at|from)\s+([\p{L}][\p{L}&'’ -]{1,24})/u.exec(raw) || /(?:من|عند|في)\s+([ء-ي][ء-ي ]{1,20})/.exec(raw) || [])[1] || "").trim();
  const name = SAME[key] ? key[0].toUpperCase() + key.slice(1) : raw.split(/[\d٠-٩]/)[0].trim().slice(0, 30) || key;
  const q = qty ? r2(qty * base) : 0;
  return { key, name, price, qty: q, unit, unitPrice: q ? r2(price / q) : null, store, date: (/(\d{4}-\d{2}-\d{2})/.exec(t) || [])[1] || today };
}

/** Money's entries that name a thing ("milk 45", «بنزين ٥٠٠») → price records. Notes that are only a shop are skipped. */
export function fromLedger(ledger) {
  const out = [];
  for (const x of (ledger && ledger.txns) || []) {
    if (!x || x.type !== "expense" || !(x.amount > 0) || !x.note) continue;
    const key = Object.keys(SAME).find((k) => SAME[k].test(fold(x.note)) || SAME[k].test(x.note));
    if (!key) continue;
    const p = parsePrice(x.note + " " + x.amount, { today: x.date });
    if (p) out.push({ ...p, price: x.amount, unitPrice: p.qty ? r2(x.amount / p.qty) : null, date: x.date, source: "money", ref: x.id });
  }
  return out;
}

/** All records of one item, oldest first; the ones with a quantity compare per kg / L / piece. */
export function historyOf(records, key) { return (records || []).filter((r) => r.key === key).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)); }

/** The last price against the one about a month before (else the one before it). → { item, last, before, pct, perUnit, T } */
export function insight(records, key, now = Date.now()) {
  const h = historyOf(records, key); if (!h.length) return null;
  const last = h[h.length - 1], perUnit = !!last.unitPrice;
  const v = (r) => (perUnit ? r.unitPrice : r.price);
  const comparable = h.slice(0, -1).filter((r) => (perUnit ? r.unitPrice && r.unit === last.unit : !r.unitPrice || !last.unitPrice));
  if (!comparable.length) return { item: last.name, last, before: null, pct: null, perUnit, T: ["{i}: {p} — the first price I have", { i: last.name, p: fmtN(v(last)) + (perUnit ? " / " + last.unit : "") }] };
  const monthAgo = Date.parse(last.date) - 30 * 86400000;
  const before = [...comparable].reverse().find((r) => Date.parse(r.date) <= monthAgo + 5 * 86400000) || comparable[comparable.length - 1];
  const pct = v(before) ? Math.round(((v(last) - v(before)) / v(before)) * 100) : null;
  const when = Date.parse(before.date) <= monthAgo + 5 * 86400000 && Date.parse(before.date) >= monthAgo - 10 * 86400000 ? "last month" : "on {d}";
  const u = perUnit ? " / " + last.unit : "";
  const T = pct == null || pct === 0 ? ["{i}: {p}, the same as {w}", { i: last.name, p: fmtN(v(last)) + u, w: when === "last month" ? "last month" : before.date }]
    : pct > 0 ? [when === "last month" ? "{i}: {p}, {n}% more than last month ({b})" : "{i}: {p}, {n}% more than on {d} ({b})", { i: last.name, p: fmtN(v(last)) + u, n: pct, b: fmtN(v(before)), d: before.date }]
    : [when === "last month" ? "{i}: {p}, {n}% less than last month ({b})" : "{i}: {p}, {n}% less than on {d} ({b})", { i: last.name, p: fmtN(v(last)) + u, n: -pct, b: fmtN(v(before)), d: before.date }];
  return { item: last.name, last, before, pct, perUnit, T, cheapest: cheapestStore(h) };
}
/** Where it was cheapest (per unit when known), among shops you named. */
export function cheapestStore(h) {
  const withStore = h.filter((r) => r.store); if (withStore.length < 2) return null;
  const best = withStore.reduce((a, r) => ((r.unitPrice || r.price) < (a.unitPrice || a.price) ? r : a));
  return { store: best.store, price: best.unitPrice || best.price, unit: best.unitPrice ? best.unit : "" };
}
const fmtN = (x) => (Math.round(x * 100) / 100).toLocaleString("en-US");

/** Every item you have prices for, with its insight, the biggest rise first. */
export function overview(records, now = Date.now()) {
  const keys = [...new Set((records || []).map((r) => r.key))];
  return keys.map((k) => insight(records, k, now)).filter(Boolean).sort((a, b) => (b.pct || 0) - (a.pct || 0));
}

/** A Chat question about a price you paid: «اللبن بكام آخر مرة؟», "how much did I pay for milk?" → the item key, or "". */
export function priceQuestion(q) {
  const t = fold(q);
  if (!/(how much (?:did|do) i (?:pay|spend)|what did i pay|price of .* last time|last time i (?:bought|paid)|بكام اخر مره|بكام آخر مرة|دفعت كام|اشتريت .* بكام|كان بكام|بقي بكام|بقى بكام|سعر .* اخر مره)/i.test(t)) return "";
  for (const [k, re] of Object.entries(SAME)) if (re.test(t) || re.test(q)) return k;
  return "";
}

// ---- storage -------------------------------------------------------------------------------------------------------------------
const KEY = "attune:prices:v1";
export function loadPrices(ls = typeof localStorage !== "undefined" ? localStorage : null) { try { const j = JSON.parse((ls && ls.getItem(KEY)) || "null"); return j && Array.isArray(j.items) ? j : { items: [] }; } catch (e) { return { items: [] }; } }
export function savePrices(d, ls = typeof localStorage !== "undefined" ? localStorage : null) { try { ls && ls.setItem(KEY, JSON.stringify({ items: d.items.slice(-2000) })); } catch (e) {} return d; }
export function addPrice(d, rec, now = Date.now()) { return { ...d, items: [...d.items, { ...rec, id: "p" + now.toString(36) + Math.random().toString(36).slice(2, 5) }] }; }
/** What you typed + what Money already knows, without counting a Money entry twice. */
export function allRecords(d, ledger) { const mine = (d && d.items) || [], seen = new Set(mine.map((r) => r.ref).filter(Boolean)); return [...mine, ...fromLedger(ledger).filter((r) => !seen.has(r.ref))]; }
