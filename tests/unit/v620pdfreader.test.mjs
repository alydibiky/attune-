// v6.20 — Ask a PDF reader: word boxes → highlights, evidence for citations, the kept-documents library (eviction,
// persistence), annotations (store, Markdown, flatten payload), zoom / reading plan / cache.
import * as R from "../../web-src/pdfreader.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

// a page laid out like DocTools.pdfWords returns it (fractions of the page), given out of order on purpose
const line = (y, x0, text, wch = 0.012) => { let x = x0; return text.split(" ").map((t) => { const w = [x, y, t.length * wch, 0.02, t]; x += t.length * wch + 0.01; return w; }); };
const raw = [
  ...line(0.30, 0.1, "Invoices are due within 15 days."),
  ...line(0.10, 0.1, "Payment terms"),
  ...line(0.20, 0.1, "The client shall pay a daily rate of 9,000 EGP."),
  ...line(0.33, 0.1, "A late payment fee of 2% per month applies"),
  ...line(0.36, 0.1, "after the due date."),
].reverse();
const ws = R.orderWords(raw);
ok(ws[0].t === "Payment" && ws[2].t === "The" && ws.every((w, i) => w.i === i), "words are put in reading order (top to bottom, left to right)");
ok(new Set(ws.map((w) => w.line)).size === 5, "…and grouped into 5 lines");

// search hits
let h = R.findRects(ws, "late payment");
ok(h.length === 1 && h[0].rects.length === 1 && near(h[0].rects[0].y, 0.33 - 0.002), "a two-word search finds one hit with one rectangle on its line");
h = R.findRects(ws, "payment");
ok(h.length === 2, "a word found twice → two hits (" + h.length + ")");
h = R.findRects(ws, "due");
ok(h.length === 2 && h.every((x) => x.rects[0].w > 0 && x.rects[0].h > 0), "every hit has a real rectangle");
h = R.findRects(ws, "fee of 2% per month applies after the");
ok(h.length === 1 && h[0].rects.length === 2, "a phrase over two lines → one rectangle per line");
ok(R.findRects(ws, "zebra").length === 0 && R.findRects(ws, "a").length === 0, "no hit for a missing word or a one-letter query");

// Arabic (right to left, normalised letters and digits)
const ar = R.orderWords([[0.7, 0.5, 0.15, 0.02, "غرامة"], [0.5, 0.5, 0.15, 0.02, "التأخير"], [0.3, 0.5, 0.15, 0.02, "٢٪"], [0.86, 0.5, 0.1, 0.02, "وفي"]]);
ok(ar.map((w) => w.t).join(" ") === "وفي غرامة التأخير ٢٪", "an Arabic line is read right to left");
ok(R.findRects(ar, "غرامه التاخير").length === 1, "an Arabic search matches with normalised letters (ة/ه, أ/ا)");

// evidence for a citation
const claims = R.claimsByPage("The late fee is 2% per month after the due date [p. 2]. Invoices are paid within 15 days [p. 2, 3].");
ok(/late fee is 2%/.test(claims[2]) && /15 days/.test(claims[3]), "an answer's claims are matched to the pages they cite");
let ev = R.evidenceRects(ws, claims[2].split("[")[0], "What is the late payment fee?");
ok(ev && ev.text.includes("late payment fee of 2%") && ev.rects.length >= 1, "the evidence sentence for 'late fee 2%' is found on the page: " + (ev && ev.text));
ok(ev && ev.rects.every((r) => r.y > 0.3 && r.y < 0.4), "…and its rectangles sit on those lines");
ev = R.evidenceRects(ws, "Invoices are paid within 15 days", "");
ok(ev && ev.text.startsWith("Invoices"), "a number in the claim pins the right sentence");
ok(R.evidenceRects(ws, "The crane boom has a radius limit", "") === null, "a claim the page does not support → no highlight (not a wrong one)");

// selection
const sel = R.selectionFrom(ws, 6, 3);
ok(sel.quote === "client shall pay a" && sel.rects.length === 1, "a selection (either direction) → its quote and rectangle");

// view
ok(R.fitZoom("width", 360, 600, 0.707) === 1 && near(R.fitZoom("page", 360, 400, 0.707), 400 * 0.707 / 360), "fit width / fit page");
ok(R.clampZoom(9) === 5 && R.clampZoom(0.1) === 0.5, "zoom is kept between 50% and 500%");
ok(R.renderWidth(360, 1, 2) === 800 && R.renderWidth(360, 4, 3) === 2400, "the page picture is sharp for the zoom but capped");
const plan = R.readPlan(300);
ok(plan[0].from === 1 && plan[0].max === 10 && plan.reduce((a, p) => a + p.max, 0) === 300 && plan[plan.length - 1].from + plan[plan.length - 1].max - 1 === 300, "a 300-page file is read first 10 pages, then in parts, every page once");
const c = R.lru(3); for (let i = 1; i <= 5; i++) c.set(i, "x" + i); c.get(3); c.set(6, "x6");
ok(c.size === 3 && !c.has(1) && c.has(3) && !c.has(4), "the picture cache keeps only the most recent pages");
ok(R.thumbWindow(1, 300, 3).join() === "1,2,3,4" && R.thumbWindow(300, 300, 2).join() === "298,299,300", "thumbnails around the current page");

// ---- library: persistence and eviction
const kv = R.memKV();
const lib = R.library(kv, { cap: 6000, keepFileMax: 1000 });
const mk = (n, len, b64 = "") => ({ id: R.docId("f" + n + ".pdf", len, "head" + n), name: "f" + n + ".pdf", kind: "pdf", count: 2, size: b64.length, b64, pages: [{ n: 1, text: "x".repeat(len) }, { n: 2, text: "y" }] });
const d1 = mk(1, 1500, "QUJD"), d2 = mk(2, 1500), d3 = mk(3, 1500, "Z".repeat(2000));
let r1 = await lib.save(d1, 1000);
ok(r1.kept && r1.fileKept && (await lib.get(d1.id)).b64 === "QUJD", "a small file is kept with its text");
await lib.save(d2, 2000);
const r3 = await lib.save(d3, 3000);
ok(r3.kept && !r3.fileKept && (await lib.get(d3.id)).b64 === null, "a file over the size limit: its text is kept, the file itself is not");
ok((await lib.list()).map((x) => x.name).join() === "f3.pdf,f2.pdf,f1.pdf", "the list is newest first");
await lib.touch(d1.id, { lastPage: 2, zoom: 1.5 }, 3500);
const i1 = await lib.info(d1.id);
ok(i1.lastPage === 2 && i1.zoom === 1.5, "last page and zoom are remembered");
await lib.saveChat(d1.id, [{ role: "user", text: "hi" }, { role: "ai", text: "hello [p. 1]" }]);
ok((await lib.chat(d1.id)).length === 2, "the chat is kept per document");
// a fresh library over the same storage (= the app opened again)
const lib2 = R.library(kv, { cap: 6000, keepFileMax: 1000 });
ok((await lib2.info(d1.id)).lastPage === 2 && (await lib2.chat(d1.id))[1].text.includes("[p. 1]"), "everything is still there in the next session");
const d4 = mk(4, 2500);
const r4 = await lib.save(d4, 4000);
ok(r4.kept && r4.evicted.length >= 1 && r4.evicted[0] === d2.id && !(await lib.get(d2.id)), "over the cap → the oldest document goes first (" + r4.evicted.length + " removed)");
ok((await lib.usage()) <= 6000, "the total stays under the cap");
ok(!!(await lib.get(d1.id)), "the recently opened one is kept");
await lib.remove(d1.id);
ok(!(await lib.get(d1.id)) && (await lib.chat(d1.id)).length === 0 && !(await lib.info(d1.id)), "delete removes the text, chat and entry");
await lib.clear();
ok((await lib.list()).length === 0 && (await kv.keys()).filter((k) => k !== "meta").length === 0, "clear removes everything");
ok(!(await lib.save(mk(9, 9000), 5000)).kept, "a document bigger than the whole cap is not kept");
ok(R.docId("a.pdf", 10, "abc") === R.docId("a.pdf", 10, "abc") && R.docId("a.pdf", 10, "abc") !== R.docId("a.pdf", 10, "abd"), "the same file gets the same id; a different one does not");

// ---- annotations
let A = [];
A = R.addAnn(A, { kind: "highlight", page: 2, quote: "late payment fee of 2%", rects: [{ x: 0.1, y: 0.33, w: 0.3, h: 0.02 }], color: "green" }, 10);
A = R.addAnn(A, { kind: "note", page: 1, text: "Check this with the lawyer", quote: "Payment terms" }, 11);
A = R.toggleBookmark(A, 3, "Insurance", 12);
A = R.toggleBookmark(A, 3, "", 13);
ok(!A.some((x) => x.kind === "bookmark"), "a bookmark toggles off");
A = R.toggleBookmark(A, 3, "Insurance", 14);
A = R.addAnn(A, { kind: "bookmark", page: 3 }, 15);
ok(A.length === 3 && A[0].page === 1 && A.filter((x) => x.kind === "bookmark").length === 1, "annotations are sorted by page; one bookmark a page");
ok(R.annsOn(A, 2).length === 1 && R.annsOn(A, 2)[0].color === "green", "the highlights of a page");
A = R.updateAnn(A, R.annsOn(A, 2)[0].id, { text: "important" });
const md = R.annsToMarkdown("contract.pdf", A);
ok(md.startsWith("# Notes on contract.pdf") && md.includes("## Bookmarks") && md.includes("Page 3 — Insurance") && md.includes("> late payment fee of 2%") && md.includes("important") && md.includes("Check this with the lawyer"), "exported as Markdown");
ok(R.annsToMarkdown("ملف.pdf", A, true).includes("## التظليل"), "…with Arabic headings on an Arabic screen");
const fp = R.flattenPayload(A);
ok(fp.length === 2 && fp.find((x) => x.kind === "highlight").rects[0].join() === "0.1,0.33,0.3,0.02" && fp.find((x) => x.kind === "highlight").color === R.COLOURS.green, "the list the PDF tool draws into the file");
A = R.removeAnn(A, A[0].id);
ok(A.length === 2, "an annotation is deleted");
await lib.saveAnns("x", A); ok((await lib.anns("x")).length === 2, "annotations are kept per document");

// selection → chat
const tm = R.selectionMessages("translate", "The client shall pay", 2, { to: "ar" });
ok(/Arabic/.test(tm[0].content) && tm[1].content === "The client shall pay", "translate a selection to Arabic");
const em = R.selectionMessages("explain", "late payment fee of 2%", 2);
ok(em[1].content.includes("[p. 2]") && /Explain/.test(em[1].content), "explain a selection, with its page");

// speed: a 300-page book's words (≈ 350 words a page) → order + search under a few ms a page
{
  const big = []; for (let l = 0; l < 35; l++) big.push(...line(0.05 + l * 0.025, 0.05, "the crane boom extends and the load chart limits radius"));
  let t0 = Date.now(); for (let p = 0; p < 300; p++) { const o = R.orderWords(big); R.findRects(o, "load chart"); }
  const t = Date.now() - t0;
  ok(t < 3000, `300 pages of word boxes ordered and searched in ${t} ms`);
}
