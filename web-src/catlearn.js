/* ---- v9.9.18 M5 Categories that learn (Ali picked B — ask once, right when he changes a category; the list of rules in Settings).
   "Always put Seoudi in Groceries?" → yes: every payment from exactly that shop follows (written the same way in any script: case,
   Arabic letters, spaces), older ones too — but never a payment the person set by hand, and never a different shop with a longer name
   ("Seoudi Market Online" is not "Seoudi"). Pure; tests: tests/catlearn (10,000 ledgers) + tests/unit/v9918b3.test.mjs.            */
export const keyOf = (shop) => String(shop || "").toLowerCase().normalize("NFKC").replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim();
/** Learn: rules = { key: cat }. */
export const learn = (rules, shop, cat) => ({ ...(rules || {}), [keyOf(shop)]: cat });
export const unlearn = (rules, shop) => { const r = { ...(rules || {}) }; delete r[keyOf(shop)]; return r; };
/** The category a payment should get: the learned one for exactly its shop, unless the person chose it by hand. */
export const catFor = (rules, t) => (t && !t.catByHand && rules && rules[keyOf(t.shop || t.note)]) || (t && t.cat) || "other";
/** Apply to a ledger (after "Yes, always"): → { txns, changed } — only that shop, never the hand-set ones. */
export function applyRules(rules, txns = []) {
  let changed = 0;
  const out = (txns || []).map((t) => { const c = catFor(rules, t); if (c !== t.cat && !t.catByHand) { changed++; return { ...t, cat: c }; } return t; });
  return { txns: out, changed };
}
/** "11 older Seoudi payments will change too" */
export const wouldChange = (rules, shop, cat, txns = []) => (txns || []).filter((t) => !t.catByHand && keyOf(t.shop || t.note) === keyOf(shop) && t.cat !== cat).length;

/* the person's rules on the phone: { key: cat } (+ the shop's name as he wrote it, for the list in Money settings) */
export const CR_KEY = "attune:catrules:v1";
export function loadCatRules() { try { const v = JSON.parse(localStorage.getItem(CR_KEY) || "null"); return v && typeof v === "object" ? { rules: v.rules || {}, names: v.names || {} } : { rules: {}, names: {} }; } catch (e) { return { rules: {}, names: {} }; } }
export function saveCatRules(v) { try { localStorage.setItem(CR_KEY, JSON.stringify(v)); } catch (e) {} return v; }
