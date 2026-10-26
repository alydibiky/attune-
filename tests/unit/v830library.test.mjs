// v8.3 Library (Ali picked 3A): many books → the right passages from each, compared, cited [Book, p. N], follow-ups keep the topic.
import * as B from "../../web-src/booklib.js";
import * as Q from "../../web-src/docqa.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const book = (id, name, pages) => ({ id, name, index: Q.buildIndex(pages.map((t, i) => ({ n: i + 1, text: t }))) });
const filler = (k) => "The caliphate collected taxes and built roads in the provinces during this period, number " + k + ".";
const books = [
  book("a", "hourani-history-of-the-arab-peoples.pdf", [filler(1), filler(2), "In 1260 the Mamluks under Qutuz and Baybars defeated the Mongols at Ain Jalut in Palestine. The Mongol army was about 10,000 men.", filler(4)]),
  book("b", "Lapidus_Islamic_Societies.pdf", [filler(5), "At Ain Jalut in 1260 the Mamluk sultan Qutuz stopped the Mongol advance; the Mongol force numbered some 20,000.", filler(7)]),
  book("c", "cookbook.pdf", ["Koshary is rice, lentils and pasta with tomato sauce.", "Molokhia is a green soup."]),
];
const f = B.passages(books, "What happened at the Battle of Ain Jalut?");
ok(f.length >= 2 && f.some((p) => p.book === "a" && p.page === 3) && f.some((p) => p.book === "b" && p.page === 2), "both history books give their Ain Jalut page (to compare): " + f.map((p) => p.title + " p" + p.page).join(", "));
ok(!f.some((p) => p.book === "c"), "a book that says nothing about it is not read");
ok(B.titleOf("hourani-history-of-the-arab-peoples.pdf") === "hourani history of the arab peoples" && B.titleOf("Lapidus_Islamic_Societies.pdf") === "Lapidus Islamic Societies", "short book titles for citations");
const msgs = B.libraryMessages("What happened at Ain Jalut?", f, []);
ok(/\[hourani history of the arab peoples, p\. 3\]/.test(msgs[msgs.length - 1].content) && /Where the books disagree/.test(msgs[0].content) && /never add facts from memory/.test(msgs[0].content), "the prompt: passages with [Book, p. N], compare, disagreements, no outside facts");
const hist = [{ role: "user", text: "What happened at the Battle of Ain Jalut?" }, { role: "ai", text: "…" }];
ok(B.searchText("and why did they lose?", hist).includes("Ain Jalut"), "a short follow-up is searched with the question before it");
ok(B.passages(books, "and how many soldiers?", { history: hist }).some((p) => p.book === "b"), "the follow-up still finds the books");
const ans = "The Mamluks won in 1260 [hourani history of the arab peoples, p. 3] [Lapidus Islamic Societies p. 2].\n\n### Where the books disagree\nHourani says 10,000 [hourani history of the arab peoples, p. 3]; Lapidus 20,000 [Lapidus Islamic Societies, p. 2].";
const c = B.citesIn(ans);
ok(c.length === 2 && c[0].page === 3 && c[1].title === "Lapidus Islamic Societies", "citations are read back (each once): " + JSON.stringify(c));
ok(B.passageFor(c[1], f) && /20,000/.test(B.passageFor(c[1], f).text), "a citation opens the book's own words");
const sp = B.splitDisagree(ans);
ok(/1260/.test(sp.main) && /10,000/.test(sp.differ) && !/Where the books/.test(sp.main), "'Where the books disagree' gets its own box");
ok(B.noCites(ans).indexOf("[") < 0 && /won in 1260\./.test(B.noCites(ans)), "the marks come out of the text (they are chips under it)");
// Read deeper: many pages per book in rounds, notes with citations, then one compared answer
const big = [book("x", "big-history.pdf", Array.from({ length: 60 }, (_, i) => (i % 6 === 0 ? "Ain Jalut 1260: Qutuz and Baybars fought the Mongols here, page " + i + ". " : "") + filler(i)))];
const rounds = B.deepRounds([...big, ...books], "Ain Jalut battle Mongols", { budget: 600 });
ok(rounds.length >= 2 && rounds.every((r) => r.reduce((a, p) => a + p.text.length, 0) <= 900 || r.length === 1), "a big question is read in rounds that each fit the model (" + rounds.length + " rounds)");
const nm = B.notesMessages("Ain Jalut?", rounds[0]);
ok(/\[Book, p\. N\]/.test(nm[0].content) && /\[big history, p\. \d+\]/.test(nm[1].content), "each round → notes that keep [Book, p. N]");
const fm = B.fromNotesMessages("Ain Jalut?", ["- Qutuz won [big history, p. 1]", "nothing"]);
ok(/Qutuz won/.test(fm[fm.length - 1].content) && !/\nnothing\n/.test(fm[fm.length - 1].content) && /Where the books disagree/.test(fm[0].content), "the notes → one answer that compares the books");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
