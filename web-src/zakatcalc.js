/* ---- v8.7 (Ali, 29 Oct: "some of the zakat settings were removed … and the other zakat calculators, restore them all"):
   the ledger's own "More Zakāt calculators" (camels, cattle, sheep, crops, trade goods, buried treasure, Zakāt al-Fiṭr) brought
   into Attune's Money. The rulings are the ledger's (web-src/yusr/index.new.html camelDue / cattleDue / sheepDue / runCalc),
   copied here unchanged — Attune shows them; it never decides a ruling itself.
   calc(kind, inputs, { nisab }) → { due: true|false, lines: [[n, key]…][] (livestock) | amount | kg, rate?, need? }
   Pure; tests: tests/unit/v870zakatcalc.test.mjs.                                                                            */
function bestCombo(n, big, small, bigName, smallName) {
  let best = -1, opts = [];
  for (let h = 0; h * big <= n; h++) for (let l = 0; h * big + l * small <= n; l++) { const cov = h * big + l * small; if (cov > best) { best = cov; opts = [[h, l]]; } else if (cov === best && !opts.some((o) => o[0] === h && o[1] === l)) opts.push([h, l]); }
  return opts.slice(0, 2).map(([h, l]) => { const r = []; if (h) r.push([h, bigName]); if (l) r.push([l, smallName]); return r; }).filter((r) => r.length);
}
export function camelDue(n) {
  if (n < 5) return null; if (n < 10) return [[1, "shah"]]; if (n < 15) return [[2, "shah"]]; if (n < 20) return [[3, "shah"]]; if (n < 25) return [[4, "shah"]];
  if (n < 36) return [[1, "bintMakhad"]]; if (n < 46) return [[1, "bintLabun"]]; if (n < 61) return [[1, "hiqqah"]]; if (n < 76) return [[1, "jadhaah"]];
  if (n < 91) return [[2, "bintLabun"]]; if (n < 121) return [[2, "hiqqah"]]; return bestCombo(n, 50, 40, "hiqqah", "bintLabun");
}
export function cattleDue(n) { if (n < 30) return null; if (n < 40) return [[1, "tabi"]]; if (n < 60) return [[1, "musinnah"]]; return bestCombo(n, 40, 30, "musinnah", "tabi"); }
export function sheepDue(n) { if (n < 40) return null; if (n < 121) return [[1, "shah"]]; if (n < 201) return [[2, "shah"]]; if (n < 400) return [[3, "shah"]]; return [[Math.floor(n / 100), "shah"]]; }

/** The names of what is given, as the ledger says them. */
export const ANIMALS = {
  shah: ["a sheep or goat", "شاة"], bintMakhad: ["a she-camel in her 2nd year (bint makhāḍ)", "بنت مخاض"], bintLabun: ["a she-camel in her 3rd year (bint labūn)", "بنت لبون"],
  hiqqah: ["a she-camel in her 4th year (ḥiqqah)", "حِقّة"], jadhaah: ["a she-camel in her 5th year (jadhaʿah)", "جذعة"],
  tabi: ["a one-year-old calf (tabīʿ)", "تبيع"], musinnah: ["a two-year-old cow (musinnah)", "مُسِنّة"],
};
export const KINDS = [
  ["camels", "🐪", "Camels", "الإبل"], ["cattle", "🐄", "Cattle", "البقر"], ["sheep", "🐑", "Sheep & goats", "الغنم"], ["crops", "🌾", "Crops & fruit", "الزروع والثمار"],
  ["trade", "🏪", "Trade goods", "عروض التجارة"], ["rikaz", "💎", "Buried treasure (rikāz)", "الركاز"], ["fitr", "🌙", "Zakāt al-Fiṭr", "زكاة الفطر"],
];
const n0 = (v) => { const x = parseFloat(String(v == null ? "" : v).replace(/,/g, "")); return isFinite(x) ? x : 0; };
/** One calculator. inputs: livestock { head }; crops { kg, rain: true|false, nisabKg = 612 }; trade { stock, cash, owedToYou, youOwe };
 *  rikaz { value }; fitr { people, perPerson }. nisab = the money niṣāb today (the ledger's, from the gold / silver price). */
export function calc(kind, i = {}, { nisab = 0 } = {}) {
  if (kind === "camels" || kind === "cattle" || kind === "sheep") {
    const res = { camels: camelDue, cattle: cattleDue, sheep: sheepDue }[kind](Math.floor(n0(i.head)));
    if (!res) return { due: false };
    return { due: true, options: Array.isArray(res[0]) && Array.isArray(res[0][0]) ? res : [res] };
  }
  if (kind === "crops") {
    const kg = n0(i.kg), rate = i.rain === false ? 5 : 10, nis = n0(i.nisabKg) || 612;
    if (kg < nis) return { due: false, need: nis - kg, unit: "kg" };
    return { due: true, kg: Math.round(kg * rate) / 100, rate };
  }
  if (kind === "trade") {
    const net = n0(i.stock) + n0(i.cash) + n0(i.owedToYou) - n0(i.youOwe);
    if (!(nisab > 0)) return { due: false, noPrice: true };
    if (net < nisab) return { due: false, need: nisab - net, net };
    return { due: true, amount: Math.round(net * 2.5) / 100, rate: 2.5, net };
  }
  if (kind === "rikaz") return { due: n0(i.value) > 0, amount: Math.round(n0(i.value) * 20) / 100, rate: 20 };
  if (kind === "fitr") return { due: true, amount: Math.round(n0(i.people) * n0(i.perPerson) * 100) / 100 };
  return { due: false };
}
