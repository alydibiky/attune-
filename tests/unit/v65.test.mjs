// v6.5 — Ali: "make sure there are no glitches in all of Attune, nor logic constraints". A sweep of
// thousands of random sentences and broken inputs through the food reader, the edit commands, the
// model-answer repair, the calorie targets and the portion buttons. Found and fixed: a word such as
// "constructor" or "toString" crashed the reader (the lookup tables inherited JavaScript's own names).
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); } };
const F = await import("../../web-src/fit.js"); const R = await import("../../web-src/fitread.js"); const P = await import("../../web-src/fitplus.js");
const words = ["2","٣","نص","ربع","half","x3","kg","g","كيلو","طبق","كوباية","and","و","بال","مع","with","+",",","،","رز","بيض","بيضتين","فول","pizza","cola","بيبسي","burger","meal","no sugar","سكر","0","-5","99999","1/0","NaN","","  ","???","😀","<b>","كبير","small","fried","مقلي","تلت","فرخة","chicken","كشري","ساندوتش","sandwich","طعمية","milk","بلبن","شاي","tea","بطيخة","pizza hut","kfc","من عند","ورز","egs","1.5","0.0001","1e9","ـــ","ال","ب","و و و","بامية","باللحمة","wholeN","constructor","__proto__","toString"];
const bad = []; let n = 0;
let seed = 20260928; const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);   // the same sentences every run
const rnd = (k) => Array.from({ length: k }, () => words[Math.floor(random() * words.length)]).join(" ");
const okItem = (x) => x && typeof x.grams === "number" && isFinite(x.grams) && x.grams > 0 && x.grams <= 5000 && (x.kcal == null || (isFinite(x.kcal) && x.kcal >= 0)) && ["p","c","f"].every((k) => x[k] == null || (isFinite(x[k]) && x[k] >= 0)) && x.id;
for (let i = 0; i < 8000; i++) {
  const t = rnd(1 + Math.floor(random() * 9)); n++;
  try {
    const r = R.readMealText(t);
    if (!Array.isArray(r.items) || !Array.isArray(r.unknown)) bad.push(["shape", t]);
    for (const x of r.items) if (!okItem(x)) { bad.push(["item", t, JSON.stringify(x).slice(0, 160)]); break; }
    const again = R.readMealText(t); if (JSON.stringify(again) !== JSON.stringify(r)) bad.push(["not deterministic", t]);
    if (i % 5 === 0) { const c = R.draftCommand(r.items, rnd(1 + Math.floor(random() * 5))); if (c) for (const x of c.items) if (!okItem(x)) { bad.push(["cmd item", t, JSON.stringify(x).slice(0, 160)]); break; } }
  } catch (e) { bad.push(["THROW", t, String(e.stack).split("\n").slice(0, 2).join(" | ")]); }
  if (bad.length > 25) break;
}
// model JSON repair
const junk = ['', 'null', '[]', '{}', '{"items":null}', '{"items":[{"food":"rice","grams":-3}]}', '{"items":[{"food":"","grams":"abc"}]}', '[{"name":"egg","qty":1e308}]', '```json\n{"items":[{"food":"egg","grams":50},]}\n```', '{"items":[{"food":{"x":1}}]}', '<html>', '{"items":[{"food":"sugar","grams":900}]}'];
for (const j of junk) { try { const r = R.parseMealChecked(j); for (const x of r) if (!(isFinite(x.grams) && x.grams > 0)) bad.push(["parse item", j, JSON.stringify(x)]); } catch (e) { bad.push(["parse THROW", j, String(e)]); } }
// targets with odd profiles
for (const pf of [{}, { sex: "m" }, { sex: "x", age: "abc", cm: 0, kg: 0 }, { sex: "f", age: 200, cm: 300, kg: 500, activity: "none", goal: "lose", rate: 5 }, { sex: "m", age: 30, cm: 175, kg: 80, activity: "light", goal: "lose", rate: -1, goalKg: 200 }, { sex: "m", age: 5, cm: 100, kg: 20, activity: "light", goal: "gain" }]) {
  try { const t = F.targets(pf); if (t && !(isFinite(t.kcal) && t.kcal > 0 && isFinite(t.protein) && t.protein > 0 && t.carbs >= 0 && t.fat > 0)) bad.push(["targets", JSON.stringify(pf), JSON.stringify(t)]); } catch (e) { bad.push(["targets THROW", JSON.stringify(pf), String(e)]); }
}
// scaleItem / chooseFood / mergeWatch edges
try { const it = R.readMealText("rice").items[0]; for (const k of [0, -1, NaN, 1e9]) { const s = F.scaleItem(it, k); if (!(s.grams >= 1 && isFinite(s.kcal))) bad.push(["scale", k, JSON.stringify(s)]); } } catch (e) { bad.push(["scale THROW", String(e)]); }
try { const m = P.mergeWatch({ steps: 5, sources: ["a"] }, { steps: 9, activeKcal: 3, sources: ["a", "b"] }); if (m.steps !== 9 || m.activeKcal !== 3 || m.sources.length !== 2) bad.push(["mergeWatch", JSON.stringify(m)]); } catch (e) { bad.push(["merge THROW", String(e)]); }
for (const b of bad.slice(0, 10)) console.log("FAIL " + JSON.stringify(b));
console.log((bad.length ? "FAIL " : "PASS ") + `${n} random sentences (numbers, units, junk, emoji, "constructor"…) + broken model JSON + odd profiles + broken factors: no crash, no NaN, no negative or absurd amounts, same answer twice`);
if (bad.length) { console.log("\n1 FAILED"); process.exit(1); } else console.log("\nALL PASSED");
