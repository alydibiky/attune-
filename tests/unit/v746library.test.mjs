// v6.46 "Remember this" (library.js): chapters found by code, the chapter a question asks about (English and Egyptian Arabic),
// that chapter's own text, which saved item a question means, and a long chapter read in parts.
import * as L from "../../web-src/library.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const book = ["The Crane Keeper", "Contents", "Chapter 1: The Port", "Chapter 2: The Storm", "Chapter 3: The Lift", "",
  "Chapter 1: The Port", "Omar arrives at Sokhna port at dawn. He meets the old operator, Hassan.",
  "Chapter 2: The Storm", "A storm closes the port for three days. The crane stands still.",
  "Chapter 3: The Lift", "On Friday the 200 tonne beam is lifted. Omar signals; Hassan lifts it in one try.", "The end."].join("\n");
const cs = L.chaptersOf(book);
ok(cs.length === 3 && cs.map((c) => c.n).join() === "1,2,3" && cs[0].at > book.indexOf("Contents") + 40, "3 chapters found — the real headings, not the table of contents");
const c3 = L.chapterText(book, 3);
ok(c3 && /200 tonne beam/.test(c3.text) && !/storm/i.test(c3.text) && c3.title === "The Lift", "chapter 3's own text (the lift), nothing from chapter 2");
for (const [q, n] of [["what happens in chapter 3?", 3], ["summarise chapter III", 3], ["what happens in the third chapter", 3], ["Chapter two in short", 2],
  ["إيه اللي بيحصل في الفصل التالت؟", 3], ["لخصلي الفصل ٢", 2], ["الفصل الأول بيتكلم عن إيه", 1], ["what's the weather", null]]) ok(L.askedChapter(q) === n, `"${q}" → ${n}`);
const ar = ["الفصل الأول", "وصل عمر إلى الميناء.", "الفصل الثاني", "هبت عاصفة."].join("\n");
ok(L.chaptersOf(ar).length === 2 && /عاصفة/.test(L.chapterText(ar, 2).text), "an Arabic book: «الفصل الأول», «الفصل الثاني»");
const items = [{ id: "a", title: "news-oct.txt", added: 2, chapters: 0 }, { id: "b", title: "The Crane Keeper.pdf", added: 1, chapters: 3 }];
ok(L.pickItem(items, "in The Crane Keeper, what happens in chapter 3").id === "b" && L.pickItem(items, "what happens in chapter 3").id === "b", "the item a question means: by its title, else the newest book with chapters");
const long = "Para one. ".repeat(900);
const plan = L.chapterPlan("Big Book", { head: "Chapter 9", title: "", text: long }, "what happens?");
ok(!plan.direct && plan.parts.length >= 2 && plan.parts.length <= 8 && /Part 1:/.test(plan.prompt(["a", "b"])), "a long chapter is read in parts (notes per part, then the answer)");
const p2 = L.chapterPlan("The Crane Keeper", c3, "what happens in chapter 3?");
ok(p2.direct && p2.prompt.includes("200 tonne beam") && p2.prompt.includes("Chapter 3"), "a short chapter goes whole to the answer");
// …and through the store Chat looks facts up in: the book is kept as passages; its text comes back whole, chapters intact
import * as K from "../../web-src/knowledge.js";
const store = K.createKnowledge(K.memoryStore());
const filler = (w) => (w + " ").repeat(400);
const big = ["Chapter 1: The Port", filler("Omar waits at the port."), "", "Chapter 2: The Storm", filler("The storm hits."), "", "Chapter 3: The Lift", "The 200 tonne beam is lifted on Friday. " + filler("Hassan lifts.")].join("\n\n");
const rec = await store.add({ kind: "file", title: "The Crane Keeper", text: big, collection: L.MINE, chapters: L.chaptersOf(big).length });
ok(rec.chunks > 5 && rec.chapters === 3 && rec.collection === "mine", "a book is kept as " + rec.chunks + " passages, with its 3 chapters noted");
const back = await store.textOf(rec.id);
ok(L.chaptersOf(back).length === 3 && /200 tonne beam/.test(L.chapterText(back, 3).text) && !/storm hits/.test(L.chapterText(back, 3).text), "its whole text comes back in order; chapter 3 is the lift");
