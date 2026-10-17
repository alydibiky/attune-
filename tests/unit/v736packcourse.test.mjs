// v6.32 knowledge packs → courses: the books, the plan, a lesson from the book's own words, definitions → cards.
import * as K from "../../web-src/packcourse.js";
import * as D from "../../web-src/daily.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const toc = [{ title: "Principles of Economics 3e — Preface", n: 3 }, { title: "Principles of Economics 3e — What Is Economics?", n: 4 },
  { title: "Principles of Economics 3e — Demand, Supply, and Equilibrium", n: 6 }, { title: "Principles of Economics 3e — Inflation", n: 5 },
  { title: "Principles of Economics 3e — Key Terms", n: 2 }, { title: "Microeconomics 3e — Scarcity", n: 2 }, { title: "Microeconomics 3e — Markets", n: 3 }, { title: "Lonely", n: 1 }];
const bs = K.booksOf(toc);
ok(bs.length === 2 && bs[0].book === "Principles of Economics 3e" && bs[0].sections.length === 3, "two books; the preface and key terms are not lessons (" + bs.map((b) => b.book + ":" + b.sections.length) + ")");
const c = K.courseFromBook({ id: "economics", name: "Economics" }, bs[0], { lang: "en" });
ok(c.plan.join("|") === "What Is Economics?|Demand, Supply, and Equilibrium|Inflation" && c.pack.titles[2] === "Principles of Economics 3e — Inflation", "the course plan is the book's sections in order");
const passages = [
  { text: "Inflation is a general and ongoing rise in the level of prices in an entire economy. Access for free at openstax.org", url: "https://openstax.org/books/principles-economics-3e/pages/9-1" },
  { text: "Figure 9.2 Prices over time. The consumer price index is a measure of the average change over time in prices paid by households. It is widely used.", url: "" },
  { text: "Example: In 2020 a basket cost 100 and in 2021 it cost 105, so inflation was 5%.", url: "" },
  { text: "This is why economists track prices.", url: "" }];
const l = K.lessonFromPassages(c, 2, passages);
ok(!/Access for free|Figure 9/.test(l.body) && /general and ongoing rise/.test(l.body) && /\*\*Example: In 2020/.test(l.body), "the book's words, tidied, with the example (" + l.body.slice(0, 60) + "…)");
ok(l.keyPoints[0] === "Inflation: a general and ongoing rise in the level of prices in an entire economy" && l.keyPoints.some((k) => k.startsWith("Consumer price index:")) && !l.keyPoints.some((k) => k.startsWith("Inflation is")), "definitions → key points (" + JSON.stringify(l.keyPoints) + ")");
ok(l.source.url.includes("openstax.org") && l.source.title.endsWith("Inflation"), "the source stays with the lesson");
const c2 = D.addLesson(c, 2, l), cards = D.cardsFromLesson(c2.lessons[0]);
ok(cards.length >= 2 && cards[0].front === "Inflation", "the definitions become review cards (" + cards.map((x) => x.front) + ")");
ok(!K.definitionsIn("This is a test of things. It is fine to go.").length, "«This is…» / «It is…» are not definitions");
const m = K.packLessonMessages({ ...c, lang: "ar" }, 2, passages);
ok(/ONLY facts in the text/.test(m[0].content) && /Arabic/.test(m[0].content) && /general and ongoing rise/.test(m[1].content), "with a model: rewritten from that text only");
const qz = K.codeQuiz([{ keyPoints: ["Inflation: a general rise in prices", "Deflation: a general fall in prices"] }, { keyPoints: ["Scarcity: wants are more than resources", "Opportunity cost: the next best thing given up", "Not a definition"] }]);
ok(qz.length === 4 && qz.every((q) => q.options.length >= 3 && new Set(q.options).size === q.options.length && q.options[q.answer] && q.why.startsWith(q.options[q.answer])), "no model: a quiz from the definitions (" + qz.map((q) => q.options[q.answer]) + ")");
ok(new Set(qz.map((q) => q.answer)).size > 1, "the right answer is not always in the same place");
ok(K.codeQuiz([{ keyPoints: ["A: one two three four five", "B: one two three four five"] }]).length === 0, "too few terms → no code quiz");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
