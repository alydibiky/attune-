// Unit tests for v6.3 Fit & Food: the dietitian-style reader (scored on 127 + 60 real sentences and
// 10 broken model answers), editing by talking, photo portions by geometry, the zoomed look, and
// watch calories never counted twice.
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); } };
const F = await import("../../web-src/fit.js");
const R = await import("../../web-src/fitread.js");
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

// ---- the measuring sets: the reader must not get worse ----
const { result } = await import("../eval/run.mjs");
eq([result.perfect >= 0.97, result.holdout >= 0.95, result.bad === 1], [true, true, true], `reader: ${Math.round(result.perfect * 100)}% of 127 meals and ${Math.round(result.holdout * 100)}% of 60 unseen meals fully right; ${Math.round(result.bad * 100)}% of broken model answers repaired`);

// ---- details ----
const r = (t) => R.readMealText(t).items.map((x) => [x.id, x.grams]);
eq(r("نص فرخة مشوية ورز"), [["chicken-grilled-half", 400], ["rice", 180]], "«نص فرخة مشوية ورز»: half a chicken (400 g) + a side of rice");
eq(r("ربع كيلو كفتة"), [["kofta", 250]], "«ربع كيلو كفتة» = 250 g");
eq(r("كوباية شاي بمعلقتين سكر"), [["tea", 240], ["sugar", 8]], "«بمعلقتين سكر»: two TEAspoons of sugar in tea");
eq(r("tea no sugar"), [["tea", 240]], "“no sugar” adds nothing");
eq(r("a big mac meal").map((x) => x[0]), ["big-burger", "fries", "cola"], "a “meal” comes with fries and a drink");
eq(r("beef burger"), [["burger", 220]], "“beef burger” is one burger, not beef + burger");
eq(r("half a pizza"), [["pizza", 428]], "half a pizza = 4 slices");
eq(R.readMealText("2 eggs").items[0].grams, 100, "the same words read the same way every time (no state kept between readings)");
eq(R.readMealText("500 g olive oil").items[0].flag, "amount", "500 g of oil is flagged and capped, not logged");

// ---- editing by talking ----
let items = R.readMealText("2 eggs, rice, molokhia and a pepsi").items;
const run = (c) => { const x = R.draftCommand(items, c); if (x) items = x.items; return x; };
run("remove the pepsi"); run("rice 250 g"); run("make it 3 eggs"); run("add a spoon of oil"); run("شيل الملوخية"); run("ضيف كوباية شاي بمعلقتين سكر");
eq(items.map((x) => [x.id, x.grams]), [["egg", 150], ["rice", 250], ["olive-oil", 14], ["tea", 240], ["sugar", 8]], "remove · grams · count · add (English and Arabic)");
eq([R.draftCommand(items, "what is this"), R.draftCommand(items, "remove the pizza")], [null, null], "a question, or removing something not there, changes nothing");

// ---- photos: portions by geometry, the zoomed look ----
const koshari = F.food("koshari"), egg = F.food("egg"), cola = F.food("cola");
eq([F.geoGrams(egg, { count: 3 }), F.geoGrams(cola, { container: "can" }), F.geoGrams(koshari, { container: "bowl" })], [150, 330, 350], "counted eggs, a can, a bowl — by the food's own portions");
const g = F.geoGrams(koshari, { plate_share: 0.5, height: "normal" });
eq(g > 400 && g < 560, true, `half a dinner plate of koshari, normal height ≈ ${g} g`);
const p = F.parsePhoto(JSON.stringify({ kind: "meal", plate: "dinner plate", items: [{ food: "koshari", plate_share: 0.5, height: "normal", grams: 60, confidence: 0.4, box: [0.1, 0.1, 0.5, 0.5] }] })).items[0];
eq([p.flag, p.grams > 150 && p.grams < 300, p.box], ["portion", true, [0.1, 0.1, 0.5, 0.5]], "the model's 60 g against the plate's ~500 g: blended, and flagged to check");
const z = F.applyZoom({ ...p, said: "pasta", conf: 0.4 }, JSON.stringify({ food: "koshari", alternatives: ["pasta with red sauce"], confidence: 0.8 }));
eq([z.id, z.grams === p.grams, z.zoomed], ["koshari", true, true], "the zoomed look renames the food, keeps the grams");
eq(F.applyZoom({ ...p, conf: 0.9 }, JSON.stringify({ food: "rice", confidence: 0.3 })).id, "koshari", "a less sure zoomed answer never overrides a surer one");
eq(F.photoMessages().length === 2 && /Koshari/.test(F.photoMessages()[0].content) && F.DISH_NAMES.length > 300, true, "the model picks from the list of 300+ dish names");

// ---- the watch ----
const day = { meals: {}, workouts: [{ kcal: 200 }], watch: { steps: 9000, activeKcal: 350 } };
eq([F.dayTotals(day).burned, F.dayTotals(day).burnedFrom, F.dayTotals(day).steps], [350, "watch", 9000], "burned = the larger of watch (350) and logged workouts (200), never 550");
eq(F.dayTotals({ meals: {}, workouts: [{ kcal: 400 }], watch: { activeKcal: 100 } }).burned, 400, "a logged workout the watch didn't see still counts");

if (fails.length) { console.log(`\n${fails.length} FAILED`); process.exit(1); } else console.log("\nALL PASSED");
