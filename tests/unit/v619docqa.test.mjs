import { buildIndex, rank, retrieve, intent, answerMessages, sections, checkCitations, splitCitations, searchPages, suggestions, words } from "../../web-src/docqa.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const pages = [
  { n: 1, text: "Crane Rental Agreement\n\nThis agreement is made between Adrighem Cranes and Nile Constructions on 1 March 2026 for the rental of one 50 tonne mobile crane." },
  { n: 2, text: "Payment terms\n\nThe client shall pay a daily rate of 9,000 EGP. Invoices are due within 15 days. A late payment fee of 2% per month applies after the due date." },
  { n: 3, text: "Insurance and liability\n\nThe owner carries third party insurance of 5,000,000 EGP. The client is responsible for ground conditions and for providing a certified signalman." },
  { n: 4, text: "Termination\n\nEither party may end this agreement with 30 days written notice. If the client cancels within 48 hours of the start date, one day's rental is charged." },
  { n: 5, text: "عقد إيجار الونش\n\nيلتزم العميل بدفع الإيجار اليومي وقدره ٩٠٠٠ جنيه، وتستحق الفاتورة خلال ١٥ يوماً من تاريخ الاستلام. وفي حالة التأخير تضاف غرامة ٢٪ شهرياً." },
];
const idx = buildIndex(pages);
ok(idx.N >= 5 && idx.chunks.every((c) => c.page >= 1 && c.text.length > 0), "pages become passages that remember their page");
let r = retrieve(idx, "What is the late payment fee?");
ok(r.pages[0] === 2 || r.pages.includes(2), "the late-fee question finds page 2 (" + r.pages + ")");
r = retrieve(idx, "how much insurance does the owner carry");
ok(r.pages.includes(3), "insurance → page 3");
r = retrieve(idx, "can I cancel and what is charged");
ok(r.pages.includes(4), "cancelling → page 4");
r = retrieve(idx, "9,000 EGP daily rate");
ok(r.pages.includes(2), "a figure in the question is matched exactly");
r = retrieve(idx, "ما هي غرامة التأخير؟");
ok(r.pages.includes(5), "Arabic question → the Arabic page (" + r.pages + ")");
r = retrieve(idx, "الإيجار اليومي كام");
ok(r.pages.includes(5), "Arabic digits and words match (٩٠٠٠)");
ok(retrieve(idx, "zzzz nothing here").excerpts.length === 0, "a question the document cannot answer retrieves nothing");
ok(words("Contracts and payments").join() === "contract,payment", "light stemming");
ok(intent("Summarise this document") === "summary" && intent("لخص الملف") === "summary" && intent("what is the late fee") === "find" && intent("make a table of contents") === "outline", "intent: summary / outline / find");
const m = answerMessages("What is the late fee?", r.excerpts, [{ role: "user", text: "hi" }]);
ok(m[0].role === "system" && /\[p\. N\]|\[p\. 12\]/.test(m[0].content) && m[m.length - 1].content.includes("[p. 5]"), "the prompt carries the excerpts with their pages");
// citations are verified
const a = checkCitations("The fee is 2% a month [p. 2]. Insurance is 5M [p. 9]. See also [p. 2, 3].", [2, 3]);
ok(a.cited.join() === "2,3" && a.removed === 1 && !a.text.includes("p. 9") && !a.text.includes("Insurance is 5M") && a.text.includes("2% a month [p. 2]") && a.supported, "a claim whose only page was invented is dropped, real ones kept");
ok(!checkCitations("It is probably 2%.", [2]).supported, "no valid citation → unsupported");
ok(checkCitations("The document does not mention a fee.", [2]).saysNotFound, "'not mentioned' is recognised");
ok(checkCitations("الغرامة ٢٪ [ص ٥]", [5]).cited.join() === "5", "Arabic citations [ص ٥] are read");
ok(splitCitations("a [p. 2] b [p. 3, 4]").filter((x) => x.p).map((x) => x.p).join() === "2,3,4", "citations become tappable pieces");
// summary plan and search
const secs = sections(idx, 400);
ok(secs.length >= 2 && secs[0].from === 1 && secs[secs.length - 1].to === 5, "pages are grouped into sections for a summary");
const s = searchPages(idx, "insurance");
ok(s.length === 1 && s[0].page === 3 && s[0].snippet.includes("insurance"), "the reader's search finds the page with a snippet");
ok(suggestions(idx).some((x) => /amount|figure/i.test(x)), "suggested questions fit a document with money");
// scale: a 400-page book
const big = []; for (let i = 1; i <= 400; i++) big.push({ n: i, text: ("Chapter " + i + ". " + "The crane boom extends and the load chart limits the radius. ".repeat(30)) + (i === 321 ? " The secret torque value is 1450 Nm for the slew ring bolts." : "") });
let t0 = Date.now(); const bi = buildIndex(big); const tb = Date.now() - t0;
t0 = Date.now(); const br = retrieve(bi, "what is the torque for the slew ring bolts"); const tr = Date.now() - t0;
ok(br.pages.includes(321) && tb < 4000 && tr < 300, `400 pages: indexed in ${tb} ms, a question in ${tr} ms, found page ${br.pages[0]}`);
{
  const { pageRefs, pageExcerpts } = await import("../../web-src/docqa.js");
  ok(pageRefs("what does page 3 say").join() === "3" && pageRefs("pages 2-4").join() === "2,3,4" && pageRefs("اشرح صفحة ٥").join() === "5" && pageRefs("explain p. 2").join() === "2" && pageRefs("the late fee").length === 0, "a page named in the question is understood (English and Arabic)");
  const e = pageExcerpts(idx, [4]);
  ok(e.pages.join() === "4" && e.excerpts[0].text.includes("Termination"), "…and exactly that page is read");
}

// ---- a real document: Ali's 2-page university assignment (text layer as the app reads it) ----
{
  const fs = await import("node:fs");
  const real = JSON.parse(fs.readFileSync(new URL("../convert/fixtures/real/biotech_assign_2.layout.json", import.meta.url), "utf8"));
  const ri = buildIndex(real.pages.map((p) => ({ n: p.n, text: p.text })));
  ok(ri.N >= 2 && ri.pages.length === 2, `the real PDF is indexed (${ri.N} passages over ${ri.pages.length} pages)`);
  const first = real.pages[0].text.split(/\s+/).filter((w) => w.length > 6).slice(3, 7).join(" ");
  const hit = retrieve(ri, first);
  ok(hit.pages.includes(1), "a phrase from page 1 retrieves page 1 (\"" + first.slice(0, 40) + "…\")");
  const second = real.pages[1].text.split(/\s+/).filter((w) => w.length > 6).slice(5, 9).join(" ");
  ok(retrieve(ri, second).pages.includes(2), "a phrase from page 2 retrieves page 2");
}
