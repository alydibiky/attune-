/* ---- Business extras, the pure part: roles & permissions, price lists, currencies --------------------------------
   No storage, no screens, no state changes (those are in books-ops2.js). Money stays in integer minor units.
   Tests: tests/unit/v620bizextras.test.mjs.                                                                          */
import { roundHalfAway, docTotals, DEFAULT_TAX } from "./books.js";

// ---- roles ------------------------------------------------------------------------------------------------------
/** What each role may do. "post" = create/post sales, receipts, bills; "void" = credit notes (cancelling a sale);
    "prices" = sell at a price other than the list price; "profit" = see profit / cost; "export" = backups, CSV, ETA files;
    "restore" = replace the books from a backup; "users" = manage users, roles and settings. Viewing is always allowed. */
export const PERMS = ["post", "void", "prices", "profit", "export", "restore", "users"];
export const ROLES = {
  owner: { en: "Owner", ar: "المالك", can: ["post", "void", "prices", "profit", "export", "restore", "users"] },
  accountant: { en: "Accountant", ar: "المحاسب", can: ["post", "void", "prices", "profit", "export"] },
  cashier: { en: "Cashier", ar: "الكاشير", can: ["post"] },
  viewer: { en: "Viewer", ar: "مشاهد فقط", can: [] },
};
export const can = (role, perm) => !!(ROLES[role] && ROLES[role].can.includes(perm));
/** The matrix as rows, for the screen and the tests. */
export const permMatrix = () => PERMS.map((p) => ({ perm: p, ...Object.fromEntries(Object.keys(ROLES).map((r) => [r, can(r, p)])) }));

// ---- price lists --------------------------------------------------------------------------------------------------
/** list: { id, name, group, from?, to?, prices: { [itemId]: [{ minQty, price }] } }. A customer belongs to a group
    (customer.group). The list that applies: same group, effective on the date (from ≤ date ≤ to; empty = open),
    the most recent "from" wins. Inside a list, the highest quantity break ≤ qty wins. No list → the item's own price. */
export function listFor(lists = [], group, date) {
  const ok = lists.filter((l) => l.group && l.group === group && (!l.from || l.from <= date) && (!l.to || date <= l.to) && l.active !== false);
  ok.sort((a, b) => ((a.from || "") < (b.from || "") ? 1 : (a.from || "") > (b.from || "") ? -1 : 0));
  return ok[0] || null;
}
export function priceFor({ lists = [], items = [], customers = [] }, { customer, item, qty = 1, date }) {
  const it = items.find((x) => x.id === item);
  const base = it ? it.price || 0 : 0;
  const c = customers.find((x) => x.id === customer);
  const l = c && c.group ? listFor(lists, c.group, date) : null;
  const breaks = l && l.prices && l.prices[item];
  if (!breaks || !breaks.length) return { price: base, list: null };
  const q = Math.abs(Number(qty) || 0);
  const best = [...breaks].filter((b) => Number(b.minQty || 0) <= q).sort((a, b) => Number(b.minQty || 0) - Number(a.minQty || 0))[0];
  return best ? { price: best.price, list: l.id, minQty: Number(best.minQty || 0) } : { price: base, list: null };
}
/** Is this list valid? Returns a list of problems (empty = fine). */
export function checkPriceList(l) {
  const p = [];
  if (!String(l.name || "").trim()) p.push("A price list needs a name");
  if (!String(l.group || "").trim()) p.push("Choose the customer group");
  if (l.from && l.to && l.to < l.from) p.push("The end date is before the start date");
  for (const [item, br] of Object.entries(l.prices || {})) {
    const seen = new Set();
    for (const b of br) {
      if (!Number.isInteger(b.price) || b.price < 0) p.push(`${item}: price must be a positive amount`);
      const k = Number(b.minQty || 0); if (seen.has(k)) p.push(`${item}: the quantity ${k} appears twice`); seen.add(k);
    }
  }
  return p;
}

// ---- currencies --------------------------------------------------------------------------------------------------
/** EGP is the base. Rates are "EGP for 1 unit", kept as integers with 5 decimals (48.5 → 4850000) so they are exact. */
export const BASE = "EGP";
export const CURRENCIES = { EGP: { en: "Egyptian pound", ar: "جنيه مصري" }, USD: { en: "US dollar", ar: "دولار أمريكي" }, EUR: { en: "Euro", ar: "يورو" }, SAR: { en: "Saudi riyal", ar: "ريال سعودي" }, AED: { en: "UAE dirham", ar: "درهم إماراتي" } };
export const RATE_SCALE = 100000;
/** "48.5" / 48.5 → 4850000. Up to 5 decimals; more → null. */
export function toRate5(v) {
  const s = String(v ?? "").trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/٫/g, ".").replace(/,/g, "");
  if (!/^\d+(\.\d{1,5})?$/.test(s)) return null;
  const [i, f = ""] = s.split(".");
  const r = Number(i) * RATE_SCALE + Number((f + "00000").slice(0, 5));
  return r > 0 ? r : null;
}
export const rateText = (r5) => (r5 / RATE_SCALE).toFixed(5).replace(/0+$/, "").replace(/\.$/, "");
/** Foreign minor units × rate → EGP piastres (half away from zero). */
export const toEGP = (minorFx, rate5) => roundHalfAway((minorFx * rate5) / RATE_SCALE);
/** The rate in force on a date: the latest entry for the currency dated on or before it. EGP is always 1. */
export function rateOn(rates = [], cur, date) {
  if (!cur || cur === BASE) return RATE_SCALE;
  let best = null;
  for (const r of rates) if (r.currency === cur && r.date <= date && (!best || r.date > best.date || (r.date === best.date && (r.n || 0) > (best.n || 0)))) best = r;
  return best ? best.rate : null;
}
/** A foreign-currency document: the user's prices (foreign) are kept in line.fxPrice; line.price becomes the EGP
    equivalent, so the ledger, tax and every report stay in EGP with no special cases. */
export function toBaseDoc(doc, currency, rate5) {
  if (!currency || currency === BASE) { const { fx, ...rest } = doc; return { ...rest, lines: doc.lines.map(({ fxPrice, ...l }) => l) }; }
  return { ...doc, fx: { currency, rate: rate5 }, lines: doc.lines.map((l) => { const fxp = l.fxPrice != null ? l.fxPrice : l.price; return { ...l, fxPrice: fxp, price: toEGP(fxp, rate5) }; }) };
}
/** The same document in its own currency (prices back to the foreign figures). */
export const fxView = (doc) => (doc.fx ? { ...doc, lines: doc.lines.map((l) => ({ ...l, price: l.fxPrice })) } : doc);
/** Totals in the document's own currency and in EGP. */
export function fxTotals(doc, tax = DEFAULT_TAX) {
  const egp = docTotals(doc, tax);
  if (!doc.fx) return { currency: BASE, rate: RATE_SCALE, own: egp, egp };
  return { currency: doc.fx.currency, rate: doc.fx.rate, own: docTotals(fxView(doc), tax), egp };
}
