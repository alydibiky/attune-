// v6.8 — what the real-model trials (tests/trials) found wrong, kept fixed. Each case is a real answer
// shape a 4B model gave: a stray backtick after the lesson's JSON, key points left out, a promise to pay
// counted as money received, the same transfer counted twice, a booking reply the filter skipped,
// a slide outline sent back as JSON.
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => delete mem[k] };
const D = await import("../../web-src/daily.js");
const X = await import("../../web-src/chatxray.js");
const S = await import("../../web-src/slides.js");
let fail = 0;
const ok = (c, what) => { console.log((c ? "PASS " : "FAIL ") + what); if (!c) fail++; };

// Learn daily
const fence = "```";
let l = D.parseLesson(`# Hook\n\n## Idea\nFluid carries force.\n\n## Try it\nDo it.\n\n${fence}json\n{"visual": {"kind": "steps", "title": "Path", "items": ["pump", "valve", "cylinder"]}, "keyPoints": ["a", "b", "c"]}\`\n${fence}`);
ok(l.keyPoints.length === 3 && l.visual && l.visual.kind === "steps" && !l.body.includes("keyPoints"), "lesson: JSON after a stray backtick is still read");
l = D.parseLesson(`# Hook\n\n## Idea\nx\n\n${fence}json\n{"visual": {"kind": "cards", "items": [{"front": "Pump", "back": "moves the oil"}, {"front": "Tank", "back": "stores it"}]}}\n${fence}`);
ok(l.keyPoints.length === 2 && l.keyPoints[0] === "Pump: moves the oil", "lesson: no key points → taken from the cards");
l = D.parseLesson("# Hook\n\n## What it is\nHydraulics moves force with oil. More here.\n\n## Try it\nPress.");
ok(l.keyPoints.length === 1 && /^Hydraulics moves force with oil\.$/.test(l.keyPoints[0]), "lesson: no JSON at all → first sentence of each section");
ok(!D.isLanguageCourse("هيدروليك الأوناش المتحركة") && !D.isLanguageCourse("Hydraulics of mobile cranes") && D.isLanguageCourse("Turkish for beginners") && D.isLanguageCourse("اللغة التركية"), "lesson: only language courses get translation lines");
const c = { ...D.newCourse({ topic: "Hydraulics of mobile cranes", lang: "en" }), plan: ["What is hydraulics"] };
ok(!/pronunciation/.test(D.lessonMessages(c, 0)[0].content) && /technically correct/.test(D.lessonMessages(c, 0)[0].content), "lesson prompt: no pronunciation for a crane course; accuracy rule");

// Chat X-Ray
const chat = `12/09/2026, 10:02 - Ali: يا حسن الونش بتاع امبارح حسابه 18000 جنيه
12/09/2026, 10:05 - Hassan: تمام يا علي هحولك 10000 النهارده والباقي آخر الشهر
13/09/2026, 18:40 - Hassan: حولتلك 10000 على انستاباي
14/09/2026, 09:12 - Ali: وصلت شكرا، فاضل 8000
20/09/2026, 11:30 - Hassan: ممكن الونش 50 طن يوم الخميس؟
20/09/2026, 11:31 - Ali: تمام الخميس 7 الصبح`;
const ex = X.parseExport(chat);
const cand = X.candidates(ex.messages).map((m) => m.text);
ok(cand.includes("تمام الخميس 7 الصبح"), "x-ray: the answer to a question (a booking) is read");
const by = new Map(ex.messages.map((m) => [m.i, m]));
const items = X.parseItems(JSON.stringify({ items: [{ type: "owes", msg: 0, from: "Hassan", to: "Ali", amount: 18000 }, { type: "paid", msg: 1, from: "Hassan", to: "Ali", amount: 10000 }, { type: "paid", msg: 2, from: "Hassan", to: "Ali", amount: 10000 }, { type: "paid", msg: 3, from: "Hassan", to: "Ali", amount: 10000 }] }), by, ex.people);
ok(items[1].type === "promise", "x-ray: «هحولك 10000» is a promise, not money received");
const led = X.ledgerOf(items, "Ali");
ok(led.length === 1 && led[0].person === "Hassan" && led[0].net === 8000, "x-ray: Hassan still owes 8,000 (not −20,000)");
const twice = X.parseItems(JSON.stringify({ items: [{ type: "owes", msg: 0, from: "Hassan", to: "Ali", amount: 18000 }, { type: "paid", msg: 2, from: "Hassan", to: "Ali", amount: 10000 }, { type: "paid", msg: 2, from: "Hassan", to: "Ali", amount: 10000 }] }), by, ex.people);
ok(X.ledgerOf(twice, "Ali")[0].net === 8000, "x-ray: the same transfer listed twice counts once");
ok(/ونش = crane/.test(X.extractMessages("x", "Ali", ex.people)[0].content), "x-ray prompt: Egyptian money words explained");

// Slides
const ol = S.parseOutline(JSON.stringify({ title: "Crane safety", slides: [{ title: "Why it matters", kind: "quote" }, { title: "Before the lift" }, "Signals", { title: "Wind limits" }, { title: "Checklist" }] }), 5, { topic: "Crane safety" });
const sl = ol && (ol.slides || ol);
ok(sl && sl.length === 5, "slides: an outline sent back as JSON is read");

console.log(fail ? `\n${fail} FAILED` : "\nALL PASSED");
if (fail) process.exit(1);
