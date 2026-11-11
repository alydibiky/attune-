/* v9.9.18: how many digits after the point each currency really uses (EGP 2, KWD / BHD / OMR / JOD / TND 3, JPY / KRW / IDR 0…),
   from Intl (every currency in the world), so a split or a salary plan is exact to the smallest coin of THAT country. */
const CACHE = {};
export function digitsOf(cur) { const c = String(cur || "").toUpperCase(); if (c in CACHE) return CACHE[c];
  let d = 2; try { d = new Intl.NumberFormat("en", { style: "currency", currency: c }).resolvedOptions().maximumFractionDigits; } catch (e) {} return (CACHE[c] = d); }
/** amount → integer of the smallest unit (piastres, fils, yen) and back */
export const toUnits = (a, cur) => Math.round((+a || 0) * 10 ** digitsOf(cur));
export const fromUnits = (u, cur) => u / 10 ** digitsOf(cur);
