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
// 9. buy agents: find the exact product, ask, then order
const AG = await import("../../web-src/agents.js");
const b = AG.parseAgent("buy me AirPods Pro 2 under 9000", { now: Date.parse("2026-10-27") });
ok(b.kind === "buy" && b.what === "AirPods Pro 2" && b.below === 9000 && b.tries.length === 2, "'buy me AirPods Pro 2 under 9000' → a buy agent on Amazon and noon, limit 9,000");
ok(AG.parseAgent("اشتريلي ايربودز برو 2 بأقل من 9000").what === "ايربودز برو 2" && AG.parseAgent("buy me something").ask, "Arabic works; 'something' is asked about, never guessed");
ok(AG.parseAgent("order my usual from Talabat").kind === "order" && AG.parseAgent("open Uber").kind === "open", "the usual order and opening apps are unchanged");
ok(AG.matchScore("AirPods Pro 2", { name: "Silicone case for AirPods Pro 2" }) === 0 && AG.matchScore("iPhone 16", { name: "Apple iPhone 16 Pro Max" }) === 0 && AG.matchScore("AirPods Pro 2", { name: "Apple AirPods Pro (2nd generation)" }) === 1, "a case is not the product; 'iPhone 16' is not the Pro Max; '2nd generation' is 2");
const ag = AG.makeAgent(b, 1);
const r1 = AG.takeBuyRound(ag, [{ name: "Case for AirPods Pro 2", price: 200 }, { name: "AirPods Pro 2", price: 9900, site: "noon" }]);
ok(r1.step === "search" && !r1.pending && r1.nearest.price === 9900, "nothing under the limit → keeps looking, tells the closest (9,900)");
const r2 = AG.takeBuyRound(r1, [{ name: "Apple AirPods Pro 2 USB-C", price: 8900, href: "https://www.amazon.eg/dp/X", site: "Amazon" }]);
ok(r2.step === "confirm" && r2.pending.price === 8900 && r2.pending.href.endsWith("/dp/X"), "found under the limit → waits for the person's 'Order it' (never buys by itself)");
// 10. the Home box: an order, a command, a request — and choices when it can't tell
globalThis.localStorage.removeItem("attune:intent:prefs");
const K = await import("../../web-src/commands.js");
const CR = await import("../../web-src/cmdrun.js");
const det = (t) => ({ doActions: /^(lunch|spent|paid)\b/i.test(t) ? 1 : 0, agent: /^buy me|^order my usual/i.test(t) ? (/^buy/i.test(t) ? "buy" : "order") : "" });
const go = (t) => CR.route(t, { api: { records: () => [], detect: det } });
ok(K.shapeOf("what is the capital of France?") === "question" && K.shapeOf("explain inflation") === "request" && K.shapeOf("milk tomorrow") === "unclear" && K.shapeOf("hello") === "greeting", "the sentence's shape: question / request / unclear / greeting");
ok(go("buy me AirPods Pro 2 under 9000").type === "doit", "an ORDER ('buy me…') goes to an agent");
ok(go("why do prices go up?").type === "chat" && go("explain inflation simply").type === "chat", "a REQUEST or a question goes to Chat, never taken for a command");
const u = go("milk tomorrow");
ok(u.type === "ask" && u.options.length === 4 && u.options[0] === "remind" && u.options.includes("todoAdd") && u.options.includes("note"), "can't tell ('milk tomorrow') → 4 choices (to-do, note, web, Chat), not a silent guess: " + JSON.stringify(u.options));
ok(go("hello").type === "chat", "a greeting is just answered");
// 7. the translator: everyday phrases at once, by code
const T = await import("../../web-src/translate.js");
ok(T.quickPhrase("hello", "ar") === "أهلاً" && T.quickPhrase("Hello!", "tr") === "Merhaba" && T.quickPhrase("شكراً", "en") === "Thank you" && T.quickPhrase("بكام ده؟", "en") === "How much is this?", "hello / شكرا / بكام ده → instant, exact (no «إلو»)");
ok(T.quickPhrase("the meeting moved to Tuesday", "ar") === null, "a real sentence still goes to the model");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
