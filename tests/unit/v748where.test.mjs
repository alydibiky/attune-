// v6.48 Where things are (CHAT_RUNS_APP.md S4): "my passport is on the desk" → asks if it moved; "where do I usually keep it" → counts.
const W = await import("../../web-src/whereis.js");
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

ok(eq(W.parseWhereSet("remember my passport is on the desk"), { thing: "passport", place: "on the desk" }), "“remember my passport is on the desk”");
ok(eq(W.parseWhereSet("I left my car keys in the kitchen drawer"), { thing: "car keys", place: "in the kitchen drawer" }), "“I left my car keys in the kitchen drawer”");
ok(eq(W.parseWhereSet("افتكر إن الباسبور على المكتب"), { thing: "الباسبور", place: "على المكتب" }), "«افتكر إن الباسبور على المكتب»");
ok(eq(W.parseWhereSet("حطيت المفاتيح في الدرج"), { thing: "المفاتيح", place: "في الدرج" }), "«حطيت المفاتيح في الدرج»");
ok(W.parseWhereSet("where is my passport?") === null && W.parseWhereSet("what is the weather") === null, "questions and other sentences are not places");
ok(eq(W.parseWhereAsk("where do I usually keep my passport?"), { thing: "passport", usual: true }), "“where do I usually keep my passport?” (usual)");
ok(eq(W.parseWhereAsk("where's my passport"), { thing: "passport", usual: false }), "“where's my passport” (now)");
ok(eq(W.parseWhereAsk("فين الباسبور؟"), { thing: "الباسبور", usual: false }) && W.parseWhereAsk("بحط الباسبور فين عادة؟").usual === true, "«فين الباسبور؟» · «بحط الباسبور فين عادة؟»");
ok(W.thingKey("my passport") === "passport" && W.thingKey("الباسبور") === W.thingKey("باسبوري") && W.thingKey("the keys") === "key", "the same thing under different words");
ok(W.placeKey("on the desk") === W.placeKey("desk") && W.placeKey("في الدرج") === W.placeKey("الدرج"), "the same place under different words");

let rec = [], t = Date.UTC(2026, 9, 1);
const put = (s) => { rec = [W.whereRecord(W.parseWhereSet(s), t), ...rec]; t += 864e5; };
ok(W.planSet(rec, W.parseWhereSet("my passport is in the drawer")).ask === false, "the first time: just kept");
put("my passport is in the drawer");
const p2 = W.planSet(rec, W.parseWhereSet("remember my passport is on the desk"));
ok(p2.ask && p2.was === "in the drawer", "a new place → ask “not in the drawer any more?”");
ok(W.planSet(rec, W.parseWhereSet("my passport is in the drawer")).same, "the same place again → nothing new to ask");
for (const s of ["my passport is on the desk", "my passport is in the drawer", "my passport is on the desk", "my passport is on the desk", "my passport is in the drawer", "my passport is on the desk", "my passport is on the desk", "my passport is in the drawer"]) put(s);
const u = W.usualPlaces(rec, "passport");
ok(u.length === 2 && u[0].n === 5 && u[1].n === 4 && /desk/.test(u[0].place), "counts: the desk 5 times, the drawer 4 times");
const a = W.whereAnswer(rec, { thing: "my passport", usual: true }, t);
ok(/desk 5 times/.test(a.en) && /drawer 4 times/.test(a.en) && /Last time you said: in the drawer/.test(a.en), "the answer: " + a.en);
ok(/مرات/.test(a.ar), "and in Egyptian Arabic: " + a.ar);
ok(W.whereAnswer(rec, { thing: "umbrella", usual: true }) === null, "nothing kept → no answer (Attune says it doesn't know)");
ok(W.thingsKnown(rec).length === 1, "the things known (for the meaning-guesser)");
console.log(fails ? fails + " FAILED" : "ALL PASSED"); process.exit(fails ? 1 : 0);
