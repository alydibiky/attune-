// v10.8 (Ali, 22 Nov 2026: "25000 egp expense under masroof nada for shopping winter clothes" — he has a category "masroof nada" — was saved
// under Others with the whole sentence as the note; "fix this generally"). His own category named in the sentence (English, Franco, Arabic,
// with or without under / category / تحت / بند / في / من / على) wins, and the note is only what it was. 2,500 hardened composed cases of
// tests/moneycat/gen.mjs (full run 10,000: 32.39 % → 100 %; held-out 10,000: 75.30 % → 100 %).
process.env.N = "2500";
const { RESULT } = await import("../moneycat/gen.mjs");
const { understandAll } = await import("../../web-src/doit.js");
const { parseLog } = await import("../../web-src/yusr/logtext.js");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const L = { currency: "EGP", accounts: [{ id: "a1", name: "Cash", currency: "EGP" }], txns: [], recurring: [], customCats: [{ id: "c_nada", en: "masroof nada", ar: "مصروف ندى" }, { id: "c_car", en: "Car", ar: "العربية" }, { id: "c_gym", en: "Gym", ar: "الجيم" }, { id: "c_mom", en: "Mama", ar: "ماما" }] };
const one = (t) => { const r = understandAll(t, { now: Date.parse("2026-11-22T12:00:00"), stores: { "ledger.v3": L } }); const it = (r.actions || []).flatMap((a) => (a.kind === "money" ? a.items : []))[0]; return it || {}; };
for (const [t, cat, note] of [["25000 egp expense under masroof nada for shopping winter clothes", "c_nada", "shopping winter clothes"],
  ["دفعت 3000 تحت مصروف ندى جاكيت", "c_nada", "جاكيت"], ["500 for the car service", "c_car", "car service"], ["صرفت 60000 جم تحت Gym عشان الاشتراك الشهري", "c_gym", "الاشتراك الشهري"],
  ["٤٢٠٠ بند ماما — هدية عيد ميلاد", "c_mom", "هدية عيد ميلاد"], ["4000 L.E. under the category Gym — a dress for the party", "c_gym", "dress for the party"],
  ["مصروف 4k ج تحت el 3arabeya عشان جزمة جديدة", "c_car", "جزمة جديدة"], ["lunch 150", "food", "lunch"]]) {
  const it = one(t); ok(it.cat === cat, `${JSON.stringify(t)} → ${cat} (got ${it.cat})`); ok(it.note === note, `${JSON.stringify(t)} → note «${note}» (got «${it.note}»)`);
}
const p = parseLog("", "25000 egp expense under masroof nada for shopping winter clothes, taxi 60", { today: "2026-11-22", cats: ["food", "transport", "other", "c_nada"], ledger: L }).items;
ok(p[0].cat === "c_nada" && p[0].note === "shopping winter clothes" && p[1].cat === "transport", "the Money page's own box (parseLog) does the same");
ok(one("taxi to the shopping mall 80").cat !== "shopping", "a built-in word that is only part of the thing does not pull a category");
ok(RESULT.ok / RESULT.n >= 0.995, `2,500 composed cases: ${RESULT.ok}/${RESULT.n}`);
ok(RESULT.share >= 0.6, `different shapes ${(100 * RESULT.share).toFixed(1)} %`);
console.log(fail ? `FAIL ${fail}/${n}` : `PASS ${n}/${n}`);
process.exit(fail ? 1 : 0);
