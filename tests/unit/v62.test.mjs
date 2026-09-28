// Unit tests for v6.2 Fit & Food level 2 ("better than Yazio by levels"): faster logging, food
// quality, Ramadan times, body fat, the week plan + shopping list, the day score, the weekly report.
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); } };
const P = await import("../../web-src/fitplus.js");
const F = await import("../../web-src/fit.js");
const D = await import("../../web-src/fitdb.js");
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }
const tg = F.targets({ sex: "m", age: 21, cm: 178, kg: 92, activity: "light", goal: "lose", rate: 0.5, goalKg: 80 });

// ---- faster logging ----
const d0 = F.today(), y = new Date(); y.setDate(y.getDate() - 1); const d1 = F.today(y);
const egg = F.itemFromFood(F.food("egg"), 2, "piece"), ful = F.itemFromFood(F.food("ful"), 1, "plate");
const days = { [d1]: { meals: { breakfast: [{ ...egg, t: 1 }, { ...ful, t: 2 }] } }, [d0]: { meals: { breakfast: [{ ...egg, t: 3 }] } } };
eq(P.frequentFoods(days).map((e) => [e.key, e.count]), [["egg", 2], ["ful", 1]], "recent & frequent foods, most used first");
eq(P.copyMeal(days, d1, "breakfast").map((x) => [x.id, "t" in x]), [["egg", false], ["ful", false]], "yesterday's breakfast copied (fresh items)");
const mm = P.myMeal("My usual breakfast", [egg, ful]);
eq([mm.name, mm.items.length, mm.kcal === egg.kcal + ful.kcal], ["My usual breakfast", 2, true], "a saved “my meal”");
const own = P.customFood({ name: "Juhayna yogurt", per: "serving", serving: 150, kcal: 145, p: 13.5, c: 6, f: 7.5, sug: 6 });
eq([own.kcal, own.p, own.sug, own.portions], [97, 9, 4, { serving: 150 }], "my own food from a label per serving → per 100 g");
eq(P.customFood({ name: "", kcal: 1 }).error, "name", "a custom food needs a name");

// ---- food quality ----
const off = D.fromOFF({ code: "5449000000996", product_name: "Coca-Cola", nutriscore_grade: "e", nova_group: 4, nutriments: { "energy-kcal_100g": 42, proteins_100g: 0, carbohydrates_100g: 10.6, fat_100g: 0, sugars_100g: 10.6, "saturated-fat_100g": 0, sodium_100g: 0.004 } });
eq([off.sug, off.sat, off.salt, off.grade, off.nova], [10.6, 0, 0, "E", 4], "a product's sugar, sat. fat, salt (sodium × 2.5), Nutri-Score, NOVA");
const can = F.itemFromFood(off, 1, "can");
eq([can.grams, can.sug, can.grade], [330, 35, "E"], "one can: 35 g sugar, grade E");
eq(P.limits(tg), { sug: 53, sat: 23, salt: 5 }, "limits: sugar and sat. fat 10 % of energy, salt 5 g (WHO)");
const q = P.qualityTotals({ meals: { lunch: [can, ful] } });
eq([q.sug, q.known, q.total], [35, 1, 2], "the day's sugar counts only foods whose labels give it");
eq(F.scaleItem({ ...can, base: 330 }, 2).sug, 70, "doubling a portion doubles its sugar");

// ---- Ramadan ----
const t = P.fastTimes(new Date(Date.UTC(2026, 2, 1, 12)), 30.0444, 31.2357, 120);
eq([Math.abs(t.fajrMin - (4 * 60 + 53)) <= 4, Math.abs(t.maghribMin - (17 * 60 + 56)) <= 4, t.hours], [true, true, 13], "Cairo, 1 March 2026: Fajr ~04:53, Maghrib ~17:56 (within 4 min), 13 h fast");
const t2 = P.fastTimes(new Date(Date.UTC(2026, 5, 21, 12)), 30.0444, 31.2357, 180);
eq(t2.hours > 15.5 && t2.hours < 16.5, true, "a June fast in Cairo is ~16 h");
const rp = P.ramadanPlan(tg, t);
eq([rp.iftar + rp.snack + rp.suhoor === tg.kcal || Math.abs(rp.iftar + rp.snack + rp.suhoor - tg.kcal) <= 2, rp.glasses, rp.everyMin > 0], [true, Math.ceil(tg.water / 250), true], "Ramadan split (45/20/35 %) and water spread over the night");

eq([P.zoneOffset(new Date(Date.UTC(2026, 2, 1, 12)), "Africa/Cairo"), P.zoneOffset(new Date(Date.UTC(2026, 6, 1, 12)), "Africa/Cairo"), P.zoneOffset(new Date(Date.UTC(2026, 2, 1, 12)), "Asia/Dubai")], [120, 180, 240], "each city's own clock: Cairo winter +2 / summer +3, Dubai +4 (not the phone's)");
eq(Object.values(P.CITIES).every((c) => c.tz), true, "every city has its time zone");

// ---- body ----
eq([P.bodyFat({ sex: "m", height: 178, waist: 100, neck: 40 }), P.bodyFat({ sex: "f", height: 165, waist: 75, neck: 32, hip: 100 }), P.bodyFat({ sex: "m", height: 178, waist: 30, neck: 40 })], [25.5, 29.9, null], "US Navy body fat (man, woman; impossible numbers → none)");
eq(P.bodyFatClass(25.5, "m").en, "High", "25.5 % for a man is high");

// ---- week plan + shopping ----
const wk = P.weekPlan(tg, { from: new Date("2026-09-28T12:00:00") });
eq([wk.length, wk.every((d) => Math.abs(d.plan.total.kcal - tg.kcal) < tg.kcal * 0.15)], [7, true], "7 days, each within 15 % of the target");
const sl = P.shoppingList(wk);
eq([sl.length >= 4, sl.every((g) => g.items.every((x) => x.grams % 50 === 0 && x.grams > 0))], [true, true], "one shopping list by shop section, amounts rounded up to 50 g");
eq(/^🛒 قايمة المشتريات/.test(P.shoppingText(sl, "ar")), true, "…as text to share (Arabic)");

// ---- score + report ----
const good = { meals: { breakfast: [F.itemFromFood(F.food("egg"), 3, "piece"), F.itemFromFood(F.food("oats"), 80, "g")], lunch: [F.itemFromFood(F.food("chicken-breast"), 250, "g"), F.itemFromFood(F.food("rice"), 250, "g"), F.itemFromFood(F.food("salad"), 300, "g")], dinner: [F.itemFromFood(F.food("lentils-dry"), 100, "g"), F.itemFromFood(F.food("greek-yogurt"), 300, "g")] }, water: 3000 };
const sc = P.dayScore(good, tg);
eq(sc.score >= 60 && sc.score <= 100, true, "a balanced day scores well (" + sc.score + ")");
eq(P.dayScore({ meals: {} }, tg), null, "no food → no score");
const rep = P.weekReport({ [d0]: good, [d1]: good }, [{ d: d1, kg: 92 }, { d: d0, kg: 91.6 }], tg);
eq([rep.logged, rep.change, rep.lines.some((l) => /right direction/.test(l.en))], [2, -0.4, true], "the weekly report: days logged, weight change, the direction");

if (fails.length) { console.log(`\n${fails.length} FAILED`); process.exit(1); } else console.log("\nALL PASSED");
