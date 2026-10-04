// v6.12 — several files in one chat message: pages labelled by file; whole when they fit, the matching passages when not.
const MD = await import("../../web-src/multidoc.js");
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const docs = [{ name: "contract.pdf", pages: [{ n: 1, text: "Rental of a 50 t crane." }, { n: 2, text: "Daily rate 9,000 EGP. Late fee 2%." }] }, { name: "quote.docx", pages: [{ n: 1, text: "Quote: 70 t crane, 12,500 EGP a day, operator included." }] }];
const g = MD.globalPages(docs);
ok(g.length === 3 && g[1].label === "contract.pdf p. 2" && g[2].label === "quote.docx", "pages carry their file and page");
const small = MD.docsContext(docs, "compare the daily rates");
ok(!small.picked && /\[contract\.pdf p\. 2\]/.test(small.text) && /\[quote\.docx\]/.test(small.text) && /attached 2 files/.test(small.text), "small files go in whole, each part labelled");
const big = [{ name: "manual.pdf", pages: Array.from({ length: 60 }, (_, i) => ({ n: i + 1, text: (i === 41 ? "The outrigger pressure must not exceed 180 bar on soft ground. " : "General safety text about cranes and lifting plans. ").repeat(40) })) }, docs[1]];
const r = MD.docsContext(big, "what is the maximum outrigger pressure on soft ground?", 6000);
ok(r.picked && /\[manual\.pdf p\. 42\]/.test(r.text) && r.text.length <= 6500, "a big file: only the matching passages, with the right page (p. 42)");
ok(!MD.docsContext(big, "summarise these files", 6000).picked, "a summary keeps everything (the chat reads it in parts)");
ok(MD.gridOf(1).cols === 1 && MD.gridOf(2).cols === 2 && MD.gridOf(4).rows === 2 && MD.gridOf(6).cols === 3, "photo grid sizes");
ok(MD.isDoc("a.PDF") && MD.isSheet("b.xlsx") && !MD.isDoc("b.xlsx"), "documents and spreadsheets told apart");
const pages = await MD.readPages({ name: "notes.txt", text: "first part\n\nsecond part" }, {});
ok(pages.length === 1 && /second part/.test(pages[0].text), "a text file is read into pages");
console.log(fail ? `${fail} FAILED` : "ALL PASSED");
