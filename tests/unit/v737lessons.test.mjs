// v6.34 — Ali: "make the lessons very good coding so the models don't glitch". The lesson pipeline (daily.js writeLesson) gets the
// ways small models really fail, and every lesson that comes out is clean: no loop, no stray JSON or LaTeX, no "Sure, here is…",
// in the course's language, with sections, a diagram, flashcards, key points and a "Try it".
import assert from "node:assert/strict";
import * as D from "../../web-src/daily.js";
const course = { ...D.newCourse({ topic: "Turkish", lang: "en" }), plan: ["Numbers 1 to 10", "Greetings"] };
const GOOD = "## Counting\nBir, iki, üç, dört, beş — one to five. Say them slowly, each with its own vowel.\n\n## Using them\nİki çay lütfen means two teas please. The number comes before the noun and the noun stays singular, so it is iki çay, never iki çaylar. Numbers above ten join like this: on bir is eleven, yirmi iki is twenty-two.\n\n## Try it\nCount the cups on your table in Turkish.\n";
const JSONB = "```json\n" + JSON.stringify({ visual: { kind: "table", columns: ["Turkish", "English"], rows: [["bir", "one"], ["iki", "two"]] }, cards: [{ front: "bir", back: "one" }, { front: "iki", back: "two" }, { front: "üç", back: "three" }], keyPoints: ["bir = one"] }) + "\n```";
const fake = (answers) => { const calls = []; const f = async (m, o) => { calls.push({ m, o }); return answers.shift() ?? ""; }; f.calls = calls; return f; };
let ok = 0; const pass = (m) => { ok++; };

// 1. a good lesson: one call, nothing to fix
{ const llm = fake([GOOD + JSONB]); const l = await D.writeLesson(llm, course, 0);
  assert.equal(llm.calls.length, 1); assert.equal(l.visual.kind, "table"); assert.equal(l.cards.length, 3); assert.deepEqual(l.checked, []); pass(); }
// 2. "Sure! Here is your lesson", the title as a heading, a loop, LaTeX, a cut-off sentence → cleaned
{ const loop = "This is a sentence the model keeps on writing again and again.\n".repeat(6);
  const raw = "Sure! Here is today's lesson.\n# Lesson 1: Numbers 1 to 10\n" + GOOD + "The rule is $2 \\times 3 = 6$ here.\n" + loop + JSONB;
  const l = await D.writeLesson(fake([raw]), course, 0);
  assert.doesNotMatch(l.body, /Sure|Lesson 1:|\$|\\times/); assert.ok((l.body.match(/keeps on writing/g) || []).length <= 2, "the loop is cut"); assert.match(l.body, /2 × 3 = 6/);
  assert.ok(l.fixed.includes("meta") && l.fixed.includes("loop") && l.fixed.includes("latex"), "what was fixed is recorded: " + l.fixed); pass(); }
// 3. too short / no sections → one stricter retry, which is kept
{ const llm = fake(["Numbers are bir iki üç.", GOOD + JSONB]); const l = await D.writeLesson(llm, course, 0);
  assert.equal(llm.calls.length, 2); assert.match(llm.calls[1].m[0].content, /IMPORTANT: the last try came out short/); assert.ok(l.body.includes("## Using them")); pass(); }
// 4. an Arabic course answered in English → retried; the Arabic one is kept
{ const ar = { ...D.newCourse({ topic: "إدارة الوقت", lang: "ar" }), plan: ["ترتيب الأولويات"] };
  const AR = "## الفكرة\nابدأ بأهم مهمة في يومك قبل أن تفتح الرسائل، لأن الصباح هو أهدأ وقت للتركيز العميق عند أغلب الناس.\n\n## التطبيق\nاكتب ثلاث مهام فقط لليوم، ورتبها من الأهم إلى الأقل أهمية، ثم ابدأ بالأولى ولا تنتقل حتى تنهيها أو تنهي جزءًا واضحًا منها.\n";
  const llm = fake([GOOD.repeat(2), AR + JSONB]); const l = await D.writeLesson(llm, ar, 0);
  assert.equal(llm.calls.length, 2); assert.match(llm.calls[1].m[0].content, /language/); assert.match(l.body, /ابدأ بأهم/); assert.match(l.body, /## جرّب/, "a Try it by code, in Arabic"); pass(); }
// 5. broken JSON at the end → the extras come from a second request UNDER THE GRAMMAR
{ const extras = JSON.stringify({ visual: { kind: "steps", title: "Count", items: ["bir", "iki"] }, cards: [{ front: "bir", back: "one", note: "" }, { front: "iki", back: "two", note: "" }, { front: "üç", back: "three", note: "" }], keyPoints: ["a", "b", "c"] });
  const llm = fake([GOOD + "```json\n{\"visual\": {\"kind\": \"table\", \"columns\": [\"a\"", extras]); const l = await D.writeLesson(llm, course, 0);
  assert.equal(llm.calls.length, 2); assert.equal(llm.calls[1].o.grammar, D.EXTRAS_GRAMMAR, "the second request is grammar-constrained");
  assert.equal(l.visual.kind, "steps"); assert.equal(l.cards.length, 3); assert.doesNotMatch(l.body, /```|"visual"/); pass(); }
// 6. the model gives nothing usable for the extras either → key points and flashcards made by code from the lesson
{ const body = GOOD.replace("## Try it\nCount the cups on your table in Turkish.\n", "") + "\n- bir: one\n- iki: two\n";
  const l = await D.writeLesson(fake([body, "garbage"]), course, 0);
  assert.ok(l.keyPoints.length >= 1, "key points by code"); assert.match(l.body, /## Try it/, "a Try it by code"); pass(); }
// 7. nothing at all → null (the page says try again), never an empty lesson
{ assert.equal(await D.writeLesson(fake(["", ""]), course, 0), null); pass(); }
// 8. the same paragraph twice → once
{ const c = D.cleanLessonBody("## A\nThe same paragraph that the model wrote twice by mistake here.\n\nThe same paragraph that the model wrote twice by mistake here.\n\n## B\nEnd.");
  assert.equal((c.body.match(/same paragraph/g) || []).length, 1); assert.ok(c.fixed.includes("repeat")); pass(); }
// 9. problems by code
assert.deepEqual(D.lessonProblems({ body: GOOD }, course), []);
assert.ok(D.lessonProblems({ body: "short" }, course).includes("short"));
console.log("PASS v737lessons (" + ok + " cases)");
