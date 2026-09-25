// Unit tests for web-src/daily.js — daily lessons, quizzes, news digests.
import * as D from "../../web-src/daily.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

const now = new Date(2026, 8, 25, 7, 0).getTime();
eq(new Date(D.nextAt("08:00", now)).getHours(), 8, "the lesson rings at 8:00 today when it's 7:00");
eq(D.dayKey(D.nextAt("06:30", now)), D.dayKey(now + 86400000), "…and tomorrow when the time has passed");

let c = D.newCourse({ topic: "Turkish", level: "beginner", quizEvery: 3 });
const plan = D.parsePlan('```json\n{"title":"Turkish from zero","lessons":["Alphabet & sounds","Merhaba: greetings","Vowel harmony","Numbers 1–10","Olmak: to be","Past tense -di"]}\n```');
eq([plan.title, plan.plan.length, plan.plan[2]], ["Turkish from zero", 6, "Vowel harmony"], "the course plan is read from JSON");
eq(D.parsePlan("1. Alphabet\n2. Greetings\n3. Vowel harmony\n4. Numbers\n5. To be").plan.length, 5, "…or from a numbered list");
c = { ...c, plan: plan.plan };
eq(D.lessonMessages(c, 2)[1].content.includes("Already covered: Alphabet & sounds; Merhaba: greetings"), true, "a lesson knows what was already taught");

const LESSON = `Turkish sounds change to *match* each other.

## The rule
Suffixes follow the last vowel of the word: **ev → evler**, **kitap → kitaplar**.

## Try it
Make the plural of *göz*.

\`\`\`json
{"visual": {"kind": "table", "title": "Plural", "columns": ["Word", "Plural", "Meaning"], "rows": [["ev", "evler", "houses"], ["kitap", "kitaplar", "books"]]},
 "keyPoints": ["Front vowels (e, i, ö, ü) take -ler", "Back vowels (a, ı, o, u) take -lar", "Look at the LAST vowel"]}
\`\`\``;
const p = D.parseLesson(LESSON);
eq([p.visual.kind, p.visual.rows[1][1], p.keyPoints.length, p.body.endsWith("*göz*.")], ["table", "kitaplar", 3, true], "a lesson: text, a table visual and 3 key points");
eq(D.normVisual({ kind: "cards", items: [{ term: "ev", meaning: "house", example: "Bu benim evim." }] }).items[0], { front: "ev", back: "house", note: "Bu benim evim." }, "word cards");
eq(D.normVisual({ kind: "steps", items: ["pump"] }), null, "a visual with too little in it is dropped");
eq(D.parseLesson("## Hello\ntext\n## Key points\n- one\n- two").keyPoints, ["one", "two"], "key points from the text when there's no JSON");

c = D.addLesson(c, 0, p, { now });
eq(D.todaysLesson(c, now).n, 0, "today's lesson is the first not read");
c = D.openLesson(c, 0, now);
c = D.markDone(c, 0, now);
eq([c.streak, D.todaysLesson(c, now).n], [1, 0], "read today: streak 1, and today's lesson stays on screen");
for (const [i, dayOff] of [[1, 1], [2, 2]]) { c = D.addLesson(c, i, p, { now }); c = D.markDone(c, i, now + dayOff * 86400000); }
eq(c.streak, 3, "three days in a row = streak 3");
eq(D.quizDue(c).map((l) => l.n), [0, 1, 2], "after 3 lessons a quiz is due");
eq(D.lessonNotice(c).body.includes("quiz"), true, "…and the notification says so");

const Q = JSON.stringify({ questions: [
  { q: "Plural of ev?", options: ["evler", "evlar", "evleri", "evlerı"], answer: 0, why: "e is a front vowel" },
  { q: "Plural of kitap?", options: ["kitapler", "kitaplar", "kitaplır", "kitaplr"], answer: "B", why: "a is back" },
  { q: "broken", options: ["a", "a", "b", "c"], answer: 0 },
  { q: "no answer", options: ["a", "b", "c", "d"], answer: 9 } ] });
const qs = D.parseQuiz(Q, "seed1");
eq(qs.length, 2, "invalid questions (duplicate options, answer out of range) are dropped");
eq([qs[0].options[qs[0].answer], qs[1].options[qs[1].answer]], ["evler", "kitaplar"], "options are shuffled and the answer still points at the right one");
eq(D.parseQuiz(Q, "seed1")[0].options, qs[0].options, "…the same way every time (seeded)");
const quiz = { lessons: [0, 1, 2], questions: qs };
const f = D.finishQuiz(c, quiz, [qs[0].answer, (qs[1].answer + 1) % 4]);
eq([f.right, f.course.review[0]], [1, "Plural of kitap? → kitaplar"], "a wrong answer goes into the review list…");
eq(D.lessonMessages({ ...f.course, plan: plan.plan }, 3)[0].content.includes("Quick review\" of: Plural of kitap? → kitaplar"), true, "…and comes back in the next lesson");
eq(D.quizDue(f.course), null, "no quiz due right after one");

// news
const t = D.newTopic({ query: "Al Ahly" });
const H = 3600000;
const items = [
  { title: "Al Ahly beat Zamalek 2-1 in Cairo derby - KingFut", url: "u1", source: "KingFut", date: now - 2 * H, text: "Al Ahly won 2-1." },
  { title: "Al Ahly beat Zamalek 2-1 in the Cairo derby - Ahram Online", url: "u2", source: "Ahram Online", date: now - 3 * H },
  { title: "Ahly sign Moroccan striker - Kooora", url: "u3", source: "Kooora", date: now - 5 * H },
  { title: "Old story about Ahly - X", url: "u4", source: "X", date: now - 72 * H },
  { title: "Ahly coach on the title race", url: "u5", source: "Y", date: now - 6 * H } ];
const m = D.mergeNews(items, ["u5"], { now });
eq(m.map((x) => x.url), ["u1", "u3"], "news: newest first, the same story from two sites kept once, old and already-seen dropped");
const ck = D.checkCitations("**Ahly win the derby**\n- Ahly beat Zamalek 2-1 [1]\n- New striker signed [2][7]\n- Title race is close", 2);
eq([ck.removed, ck.unsourced, ck.text.includes("[7]")], [1, 1, false], "citations to sources that don't exist are removed; unsourced lines are counted");
eq(D.digestMessages(t, m, { now })[0].content.includes("never add facts from memory"), true, "the digest may only use the articles");
const t2 = D.addDigest(t, { day: D.dayKey(), text: "**Ahly win the derby 2-1**\n- ...", items: m });
eq(D.newsNotice(t2).body, "Ahly win the derby 2-1", "the notification shows today's headline");

console.log(fails.length ? fails.length + " FAILED" : "ALL PASSED");
process.exit(fails.length ? 1 : 0);
