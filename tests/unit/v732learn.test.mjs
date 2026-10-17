// v6.28 Learn daily: the review deck made by code, the streak as it stands today, today's plan, and the quiz check.
import * as D from "../../web-src/daily.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const DAY = 86400000, T0 = new Date(2026, 9, 15, 9, 0).getTime();

const L1 = { n: 0, title: "Alphabet & sounds", body: "## Letters\nç sounds like ch.", keyPoints: ["ş: sh as in shoe", "Turkish is written as it sounds"],
  visual: { kind: "cards", title: "Letters", items: [{ front: "ç", back: "ch as in chair", note: "çay — tea" }, { front: "ğ", back: "lengthens the vowel before it", note: "" }] } };
const cards = D.cardsFromLesson(L1);
ok(cards.length === 3 && cards[0].front === "ç" && cards[2].front === "ş" && cards[2].back === "sh as in shoe", "a lesson → cards from its word cards and its 'term: meaning' key points (" + cards.length + ")");
ok(!cards.some((k) => /written as it sounds/.test(k.front + k.back)), "a key point that is not 'term: meaning' is not turned into a made-up card");
const T = D.cardsFromLesson({ title: "Vowels", visual: { kind: "table", columns: ["Last vowel", "Plural"], rows: [["e, i, ö, ü", "-ler"], ["a, ı, o, u", "-lar"]] } });
ok(T.length === 2 && T[1].front === "a, ı, o, u" && T[1].back === "-lar", "a table → one card per row");

let c = D.readyCourse("turkish", { time: "08:00" });
c = D.addLesson(c, 0, { body: L1.body, visual: L1.visual, keyPoints: L1.keyPoints }, { now: T0 });
c = D.markDone(c, 0, T0);
ok(c.cards.length === 3 && c.cards.every((k) => k.due === T0 + DAY), "reading the lesson puts its 3 cards in the deck, first review tomorrow");
ok(D.cardsDue(c, T0).length === 0 && D.cardsDue(c, T0 + DAY).length === 3, "nothing to review today; 3 tomorrow");
ok(D.markDone(c, 0, T0 + 1000).cards.length === 3, "marking it read again adds nothing twice");
let k = c.cards[0].id;
let c2 = D.gradeCard(c, k, true, T0 + DAY);
const k2 = c2.cards.find((x) => x.id === k);
ok(k2.due >= T0 + DAY + 2 * DAY && k2.s > 0 && k2.d >= 1, "knew it → back in a few days (v6.32 FSRS: " + Math.round((k2.due - T0 - DAY) / DAY) + " days)");
let c3 = c2, tt = T0 + DAY; for (let i = 0; i < 8 && c3.cards.some((x) => x.id === k); i++) { tt = c3.cards.find((x) => x.id === k).due; c3 = D.gradeCard(c3, k, true, tt); }
ok(!c3.cards.some((x) => x.id === k) && c3.learnedCards === 1, "known every time on its day → learned for good, out of the deck");
let c4 = D.gradeCard(c2, k, false, T0 + 3 * DAY);
ok(c4.cards.find((x) => x.id === k).due === T0 + 4 * DAY && c4.cards.find((x) => x.id === k).lapses === 1, "didn't know it → tomorrow again");

ok(D.streakNow({ streak: 12, lastDay: D.dayKey(T0 - 3 * DAY) }, T0) === 0, "a 12-day streak with 2 days missed shows 0, not 12");
ok(D.streakNow({ streak: 4, lastDay: D.dayKey(T0 - DAY) }, T0) === 4, "read yesterday → the streak still stands today");

let p = D.todayPlan(c, T0 + DAY);
ok(p.steps[0].kind === "review" && p.steps[0].n === 3 && p.steps[1].kind === "lesson" && p.steps[1].needsWriting && p.steps[1].n === 1, "today's plan: review 3 cards, then lesson 2 (to be written)");

const quiz = { lessons: [0, 1, 2], questions: [{ q: "Plural of kitap?", options: ["kitaplar", "kitapler"], answer: 0 }, { q: "Sound of ç?", options: ["ch as in chair", "s as in sun"], answer: 0 }] };
const f = D.finishQuiz(c, quiz, { 0: 1, 1: 0 }, { now: T0 + 2 * DAY });
ok(f.course.cards.some((x) => x.front === "Plural of kitap?" && x.back === "kitaplar" && x.due === T0 + 2 * DAY), "a missed quiz question becomes a card, reviewed first");

const lessons = [{ title: "Vowel harmony", body: "After a, ı, o, u the plural is -lar: kitaplar, arabalar.", keyPoints: ["Back vowels take -lar"] }];
const qs = [
  { q: "Plural of kitap?", options: ["kitapler", "kitaplar", "kitapı"], answer: 0 },       // mis-marked: the lesson backs «kitaplar»
  { q: "Plural of araba?", options: ["arabalar", "arabaler", "arabalır"], answer: 0 },
  { q: "Which suffix?", options: ["-lar", "-Lar ", "-ler"], answer: 0 },                   // two options the same
];
const g = D.groundQuiz(qs, lessons);
ok(g.length === 1 && g[0].q === "Plural of araba?", "the quiz check drops a mis-marked question and a doubled option, keeps the good one");
ok(D.groundQuiz([{ q: "Best practice?", options: ["Check the oil daily", "Never check"], answer: 0 }], [{ title: "x", body: "Hoses and seals." }]).length === 1, "a question the lessons don't speak to is kept (no evidence either way)");
const n = D.lessonNotice(D.addCards(D.readyCourse("turkish"), [{ front: "a", back: "b" }], 0, { now: Date.now() - 2 * DAY, due: Date.now() - DAY }));
ok(/1 card to review/.test(n.body), "the morning notification says how many cards wait: " + n.body);
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
