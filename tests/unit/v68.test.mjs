// v6.8 — what the real-model trials (tests/trials) found wrong, kept fixed. Each case is a real answer
// shape a 4B model gave: a stray backtick after the lesson's JSON, key points left out, a promise to pay
// counted as money received, the same transfer counted twice, a booking reply the filter skipped,
// a slide outline sent back as JSON.
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => delete mem[k] };
const D = await import("../../web-src/daily.js");
const X = await import("../../web-src/chatxray.js");
const S = await import("../../web-src/slides.js");
const A = await import("../../web-src/actions.js");
const PL = await import("../../web-src/places.js");
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

// the model reversed the bill («حسابه 18000» written by Ali → "Ali owes Hassan") and skipped «حولتلك 10000»
const rev = X.addMissedPayments(X.parseItems(JSON.stringify({ items: [{ type: "owes", msg: 0, from: "Ali", to: "Hassan", amount: 18000 }, { type: "promise", msg: 1, from: "Hassan", to: "Ali", amount: 10000 }] }), by, ex.people), ex.messages, ex.people);
ok(X.ledgerOf(rev, "Ali")[0].net === 8000 && rev.some((x) => x.byCode && x.msg === 2), "x-ray: a reversed bill is turned round; a skipped transfer is added by code");
ok(X.addMissedPayments([], X.parseExport("12/09/2026, 10:05 - Hassan: هحولك 10000 بكرة\n12/09/2026, 10:06 - Ali: تمام").messages, ["Hassan", "Ali"]).length === 0, "x-ray: a promise to transfer is never added as paid");
l = D.parseLesson(`# H\n\n## A\nx.\n\n${fence}json\n{"visual": {"kind": "steps", "items": ["a", "b"]}}, "keyPoints": ["k1", "k2"]}\n${fence}`);
ok(l.visual && l.visual.kind === "steps" && l.keyPoints.join() === "k1,k2", "lesson: a closing brace too many is repaired");

// Instant actions: «فكرني … اكلم» is a reminder even when the model says "call"
const now = new Date("2026-09-28T10:00:00").getTime();
const act = A.buildAction({ action: "call", title: "اتصال بالمهندس حسن", time_text: "بكرة الساعة 9", contact: "المهندس حسن" }, "فكرني بكرة الساعة 9 الصبح اكلم المهندس حسن", now);
ok(act.kind === "reminder" && new Date(act.at).getHours() === 9, "action: «فكرني … اكلم» is a reminder at 9:00");
ok(A.buildAction({ action: "call", contact: "Hassan" }, "call Hassan", now).kind === "call", "action: a plain «call Hassan» stays a call");

// the every-model trials (Spark 0.8B): a message number that isn't in the chat; a booking it missed
const spark = X.addMissedPayments(X.parseItems('{"items":[{"type":"owes","msg":12,"from":"Ali","to":"Hassan","amount":18000,"currency":"EGP","what":"حسابه 18000"}]}', by, ex.people), ex.messages, ex.people);
ok(X.ledgerOf(spark, "Ali")[0].net === 8000, "x-ray: a wrong message number is found by its amount → Hassan owes 8,000");
ok(spark.some((x) => x.type === "order" && x.byCode && /الخميس/.test(x.quote)), "x-ray: a booking asked and answered «تمام» is kept by code");
const AF = await import("../../web-src/answerfix.js");
ok(AF.wrongLanguage("يا باشمهندس، محتاجين الونش ال100 طن يوم السبت", "- You need a price for 100 tons of goods on Saturday morning.") === "ar", "language: an Arabic message answered in English → ask again in Arabic");
ok(AF.wrongLanguage("ترجم ده للانجليزي: ازيك يا صاحبي", "How are you, my friend? I hope you are doing well today.") === null, "language: English that was asked for is fine");
ok(AF.wrongLanguage("يا باشمهندس، محتاجين الونش", "تمام، هبعتلك السعر النهارده") === null, "language: Arabic → Arabic is fine");

// Glow (2B): a course plan cut off mid-loop; «فاضل 8000» read as a payment
const loop = '{\n "title": "هيدروليك الأوناش",\n "lessons": [\n "مفهوم الضغط", "الصمامات", "المضخة", "الأسطوانة", "الخزان", "الفلاتر", "تصميم الأحمال", "تصميم الأحمال", "تصميم الأحمال", "تصميم ال';
const pl = D.parsePlan(loop);
ok(pl && pl.plan.length === 7 && pl.title === "هيدروليك الأوناش", "learn: a plan cut off by a loop keeps its titles, repeats dropped");
const glow = X.parseItems(JSON.stringify({ items: [{ type: "owes", msg: 0, from: "Hassan", to: "Ali", amount: 18000 }, { type: "paid", msg: 2, from: "Hassan", to: "Ali", amount: 10000 }, { type: "paid", msg: 3, from: "Ali", to: "Hassan", amount: 8000 }] }), by, ex.people);
ok(X.ledgerOf(glow, "Ali")[0].net === 8000, "x-ray: «وصلت شكرا، فاضل 8000» is a balance, not a payment → Hassan owes 8,000");

// Maps: a place name with «و» inside a word, and "where can I park"
ok(PL.placeFor("انا في كمبوند ايمرالد بارك وعايز أفول بنزين اعمل ايه").near === "كمبوند ايمرالد بارك", "maps: «كمبوند» is not cut at its «و»");
ok(PL.placeFor("انا في مدينتي و عايز صيدلية").near === "مدينتي", "maps: «و» as its own word still ends the place");
ok((PL.placeFor("where can i park near Tahrir square") || {}).query === "parking near Tahrir square", "maps: «where can I park near …» → parking");

// Slides
const ol = S.parseOutline(JSON.stringify({ title: "Crane safety", slides: [{ title: "Why it matters", kind: "quote" }, { title: "Before the lift" }, "Signals", { title: "Wind limits" }, { title: "Checklist" }] }), 5, { topic: "Crane safety" });
const sl = ol && (ol.slides || ol);
ok(sl && sl.length === 5, "slides: an outline sent back as JSON is read");

console.log(fail ? `\n${fail} FAILED` : "\nALL PASSED");
if (fail) process.exit(1);
