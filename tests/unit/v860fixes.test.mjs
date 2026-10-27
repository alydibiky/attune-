// v8.6 — Ali's 27 Oct list: voice answers anything, "homemade chicken pizza" keeps its name, free-text foods, watch numbers like his watch.
globalThis.localStorage = { _: {}, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = String(v); }, removeItem(k) { delete this._[k]; } };
const F = await import("../../web-src/fit.js");
const R = await import("../../web-src/fitread.js");
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
// 3. the food reader keeps the person's words
const p = R.readMealText("homemade chicken pizza 4").items;
ok(p.length === 1 && p[0].name === "Homemade chicken pizza" && p[0].id === "pizza-chicken" && p[0].qty === 4 && p[0].said === "homemade chicken pizza", "'homemade chicken pizza 4' → named as written, 4 slices, numbers from the chicken pizza in the table");
ok(F.food("pizza-chicken").en === "Chicken pizza", "the table's chicken pizza is not called 'Chicken ranch pizza'");
ok(R.readMealText("chicken pizza").items[0].name === "Chicken pizza" && !R.readMealText("2 eggs").items[0].own, "words the table already says keep the table's name");
const w = F.writtenItem('{"qty":4,"unit":"slice","grams_each":120,"kcal_per_100g":240,"protein_per_100g":12,"carbs_per_100g":28,"fat_per_100g":9}', "homemade chicken pizza");
ok(w && w.item.name === "Homemade chicken pizza" && w.item.grams === 480 && w.item.kcal === 1152 && w.item.estimate && w.food.id.startsWith("w:") && w.food.portions.slice === 120, "'as I wrote it' → the AI's estimate for that exact food, under the person's name, kept to be known next time");
ok(F.writtenItem('{"kcal_per_100g": 5000}', "x") === null && F.writtenItem("nonsense", "x") === null, "nonsense numbers are refused");
ok(/Homemade vs restaurant/.test(F.writtenMessages("homemade chicken pizza")[0].content), "the estimate prompt reads homemade / restaurant / brand");
// 4. the watch, like Ali's watch (5,085 steps · 311 kcal · 4.40 km)
F.setWatchMe({ kg: 70, cm: 170, sex: "m", age: 30 }, null);
ok(Math.abs(F.watchBurn({ steps: 6017, activeKcal: 8 }).kcal - 241) <= 3, "no profile change: 70 kg · 170 cm still ≈ 0.04 kcal a step");
F.setWatchMe({ kg: 95, cm: 180, sex: "m", age: 35 }, null);
ok(F.watchBurn({ steps: 4173 }).kcal > 220, "a heavier, taller person burns more per step (was 167 for everyone)");
const cal = F.matchWatch(5085, 311, 4.4);
ok(cal && cal.kcalPerStep === 0.0612 && cal.mPerStep === 0.865, "'Match my watch' → his watch's kcal and metres per step");
F.setWatchMe({ kg: 95, cm: 180, sex: "m", age: 35 }, cal);
ok(F.watchBurn({ steps: 5085 }).kcal === 311 && F.watchKm({ steps: 5085 }).km === 4.4, "matched: the same steps give his watch's 311 kcal and 4.4 km");
ok(F.watchBurn({ steps: 6442, activeKcal: 406 }).kcal === 406 && !F.watchBurn({ steps: 6442, activeKcal: 406 }).est, "real calories from the watch are used as they are");
const t = F.watchBurn({ steps: 6000, activeKcal: 0, totalKcal: 2300, lastAt: new Date(2026, 9, 27, 12, 0).getTime() });
ok(!t.est && t.from === "total" && t.kcal > 300 && t.kcal < 1500, "only TOTAL calories sent → total minus resting burn so far = active");
ok(F.learnWatch({ steps: 6442, activeKcal: 406, distanceM: 5740 }).kcalPerStep === 0.063, "a day with real numbers teaches Attune the watch's own ratio");
// 2. voice: small talk by code, the model's words made fit to speak
const V = await import("../../web-src/voice-talk.js");
ok(/How can I help/.test(V.smallTalk("hello")) && /وعليكم السلام/.test(V.smallTalk("السلام عليكم", "ar")) && /العفو/.test(V.smallTalk("شكرا")), "«hello» / «السلام عليكم» / «شكرا» are answered at once, no model needed");
ok(V.smallTalk("what is the capital of France") === "", "a real question is not small talk (it goes to the AI)");
ok(V.forSpeech("**Paris** is the capital.\n- It has 2M people [1].\nMore. And more. And more. Extra.") === "Paris is the capital. It has 2M people . More. And more.", "the model's answer: no markdown, lists or [n], at most 4 sentences");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
