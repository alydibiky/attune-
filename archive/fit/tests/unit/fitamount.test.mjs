// v6.18 the amount question (Ali: "I want an accuracy of above 80 percent"): photo readers name most foods right but
// misjudge the amount, so each photo item that is not exact asks one concrete question, and the answer is remembered.
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const F = await import("../../web-src/fit.js");
const A = await import("../../web-src/fitamount.js");
const C = await import("../../web-src/fitclip.js");
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const item = (id, extra = {}) => { const fd = F.food(id); const it = F.itemFromFood(fd, 1, Object.keys(fd.portions)[0]); return { ...it, base: it.grams, conf: 0.5, said: fd.en, ...extra }; };

const egg = A.amountQuestion(item("egg-fried"));
ok(egg && egg.kind === "count" && egg.choices[egg.at].grams === 46 && egg.choices.find((c) => c.n === 4).grams === 184, "fried egg: how many? 4 eggs = 184 g");
const rice = A.amountQuestion(item("rice"));
ok(rice && rice.kind === "plate" && rice.choices.map((c) => c.grams).join() === "45,115,225,340,450,630", "rice: a little, ¼ ½ ¾ full, heaped plate = 45/115/225/340/450/630 g");
const cola = A.amountQuestion(item("cola"));
ok(cola && cola.kind === "drink" && cola.choices[1].en === "1 can" && cola.choices[1].grams === 330, "cola: its own container (a can, 330 ml)");
ok(A.amountQuestion(item("tahini")).kind === "spoon", "tahini: how many spoons?");
ok(A.amountQuestion({ ...item("rice"), explicit: true }) === null && A.amountQuestion({ ...item("rice"), from: "photo-text" }) === null && A.amountQuestion({ ...item("rice"), quick: true }) === null,
  "no question when the amount is exact (written, printed in the photo, a quick add)");
ok(A.amountQuestion({ name: "mystery", grams: 100, kcal: null }) === null, "no question for an unknown food (nothing to scale)");

const r = A.answerAmount(item("egg-fried"), 184);
ok(r.grams === 184 && r.kcal === Math.round(item("egg-fried").kcal * 4) && r.answered && r.k === 4, "answering 4 eggs: 184 g, 4× the calories, marked answered");
const draft = [item("salad", { conf: 0.9 }), item("rice"), item("egg-fried"), { ...item("cola"), explicit: true }];
const first = A.askFirst(draft);
ok(first.length === 2 && first[0] === 1 && first[1] === 2, "ask first: the unsure items, most calories first (rice, then egg); not the sure salad nor the written cola");
ok(A.askFirst([A.answerAmount(item("rice"), 225)]).length === 0, "an answered item is not asked again");
ok(A.askFirst([item("rice", { learned: true, learnedN: 2 })]).length === 0, "a dish whose amount you set twice is not asked again");

// the answer is remembered for the dish: the next fast-path photo of it starts at your amount
F.learnFix("Koshari", F.food("koshari"), 450 / 350);
const bank = { auto: 0.6, items: [["id", "koshari", "Koshari", "كشري", "eg"]].map(([kind, id, en, ar, cc]) => ({ kind, id, en, ar, cc })) };
const d = C.decide(bank, [{ i: 0, p: 0.9 }]);
ok(Math.abs(d.items[0].grams - 450) <= 5 && d.items[0].k === 1 && d.items[0].learned && d.items[0].learnedN === 1, "the fast path uses your usual amount for the dish (350 → 450 g)");
// v6.18 measured fixes: nuts are a pinch/spoon/handful (not ¼ plate = 532 kcal of pistachios), oil starts at a teaspoon,
// cream reaches cups, a big piece can be half or one and a half
const pis = A.amountQuestion(item("pistachio"));
ok(pis && pis.kind === "sprinkle" && pis.choices.map((c) => c.grams).join() === "5,10,20,30,60", "pistachios: a pinch … 2 handfuls (5–60 g)");
const oil = A.amountQuestion(item("olive-oil"));
ok(oil && oil.kind === "spoon" && oil.choices[0].en === "1 tsp" && oil.choices[0].grams <= 5, "olive oil: starts at a teaspoon");
const cream = A.amountQuestion(item("heavy-cream"));
ok(cream && cream.choices.some((c) => c.en === "1 cup" && c.grams === 240), "heavy cream: up to a cup (240 g)");
const ch = A.amountQuestion(item("chicken-breast"));
ok(ch && ch.choices.map((c) => c.en).join() === "½,1,1½,2,3,4", "chicken breast: ½ 1 1½ 2 3 4 pieces");
