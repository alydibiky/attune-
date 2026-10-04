// v6.10 — converter polish: the page's exact line pitch, table row heights, the top margin, two-column pages, symbols with no
// real text (drawn as inline pictures), ligatures, both-side indents, font mapping. Fixtures: what the phone's reader
// (DocTools.kt = tests/convert/PdfLayout.java) sends for Ali's real PDF and for the two-column paper of the bench.
import fs from "fs";
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => delete mem[k] };
const C = await import("../../web-src/convert.js");
let fail = 0;
const ok = (c, what) => { console.log((c ? "PASS " : "FAIL ") + what); if (!c) fail++; };
const load = (n) => JSON.parse(fs.readFileSync(new URL(`../convert/fixtures/real/${n}.layout.json`, import.meta.url), "utf8"));
const docXml = (bytes) => { const s = Buffer.from(bytes).toString("latin1"); const i = s.indexOf("<w:document"); return s.slice(i, s.indexOf("</w:document>", i) + 13); };

// ---- Ali's assignment: line pitch, table rows, margins
const bio = load("biotech_assign_2");
const bb = C.pdfLinesToBlocks(bio.pages);
const one = bb.find((b) => b.type === "p" && /^Answer the following/.test(b.text));
ok(one && one.line === 15, "a one-line paragraph keeps the page's 15 pt line pitch (it was Word's own ~13.8 pt)");
const tb = bb.find((b) => b.type === "table");
ok(tb && tb.rowH && tb.rowH.length === 4 && tb.rowH.every((h) => h > 18 && h < 30) && tb.vmid, "table rows are as tall as the drawn rules make them, text centred in them");
const opt = C.pdfDocOptions(bio.pages);
ok(opt.page.top >= 68 && opt.page.top <= 74, "the top margin puts the first baseline where the PDF has it (" + opt.page.top + " pt)");
const dx = docXml(C.pdfToDocx(bio.pages, "t"));
ok(/w:lineRule="exact"/.test(dx) && /<w:trHeight w:val="\d+" w:hRule="atLeast"\/>/.test(dx) && /<w:vAlign w:val="center"\/>/.test(dx), "Word gets exact line pitch, row heights and centred cells");
ok(!/ﬁ/.test(JSON.stringify(bb)) && bb.some((b) => /specific growth rate/.test(b.text)), "the «ﬁ» ligature is written as the letters f + i");
ok(C.fontFamily("AAAAAJ+STIXGeneral-Italic") === "Times New Roman" && C.fontFamily("AAAAAG+HelveticaNeue") === "Arial", "STIX maths and Helvetica Neue map to fonts Word and LibreOffice have");

// ---- the two-column paper
const pap = load("paper_2col");
const pb = C.pdfLinesToBlocks(pap.pages);
const ks = pb.map((b) => b.type);
ok(ks.includes("colstart") && ks.includes("colbreak") && ks.includes("colend") && ks.indexOf("colstart") < ks.indexOf("colbreak") && ks.indexOf("colbreak") < ks.indexOf("colend"), "two columns are found: start, column break, end");
const between = (a, z) => pb.slice(ks.indexOf(a) + 1, ks.indexOf(z));
const leftT = between("colstart", "colbreak").map((b) => b.text || "").join(" "), rightT = between("colbreak", "colend").map((b) => b.text || "").join(" ");
ok(/Introduction/.test(leftT) && /Model/.test(leftT) && !/Methods/.test(leftT), "the left column holds Introduction and Model");
ok(/Methods/.test(rightT) && /Results/.test(rightT) && /Conclusion/.test(rightT) && !/Introduction/.test(rightT), "the right column holds Methods, Results and Conclusion");
ok(!pb.some((b) => b.type === "table" && b.rows.some((r) => r.some((c) => /Batch cultures/.test(c)))), "the two columns are no longer read as a two-cell table");
const intro = pb.find((b) => b.type === "p" && /^Batch cultures are the simplest/.test(b.text));
ok(intro && /stationary phase\.$/.test(intro.text) && intro.align === "justify", "a column's paragraph is whole and justified within its column");
const abs = pb.find((b) => /^Abstract\./.test(b.text || ""));
ok(abs && abs.align === "justify" && abs.ind > 20 && abs.indR > 20, "the abstract is indented on both sides and justified (not centred lines)");
const pics = pb.flatMap((b) => (b.runs || []).filter((r) => r.pic));
ok(pics.length >= 2 && pics.every((r) => /^data:image\/png;base64,/.test(r.pic.b64) && r.pic.w > 2 && r.pic.h > 4), "symbols the PDF had no real text for come as inline pictures (" + pics.length + ")");
const px = docXml(C.pdfToDocx(pap.pages, "t"));
ok(/<w:cols w:num="2" w:space="\d+"\/>/.test(px) && /<w:br w:type="column"\/>/.test(px) && (px.match(/<w:type w:val="continuous"\/>/g) || []).length >= 2, "Word gets a continuous two-column section with a column break");
ok((px.match(/<wp:inline /g) || []).length >= 2 && /r:embed="rIdImg1"/.test(px), "the symbol pictures sit inline in their line");
ok(/w:right="\d+"/.test(px), "the right indent is written");
const txt = C.blocksToText(pb);
ok(!/colstart|undefined/.test(txt) && /Kinetics of Substrate-Limited Growth/.test(txt), "plain text skips the column markers");

// ---- a page with no columns is not split (tables of short cells don't count)
ok(!bb.some((b) => b.type === "colstart"), "Ali's one-column assignment (with its two-column table) is not split into columns");

if (fail) { console.log(`\n${fail} FAILED`); process.exit(1); } else console.log("\nALL PASSED");
