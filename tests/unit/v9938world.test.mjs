// v9.9.38 — the 1,000,000-case test, part A, fixes: the six everyday orders in all 20 languages (worldlang.js), names in any script,
// "X always comes first" for anyone (and it is used), "what are my subscriptions?", stories around a payment, "heads up at 7:30",
// "don't let me forget to…", "what's my taxis total", "where did my money go". Each was a failure class of the 1M run.
import { execFileSync } from "child_process";
const { worldToEnglish } = await import("../../web-src/worldlang.js");
const { readable } = await import("../../web-src/wrapclean.js");
const { classify } = await import("../scenarios/brain.mjs");
const { parseLife } = await import("../../web-src/life.js");
const { understand } = await import("../../web-src/doit.js");
const { askLife } = await import("../../web-src/lifeask.js");
const { readTeach, firstNames } = await import("../../web-src/noteteach.js");
const { dayFromNotes, isFirst } = await import("../../web-src/daynotes.js");
let fail = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
const NOW = Date.parse("2026-11-10T12:00:00");

// 1) the six orders, direction and amount (a debt the wrong way round is the worst mistake)
const W = [
  ["Иван должен мне 900", "Иван owes me 900"], ["я должен Ивану 900", "I owe Ивану 900"], ["小王欠我3000", "小王 owes me 3000"], ["我欠小王3000", "I owe 小王 3000"],
  ["민수가 나한테 400 빚졌어", "민수 owes me 400"], ["민수한테 400 빌렸어", "I owe 민수 400"], ["田中さんに500借りてる", "I owe 田中さん 500"], ["田中さんが私に500借りてる", "田中さん owes me 500"],
  ["namdai Juma 500", "Juma owes me 500"], ["Juma ananidai 500", "I owe Juma 500"], ["Ayşe bana 250 borçlu", "Ayşe owes me 250"], ["Mehmet'e 250 borcum var", "I owe Mehmet 250"],
  ["le debo 250 a Ahmed", "I owe Ahmed 250"], ["Pedro me emprestou 7500", "I owe Pedro 7500"], ["Felix hat mir 250 geliehen", "I owe Felix 250"], ["Omar mi ha prestato 2500", "I owe Omar 2500"],
  ["Lina m'a emprunté 300", "Lina owes me 300"], ["Carmen todavía me debe 1800", "Carmen owes me 1800"], ["à, Thảo còn nợ tôi 750", "Thảo owes me 750"], ["我还欠刘洋45000", "I owe 刘洋 45000"],
];
for (const [s, want] of W) ok(worldToEnglish(s) === want, `«${s}» → ${want} (got ${worldToEnglish(s)})`);
for (const [s, dir, amt] of [["Иван должен мне 900", "in", 900], ["я занял 900 у Марии", "out", 900], ["Juma ananidai 500", "out", 500], ["namdai Juma 500", "in", 500], ["小王欠我3000", "in", 3000]]) {
  const c = parseLife(readable(s), { now: NOW }); ok(c && c.dir === dir && c.amount === amt, `«${s}» saved as ${dir} ${amt} (got ${c && c.dir} ${c && c.amount})`); }
for (const [s, k] of [["gasté 50 en el almuerzo", "money"], ["점심에 1,500원 썼어", "money"], ["明天9点提醒我给萨拉打电话", "reminder"], ["फ़ोन: कल 9 बजे मुझे याद दिलाना सारा को फ़ोन करना", "reminder"],
  ["leo nimetumia 250 kwa chakula", "money"], ["เอ่อ วันนี้จ่ายค่าทำเล็บ 750 บาท", "money"], ["¿cuánto gasté este mes?", "money-ask"], ["dropped 180 on the pool", "money"]])
  ok(classify(s, { now: NOW, both: true }).k === k || (k === "money-ask" && /^ask:/.test(classify(s, { now: NOW, both: true }).k)), `«${s}» → ${k} (got ${classify(s, { now: NOW, both: true }).k})`);
// never steals what other readers do better, and leaves plain English / chat alone
for (const s of ["what is the capital of Japan?", "remind me tomorrow at 9 to call Sara", "فكرني بكرة الساعة 9 اكلم سارة", "fakarny bokra el sa3a 8 bel leil akalem Laila", "عايز اشتري ايفون ب 30000", "so what"])
  ok(worldToEnglish(s) === s || /^fakarny /.test(worldToEnglish(s)), `left alone: «${s}» (got ${worldToEnglish(s)})`);
ok(worldToEnglish("3ayez tazkeer bokra el sa3a 8 ab3at el report") === "fakarny bokra el sa3a 8 ab3at el report", "Franco «3ayez tazkeer» → fakarny (the Franco readers keep bel leil / ba3d bokra)");
ok(worldToEnglish("لو جالاكسي S25 نزل عن 42000 قولي") === "قولي لما جالاكسي S25 يبقى اقل من 42000", "Egyptian «لو X نزل عن N قولي» → the watch sentence the Arabic readers know");

// 2) names in any script in an English debt
for (const s of ["Иван owes me 900", "I owe 小王 3500", "I lent 민수 400", "I borrowed 900 from Мария", "田中さん owes me 600"]) ok(classify(s, { now: NOW, both: true }).k === "life", `«${s}» is a debt`);

// 3) "X always comes first" for someone not saved yet — and the rule is USED (it was saved but never applied)
const r = readTeach("Sara always comes first", { items: [] }); ok(r && r.kind === "rule" && r.rule.kind === "first" && r.rule.who === "Sara", "«Sara always comes first» → a rule for Sara");
ok(!(readTeach("family always comes first", { items: [] }) || {}).rule, "«family always comes first» is a saying, not a rule");
ok(firstNames({ rules: [{ kind: "first", who: "Sara" }, { kind: "hide", app: "x" }] }).join() === "Sara", "firstNames lists the people told to come first");
ok(isFirst("Sara Ali", ["Sara"]) && !isFirst("Sarah", ["Sara"]) && !isFirst("Ahmed", ["Sara"]), "isFirst matches the first name, not a look-alike");
{ const t0 = new Date(NOW).setHours(9, 0, 0, 0);
  const notes = [{ id: 1, pkg: "com.whatsapp", app: "WhatsApp", title: "Ahmed", text: "hi", ts: t0 + 36e5 }, { id: 2, pkg: "com.whatsapp", app: "WhatsApp", title: "Sara", text: "call me", ts: t0 }];
  const d0 = dayFromNotes(notes, { now: NOW }), d1 = dayFromNotes(notes, { now: NOW, first: ["Sara"] });
  ok(d0.people[0] && d1.people[0] && (d0.people[0].who !== "Sara" || d0.people.length < 2) && d1.people[0].who === "Sara" && d1.people[0].first === true, `Sara comes first on Home's "who messaged you" (${d0.people.map((p) => p.who)} → ${d1.people.map((p) => p.who)})`); }

// 4) subscriptions
{ const a = askLife("what are my subscriptions?", { life: { items: [{ kind: "subscription", title: "Netflix", amount: 200, every: "month", currency: "EGP" }, { kind: "subscription", title: "Gym", amount: 6000, every: "year", currency: "EGP" }] } }, { now: NOW });
  ok(a && a.kind === "subs" && /2 subscriptions · about 700 EGP a month/.test(a.en) && /اشتراكين/.test(a.ar), "«what are my subscriptions?» → 2, about 700 a month (" + (a && a.en) + ")"); }
ok(classify("cancel my Netflix subscription", { now: NOW, both: true }).k !== "ask:subs", "«cancel my Netflix subscription» is not the question");

// 5) a story around a payment; non-money numbers are not saved
const money = (s) => { const u = understand(s, { now: NOW, stores: {} }); return ((u.actions || []).find((a) => a.kind === "money") || { items: [] }).items.map((x) => x.amount).join("+"); };
for (const [s, want] of [["long day, 7 meetings, then a birthday cake for 780 at Starbucks", "780"], ["pizza for 175, invoice 4999", "175"], ["after the 4-hour meeting in room 602 I grabbed breakfast for 1750", "1750"],
  ["long day, 9 meetings, then tolls for 1100 at Spinneys", "1100"], ["بعد اجتماع 5 ساعات في اوضة 424 اشتريت الجيم ب45", "45"]]) ok(money(s) === want, `«${s}» → ${want} (got ${money(s) || "nothing"})`);
ok(money("I ran 5 km") === "" && money("page 120 of the book is missing") === "", "a distance / a page is still not money");

// 6) wording fixes
ok(readable("heads up at 7:30 am tomorrow: feed the cat") === "remind me at 7:30 am tomorrow to feed the cat", "«heads up at 7:30 am …» keeps its minutes");
ok(classify("paid 150 for a haircut and don't let me forget to call the bank in 2 hours", { now: NOW, both: true }).k === "both", "«… and don't let me forget to …» does both");
ok(classify("what's my taxis total since the 1st?", { now: NOW, both: true }).k === "money-ask", "«what's my taxis total since the 1st?» is a money question");
ok(classify("my food total is 900", { now: NOW, both: true }).k !== "money-ask", "«my food total is 900» is not a question");
ok(classify("where did my money go this week?", { now: NOW, both: true }).k === "money-ask", "«where did my money go this week?» is about spending (not where a thing is kept)");
ok(classify("where is my passport?", { now: NOW, both: true }).k === "where", "«where is my passport?» still asks where a thing is");

// 7) the 2,500 samples: the phrasings the reader was written for, and the held-out phrasings
const run = (env) => { const o = execFileSync("node", [new URL("../onemillion/langs.mjs", import.meta.url).pathname, "2500"], { env: { ...process.env, ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 26 });
  const m = /\((\d+\.\d+)%\)/.exec(o.split("\n")[0]); return m ? +m[1] : 0; };
const a = run({}), h = run({ HELDOUT: "1" });
ok(a >= 99, `20 languages + Franco, 2,500 sample: ${a}% (the mark: 99%)`);
ok(h >= 97, `held-out phrasings, 2,500 sample: ${h}% (the mark: 97%)`);
console.log(fail ? `FAIL ${fail}` : "ALL PASSED");
process.exit(fail ? 1 : 0);
