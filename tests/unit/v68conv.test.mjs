// v6.8 — PDF → Word keeps the look (Ali: "not just convert but with formatting and spacing and everything,
// like from PDF to Word"). The fixtures are what the phone's reader (DocTools.kt = tests/convert/PdfLayout.java)
// sends for two real PDFs made by LibreOffice from Word files (tests/convert/make_samples.py): an English
// inspection report and an Arabic price offer. The full check with rendering: bash tests/convert/run.sh
import fs from "fs";
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => delete mem[k] };
const C = await import("../../web-src/convert.js");
let fail = 0;
const ok = (c, what) => { console.log((c ? "PASS " : "FAIL ") + what); if (!c) fail++; };
const load = (n) => JSON.parse(fs.readFileSync(new URL(`../convert/fixtures/${n}.json`, import.meta.url), "utf8"));
const dec = (u8) => new TextDecoder().decode(u8);

// ---- the English report ----
const rep = load("report"), rb = C.pdfLinesToBlocks(rep.pages);
const find = (rx) => rb.find((b) => rx.test(b.text || ""));
ok(find(/^Crane Inspection Report$/).type === "h1" && find(/^Crane Inspection Report$/).align === "center", "pdf→word: the title is a centred heading");
ok(find(/^1\. Summary$/) && /^h/.test(find(/^1\. Summary$/).type), "pdf→word: «1. Summary» in a big font is a heading, not a numbered item");
const sum = find(/^The Liebherr/);
ok(sum && sum.type === "p" && sum.runs.some((r) => r.b && /Liebherr LTM 1090/.test(r.t)) && sum.runs.some((r) => r.i && /12 September 2026/.test(r.t)) && sum.runs.some((r) => r.b && /fit for service/.test(r.t)), "pdf→word: bold and italic words inside a sentence are kept");
ok(!/2026 \./.test(sum.runs.map((r) => r.t).join("")), "pdf→word: no space slips in before a full stop in another font");
ok(sum.align === "left" && find(/^This paragraph is justified/).align === "justify", "pdf→word: left-aligned and justified paragraphs told apart");
ok(rb.filter((b) => b.type === "li" && !b.num).map((b) => b.text).join("|") === "Hydraulic hoses and fittings|Wire rope and hook block|Load moment indicator (LMI)", "pdf→word: Word's Symbol-font bullets (private-use characters) are bullets");
ok(rb.filter((b) => b.type === "li" && b.num).map((b) => b.num).join("") === "123", "pdf→word: numbered steps keep their numbers");
ok(find(/^Note: the operator/).ind > 30, "pdf→word: an indented paragraph keeps its indent");
ok(find(/^Warning:/).runs.every((r) => r.c === "C00000" && r.b), "pdf→word: a red bold warning stays red and bold");
ok(find(/^Weather on the day/).font === "Arial" && sum.font === "Times New Roman", "pdf→word: fonts kept (Liberation Sans → Arial, Liberation Serif → Times New Roman)");
const tb = rb.find((b) => b.type === "table");
ok(tb && tb.rows.length === 4 && tb.rows[0].join("|") === "Test|Load (t)|Result" && tb.bold[0].every(Boolean) && !tb.bold[1][0], "pdf→word: the table, its bold header row only");
ok(tb.widths && tb.widths.length === 3 && Math.min(...tb.widths) > 100, "pdf→word: the table's columns keep their widths");
const img = rb.find((b) => b.type === "image");
ok(img && Math.abs(img.w - 255) < 3 && rb.indexOf(img) > rb.indexOf(tb) && rb.indexOf(img) < rb.indexOf(find(/^Figure 1/)), "pdf→word: the chart picture is kept, at its size, between the table and its caption");
ok(find(/^Figure 1/).align === "center" && find(/^Figure 1/).size === 9, "pdf→word: the caption keeps its centring and its small size");
ok(find(/ملاحظة/) && find(/ملاحظة/).pageBreak && find(/ملاحظة/).rtl, "pdf→word: page 2 starts on a new page; the Arabic note is right-to-left");
ok(C.fontFamily("BAAAAA+TimesNewRomanPS-BoldMT") === "Times New Roman" && C.fontFamily("ArialMT") === "Arial" && C.fontFamily("CAAAAA+Calibri-Italic") === "Calibri", "pdf→word: PDF font names → the fonts Word knows");
const opt = C.pdfDocOptions(rep.pages);
ok(opt.page.w === 612 && opt.page.h === 792 && Math.abs(opt.page.left - 90) < 2 && opt.body === 11 && opt.font === "Times New Roman", "pdf→word: the page size, margins, body size and font come from the PDF");
const x = await C.unzip(C.pdfToDocx(rep.pages, "Report")), doc = dec(x.get("word/document.xml"));
ok(/<w:pgSz w:w="12240" w:h="15840"\/>/.test(doc) && /<w:pgMar w:top="\d+" w:right="\d+" w:bottom="\d+" w:left="1800"/.test(doc), "pdf→word: the Word page is the PDF's page (Letter, 1.25\" margins)");
ok(/<w:jc w:val="center"\/>/.test(doc) && /<w:jc w:val="both"\/>/.test(doc) && /<w:color w:val="C00000"\/>/.test(doc) && /<w:i\/><w:iCs\/>/.test(doc), "pdf→word: centring, justification, colour and italic are in the Word file");
ok(/<w:pageBreakBefore\/>/.test(doc) && /<w:ind w:left="\d+"/.test(doc) && /w:before="\d+"/.test(doc), "pdf→word: page breaks, indents and spacing are in the Word file");
ok([...x.keys()].some((k) => /^word\/media\/image1\.png$/.test(k)) && /<wp:extent cx="323\d{4}"/.test(doc), "pdf→word: the picture is in the Word file at its size");

// ---- the Arabic offer ----
const ar = load("arabic"), ab = C.pdfLinesToBlocks(ar.pages);
const af = (rx) => ab.find((b) => rx.test(b.text || ""));
ok(ab.every((b) => !/لإلنشاءات|اإلدارية|إليجار|مالحظة/.test(b.text || "")), "pdf→word (Arabic): «لا» is read right — no «مالحظة» / «لإلنشاءات»");
ok(af(/للإنشاءات/) && af(/الإدارية/) && af(/لإيجار ونش 70 طن لمدة 5 أيام/), "pdf→word (Arabic): the words and numbers in their order");
ok(af(/^السادة/).runs.some((r) => r.b && r.t.trim() === "شركة أوراسكوم للإنشاءات"), "pdf→word (Arabic): a bold company name inside the sentence stays bold");
ok(ab.filter((b) => b.type === "li").map((b) => b.text).join("|") === "السعر شامل السواق والوقود|الدفع 50% مقدم و50% بعد انتهاء الشغل|العرض ساري لمدة 15 يوم", "pdf→word (Arabic): the bullet list, with «50%» the right way round");
const at = ab.find((b) => b.type === "table");
ok(at && at.rtl && at.rows[0].join("|") === "البند|الكمية|السعر" && at.rows[1].join("|") === "ونش 70 طن|5 أيام|75,000 جنيه", "pdf→word (Arabic): the table right-to-left, first column on the right, cells in order");
ok(af(/^عرض سعر إيجار ونش$/).align === "center" && af(/^عرض سعر إيجار ونش$/).type === "h1", "pdf→word (Arabic): the centred title");
const ad = dec((await C.unzip(C.pdfToDocx(ar.pages, "Offer"))).get("word/document.xml"));
ok(/<w:bidiVisual\/>/.test(ad) && /<w:b\/><w:bCs\/>/.test(ad) && /<w:bidi\/>/.test(ad), "pdf→word (Arabic): a right-to-left table, and Arabic bold that Word shows (bCs)");

// ---- a long A4 manual: running header / footer, a table cell on two lines, a two-level list ----
const lg = load("long"), lb = C.pdfLinesToBlocks(lg.pages);
const hd = lb.find((b) => b.type === "header"), ft = lb.find((b) => b.type === "footer");
ok(hd && hd.text === "Adrighem & Aldibiki — Fleet Maintenance Manual" && hd.align === "right" && ft && ft.page === "1" && /^Page 1$/.test(ft.text), "pdf→word: the running header and the page-number footer are found");
ok(!lb.some((b) => b.type === "p" && /^(Page \d|Adrighem & Aldibiki — Fleet)/.test(b.text)), "pdf→word: … and not repeated inside the pages");
ok(lb.filter((b) => b.type === "p" && /^Walk around the crane/.test(b.text)).length === 12, "pdf→word: every paragraph is kept — a page's first line that repeats on other pages is not taken for a header");
const lt = lb.find((b) => b.type === "table");
ok(lt && lt.rows.length === 5 && lt.rows[3][0] === "Slew bearing grease" && lt.rows[4][0] === "Wire rope", "pdf→word: a cell whose text wraps onto two lines stays one cell, and the table goes on");
ok(lb.filter((b) => b.type === "li").map((b) => (b.level || 0) + b.text).join("|") === "0Hydraulics|1Hoses|1Cylinders and seals|0Structure|1Boom sections|1Outrigger pads", "pdf→word: a list's second level is kept");
ok(lb.find((b) => /^Fleet Maintenance Manual$/.test(b.text)).runs.every((r) => !r.b), "pdf→word: a heading shown plain (not bold) stays plain");
const lz = await C.unzip(C.pdfToDocx(lg.pages, "Manual")), ldoc = dec(lz.get("word/document.xml"));
ok(lz.has("word/header1.xml") && lz.has("word/footer1.xml") && /w:instr=" PAGE "/.test(dec(lz.get("word/footer1.xml"))) && /<w:footerReference/.test(ldoc), "pdf→word: the Word file has a real header and footer, the page number a PAGE field");
ok(/<w:b w:val="0"\/>/.test(ldoc) && /<w:ilvl w:val="1"\/>/.test(ldoc) && /<w:pgSz w:w="11906" w:h="16838"\/>/.test(ldoc), "pdf→word: a plain heading, the list level and the A4 page are in the Word file");
ok(C.pdfDocOptions(lg.pages).page.top > 60, "pdf→word: the top margin is where the text starts, not where the header sits");

// ---- the older reader (no word looks, no right edges) still works ----
const old = { lines: rep.pages[0].lines.map(({ e, i, r, f, c, ...l }) => ({ ...l, sp: l.sp.map((s) => [s[0], s[1], s[2], (s[3] || []).map((w) => [w[0], w[1]])]) })) };
const ob = C.pdfLinesToBlocks([old]);
ok(ob.some((b) => b.type === "table") && ob.some((b) => /^1\. Summary$/.test(b.text) && /^h/.test(b.type)), "pdf→word: the older reader's pages still give headings and tables");

// ---- translation keeps the paragraph's look where it can ----
const units = C.translateUnits([find(/^Warning:/)]);
const tr = C.applyTranslations([find(/^Warning:/)], units, ["تحذير: لا ترفع أكثر من 80% من الجدول"]);
ok(tr[0].runs && tr[0].runs.length === 1 && tr[0].runs[0].b && tr[0].runs[0].c === "C00000", "translate: a red bold paragraph stays red and bold in the other language");

// ---- Word → PDF: the Word file read with its look, laid out for printing ----
import { execSync } from "child_process";
let pyd = false; try { execSync(`python3 -c "import docx"`, { stdio: "ignore" }); pyd = true; } catch (e) {}
if (pyd && fs.existsSync(new URL("../convert/out/report.docx", import.meta.url))) {
  const rd = await C.docxRead(fs.readFileSync(new URL("../convert/out/report.docx", import.meta.url)));
  const f2 = (rx) => rd.blocks.find((b) => rx.test(b.text || ""));
  ok(rd.opts.page.w === 612 && rd.opts.page.left === 90 && rd.opts.body === 11, "word→pdf: the page, margins and body size are read from the Word file");
  ok(f2(/^The Liebherr/).runs.some((r) => r.b && /Liebherr LTM 1090/.test(r.t)) && f2(/^Warning/).runs[0].c === "C00000" && f2(/^This paragraph/).align === "justify", "word→pdf: bold words, a red run and justification are read");
  ok(rd.blocks.filter((b) => b.type === "li" && b.num).map((b) => b.num).join("") === "123" && rd.blocks.filter((b) => b.type === "li" && !b.num).length === 3, "word→pdf: Word's own numbers (1. 2. 3.) and bullets");
  ok(f2(/^1\. Summary/).type === "h1" && f2(/^1\. Summary/).runs[0].c === "365F91" && f2(/^1\. Summary/).runs[0].b, "word→pdf: a heading with its style's colour and weight");
  ok(rd.blocks.some((b) => b.type === "image" && Math.abs(b.w - 255) < 2), "word→pdf: the picture at its size");
  const html = C.blocksToPrintHtml(rd.blocks, "R", rd.opts);
  ok(/@page\{size:612pt 792pt;margin:72pt 90pt 72pt 90pt/.test(html) && /font-weight:700[^>]*>Liebherr LTM 1090/.test(html) && /text-align:justify/.test(html) && /<img src="data:image\/png/.test(html), "word→pdf: the print page keeps the page, bold words, justification and the picture");
  ok(!/style="[^"]*"(?![\s>])/.test(html) && /font-family:'Liberation Serif'/.test(html), "word→pdf: font names don't break the page's style attributes");
}
const lr = await C.docxRead(C.pdfToDocx(load("long").pages, "M"));
const pl = C.blocksToPrintHtml(lr.blocks, "M", lr.opts);
ok(/@bottom-center\{content:"Page " counter\(page\)/.test(pl) && /@top-right\{content:"Adrighem/.test(pl), "word→pdf: header and page-number footer in the page margins");
ok(/<thead>/.test(C.blocksToPrintHtml([{ type: "table", rows: [["Item", "Qty"], ["Sling", "4"]] }], "S", { sheet: true })) && /text-align:end">4</.test(C.blocksToPrintHtml([{ type: "table", rows: [["Item", "Qty"], ["Sling", "4"]] }], "S", { sheet: true })), "sheet→pdf: the header row repeats on each page, numbers line up on the right");

// ---- sheets: numbers Excel can add up, widths, frozen header, right-to-left Arabic ----
const xz = await C.unzip(C.xlsxFromRows([["Item", "Qty", "Price", "VAT"], ["Sling", "4", "18,000", "14%"], ["Shackle", "10", "1,250.50", "0123"]], "P")), sh = dec(xz.get("xl/worksheets/sheet1.xml"));
ok(/<c r="C2" s="2"><v>18000<\/v>/.test(sh) && /<c r="D2" s="4"><v>0.14<\/v>/.test(sh) && /<c r="C3" s="3"><v>1250.50<\/v>/.test(sh) && /t="inlineStr"[^>]*><is><t xml:space="preserve">0123/.test(sh), "sheet: 18,000 / 1,250.50 / 14% are numbers with their format; 0123 stays text");
ok(/state="frozen"/.test(sh) && /<col min="1" max="1" width="[\d.]+" customWidth="1"\/>/.test(sh), "sheet: the header row is frozen and the columns have widths");
ok(JSON.stringify(await C.xlsxToRows(C.xlsxFromRows([["A", "B"], ["18,000", "14%"]]))) === JSON.stringify([["A", "B"], ["18,000", "14%"]]), "sheet: … and read back as Excel shows them");
ok(/rightToLeft="1"/.test(dec((await C.unzip(C.xlsxFromRows([["البند", "السعر"], ["ونش", "75,000"]]))).get("xl/worksheets/sheet1.xml"))), "sheet: an Arabic sheet is right-to-left");
// ---- Markdown and web pages keep bold / italic ----
const mdb = C.textToBlocks("The **50 t** crane is *ready* — snake_case_name stays.");
ok(mdb[0].text === "The 50 t crane is ready — snake_case_name stays." && mdb[0].runs.some((r) => r.b && r.t === "50 t") && mdb[0].runs.some((r) => r.i && r.t === "ready"), "text→word: **bold** and *italic* are kept as the words' look (snake_case untouched)");
const hb = C.htmlToBlocks('<p style="text-align:center">The <b>crane</b> is <span style="color:#c00000">urgent</span></p>');
ok(hb[0].align === "center" && hb[0].runs.some((r) => r.b && r.t === "crane") && hb[0].runs.some((r) => r.c === "C00000"), "web page→word: bold, colour and centring are kept");

console.log(fail ? `\n${fail} FAILED` : "\nALL PASSED");
if (fail) process.exit(1);
