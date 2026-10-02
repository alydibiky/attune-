// v6.10 — PDF → Word on Ali's REAL file (tests/convert/fixtures/real/biotech_assign_2.pdf, a 2-page university assignment).
// The fixture is what the phone's reader (DocTools.kt = tests/convert/PdfLayout.java) sends for it: lines, words with
// their sub/superscript, and the page's drawn rules. The synthetic bench scored 100 % while this file lost its table,
// its sub/superscripts, its paragraph breaks and its bold labels — so these checks are about exactly that.
import fs from "fs";
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => delete mem[k] };
const C = await import("../../web-src/convert.js");
let fail = 0;
const ok = (c, what) => { console.log((c ? "PASS " : "FAIL ") + what); if (!c) fail++; };
const r = JSON.parse(fs.readFileSync(new URL("../convert/fixtures/real/biotech_assign_2.layout.json", import.meta.url), "utf8"));
const blocks = C.pdfLinesToBlocks(r.pages);
const text = (b) => (b.runs ? b.runs.map((x) => x.t).join("") : b.text || "");
const find = (rx) => blocks.find((b) => rx.test(text(b)));

// ---- paragraphs and labels
const a1 = find(/^a\. Calculate the specific growth rate/i) || find(/^a\. Calculate the spe/);
ok(a1 && a1.type === "p" && a1.runs && a1.runs[0].b && /^a\./.test(a1.runs[0].t), "the bold label «a.» stays a bold label in a normal paragraph (not a list item)");
ok(!blocks.some((b) => b.type === "li" && /^[a-c]$/.test(b.num || "")), "no a./b./c. list with a tab and a hanging indent");
const c2 = find(/^c\. Does the cessation/);
ok(c2 && /activity has stopped\? Explain\.$/.test(text(c2)), "a wrapped line («… metabolic / activity has stopped?») stays inside its paragraph");
ok(find(/^Answer the following:/) && !/Answer the following/.test(text(find(/^A batch culture initially/))), "«Answer the following:» is its own paragraph");
const pa = find(/^Product A:/), pb = find(/^Product B:/);
ok(pa && pb && pa !== pb && !/Product B/.test(text(pa)), "«Product A: …» and «Product B: …» are separate paragraphs");
ok(find(/^A student concludes/) && !/A student concludes/.test(text(find(/^Substrate decreases/) || { text: "" })) , "«A student concludes: …» starts its own paragraph");

// ---- sub / superscripts and italics
const eq1 = blocks.find((b) => b.runs && b.runs.some((x) => x.v === 1 && /1/.test(x.t)) && /0\.30/.test(text(b)));
ok(eq1 && eq1.runs.some((x) => x.v === 1 && /−1|-1|\u22121/.test(x.t)) && eq1.runs.some((x) => x.i), "«μ = 0.30 h⁻¹»: the −1 is a real superscript and the symbols are italic");
const eq2 = blocks.find((b) => b.runs && /0\.60/.test(text(b)) && b.runs.some((x) => x.v === -1));
ok(eq2 && eq2.runs.filter((x) => x.v === -1).map((x) => x.t).join("").includes("X/S"), "«Y_X/S = 0.60 g_X/g_S»: X/S is a real subscript");
const qs = find(/^a\. Estimate the specific substrate-consumption rate/);
ok(qs && qs.runs.some((x) => x.v === -1 && x.t.trim() === "S") && qs.runs.some((x) => x.i && /q/.test(x.t)), "«q_S»: q italic, S a subscript");

// ---- the table
const tb = blocks.find((b) => b.type === "table");
ok(tb && tb.rows.length === 4 && tb.rows[0].join("|") === "Time (h)|Biomass X (g/L)", "the table is read: 4 rows, 2 columns");
ok(tb.ind === 0 || tb.ind === undefined, "the table starts at the margin, not 1.25 in to the right (was tblInd 1800)");
const sum = tb.widths.reduce((a, x) => a + x, 0);
ok(Math.abs(sum - 468) <= 4, "its width is the text width, 468 pt (was cut at the page edge): " + sum);
ok(tb.border && tb.border.c === "A6A6A6", "its borders are the light grey of the original, not 999999");
ok(Array.isArray(tb.align) && tb.align.every((x) => x === "center"), "its cell text is centred");

// ---- the Word file
const dec = (u8) => new TextDecoder().decode(u8);
const x = await C.unzip(C.pdfToDocx(r.pages, "Assignment")), doc = dec(x.get("word/document.xml"));
ok(/<w:vertAlign w:val="superscript"\/>/.test(doc) && /<w:vertAlign w:val="subscript"\/>/.test(doc), "the .docx has real superscript and subscript runs");
const tblInd = +((doc.match(/<w:tblInd w:w="(\d+)"/) || [0, 0])[1]), tblW = +((doc.match(/<w:tblW w:w="(\d+)"/) || [0, 0])[1]);
ok(tblInd + tblW <= 9360 + 40, "table indent + width fit the 6.5 in text area: " + (tblInd + tblW));
ok(/w:color="A6A6A6"/.test(doc) && !/w:color="999999"/.test(doc.slice(doc.indexOf("<w:tbl>"), doc.indexOf("</w:tbl>"))), "the table's border colour is written");
ok((doc.match(/<w:jc w:val="center"\/>/g) || []).length >= 8, "centred cells are written (jc center)");
ok(!/<w:numPr>/.test(doc.slice(0, doc.indexOf("Q3."))), "no list numbering on the lettered questions");

if (fail) { console.log(`\n${fail} FAILED`); process.exit(1); } else console.log("\nALL PASSED");
