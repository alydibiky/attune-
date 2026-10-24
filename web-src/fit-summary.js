/* ---- v7.9 (Ali picked design B "dish on top, parts below" + A's slice buttons, 24 Oct 2026): what the photo summary shows,
   by code. The dish's name (one food: its own name — "Mango cake"; several: the biggest and "+ 2 more"), the portion word for the
   ½ · 1 · 1½ · 2 buttons (the food's own first portion: slice, piece, plate…) and which one is on. Pure; tests/unit/v900summary.test.mjs */
const UNIT = { slice: ["slice", "شريحة"], piece: ["piece", "قطعة"], plate: ["plate", "طبق"], bowl: ["bowl", "طبق"], cup: ["cup", "كوباية"], glass: ["glass", "كوباية"],
  sandwich: ["sandwich", "ساندوتش"], serving: ["portion", "حصة"], loaf: ["loaf", "رغيف"], bar: ["bar", "قطعة"], can: ["can", "علبة"], bottle: ["bottle", "زجاجة"], egg: ["egg", "بيضة"] };
export const PORTIONS = [0.5, 1, 1.5, 2];
/** items = the meal's parts → { en, ar } */
export function mealTitle(items) {
  const list = (items || []).filter((x) => x && (x.name || x.ar));
  if (!list.length) return { en: "Your meal", ar: "وجبتك" };
  const big = [...list].sort((a, b) => (b.kcal || 0) - (a.kcal || 0))[0];
  if (list.length === 1) return { en: big.name, ar: big.ar || big.name };
  const n = list.length - 1;
  return { en: `${big.name} + ${n} more`, ar: `${big.ar || big.name} + ${n === 1 ? "صنف كمان" : n === 2 ? "صنفين كمان" : n + " أصناف كمان"}` };
}
/** The word on the portion buttons: the food's first portion, else "portion". food = the table food of a one-food meal (or null). */
export function portionWord(food) {
  const k = food && food.portions ? Object.keys(food.portions)[0] : null;
  return UNIT[k] || UNIT.serving;
}
/** Which portion button is on: every part scaled the same → that factor, else null (the person changed one part on its own). */
export function portionOn(items) {
  const ks = (items || []).filter(Boolean).map((x) => x.k || 1);
  return ks.length && ks.every((k) => k === ks[0]) && PORTIONS.includes(ks[0]) ? ks[0] : null;
}
/** "½", "1", "1½", "2" */
export const portionLabel = (k) => (k === 0.5 ? "½" : k === 1.5 ? "1½" : String(k));
