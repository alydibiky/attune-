// Unit tests for v5.37: "as many file converters as you can" — PowerPoint, OpenDocument, e-books,
// web pages, RTF, JSON, subtitles, page lists.
import * as C from "../../web-src/convert.js";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }
const dec = (b) => new TextDecoder().decode(b);

// ---- OpenDocument: written here, read back; a LibreOffice-style file with spaces, spans and repeats ----
const blocks = C.textToBlocks("# Offer\n\nDear Hassan,\nplease see below.\n\n- 50 t crane\n- Operator included\n\n| Crane | Price |\n| 50 t | 18,000 |\n\n## الشروط\n\nالدفع مقدم.");
const odt = C.odtFromBlocks(blocks);
eq(dec((await C.unzip(odt)).get("mimetype")), "application/vnd.oasis.opendocument.text", "the .odt starts with its mimetype (LibreOffice needs it first)");
eq((await C.odtToBlocks(odt)).map((b) => b.type), ["h1", "p", "li", "li", "table", "h2", "p"], ".odt written here → read back: the same structure");
const lo = C.zipStore([{ name: "mimetype", data: "application/vnd.oasis.opendocument.text" }, { name: "content.xml", data: `<?xml version="1.0"?><office:document-content xmlns:office="o" xmlns:text="t" xmlns:table="ta"><office:body><office:text><text:sequence-decls/><text:h text:style-name="Heading_20_1" text:outline-level="1">Site <text:span text:style-name="T1">report</text:span></text:h><text:p text:style-name="P1">Hook<text:s text:c="3"/>OK<text:tab/>tested</text:p><text:list text:style-name="L1"><text:list-item><text:p>Boom &amp; jib</text:p></text:list-item><text:list-item><text:p>ونش</text:p></text:list-item></text:list><table:table table:name="T"><table:table-column/><table:table-row><table:table-cell office:value-type="string"><text:p>Part</text:p></table:table-cell><table:table-cell><text:p>Qty</text:p></table:table-cell></table:table-row></table:table><text:p/></office:text></office:body></office:document-content>` }]);
eq(await C.odtToBlocks(lo), [{ type: "h1", text: "Site report" }, { type: "p", text: "Hook   OK\ttested" }, { type: "li", text: "Boom & jib" }, { type: "li", text: "ونش" }, { type: "table", rows: [["Part", "Qty"]] }], "a LibreOffice .odt: spans, spaces, tabs, lists, Arabic and tables");
const ods = C.odsFromRows([["Item", "Qty"], ["Sling", "4"], ["شاكل", "0123"]]);
eq(await C.odsToRows(ods), [["Item", "Qty"], ["Sling", "4"], ["شاكل", "0123"]], ".ods written here → read back");
const lods = C.zipStore([{ name: "content.xml", data: `<office:document-content><office:body><office:spreadsheet><table:table table:name="S"><table:table-row><table:table-cell office:value-type="float" office:value="12.5"><text:p>12.50</text:p></table:table-cell><table:table-cell table:number-columns-repeated="2" office:value-type="string"><text:p>x</text:p></table:table-cell><table:table-cell table:number-columns-repeated="1020"/></table:table-row><table:table-row table:number-rows-repeated="1048000"><table:table-cell table:number-columns-repeated="1024"/></table:table-row></table:table></office:spreadsheet></office:body></office:document-content>` }]);
eq(await C.odsToRows(lods), [["12.5", "x", "x"]], "a LibreOffice .ods: the real number, repeated cells, and the million empty rows are dropped");

// ---- web pages and e-books ----
const html = `<html><head><title>x</title><style>p{}</style><script>var a="<p>no</p>"</script></head><body><nav>menu</nav><h1>Crane &amp; rigging</h1><p>The <b>LTM 1100</b> lifts 100&nbsp;t.<br>Second line.</p><ul><li>Hook</li><li>Boom</li></ul><table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>٢</td></tr></table><div>Plain div text</div></body></html>`;
eq(C.htmlToBlocks(html), [{ type: "h1", text: "Crane & rigging" }, { type: "p", text: "The LTM 1100 lifts 100 t.\nSecond line." }, { type: "li", text: "Hook" }, { type: "li", text: "Boom" }, { type: "table", rows: [["A", "B"], ["1", "٢"]] }, { type: "p", text: "Plain div text" }], "a web page → headings, paragraphs, bullets, tables (scripts, styles and menus dropped)");
const page = C.blocksToHtml(blocks, "Offer");
eq(C.htmlToBlocks(page).map((b) => b.type), ["h1", "p", "li", "li", "table", "h2", "p"], "our web page reads back the same");
const epub = C.zipStore([
  { name: "mimetype", data: "application/epub+zip" },
  { name: "META-INF/container.xml", data: `<container><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>` },
  { name: "OEBPS/content.opf", data: `<package><manifest><item id="c2" href="text/ch2.xhtml" media-type="application/xhtml+xml"/><item id="c1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>` },
  { name: "OEBPS/text/ch1.xhtml", data: `<html><body><h1>Chapter 1</h1><p>First.</p></body></html>` },
  { name: "OEBPS/text/ch2.xhtml", data: `<html><body><h2>الفصل الثاني</h2><p>Second.</p></body></html>` },
]);
eq(await C.epubToBlocks(epub), [{ type: "h1", text: "Chapter 1" }, { type: "p", text: "First." }, { type: "h2", text: "الفصل الثاني" }, { type: "p", text: "Second." }], "an e-book → its chapters in reading order (the spine, not the file order)");
eq(C.blocksToMarkdown([{ type: "table", rows: [["a", "b|c"], ["1", "2"]] }]), "| a | b\\|c |\n| --- | --- |\n| 1 | 2 |\n", "Markdown tables get a header rule");

// ---- RTF ----
eq(C.rtfToText("{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0 Calibri;}}{\\colortbl;\\red0\\green0\\blue0;}{\\*\\generator Riched20;}\\viewkind4\\uc1\\pard\\b Offer\\b0\\par Price: 18,000 \\'80\\par {\\*\\bkmkstart x}Caf\\'e9 \\u1605?\\u1585?\\u1581?\\u1576?\\u1575?\\par}"), "Offer\nPrice: 18,000 €\nCafé مرحبا", "RTF: control words, fonts/colours skipped, code-page and \\u (Arabic) characters");
eq(C.rtfToText(String.raw`{\rtf1\ansi\ansicpg1256 \'e3\'d1\'cd\'c8\'c7\par}`), "مرحبا", "RTF in the Arabic code page 1256");

// ---- JSON ----
const recs = C.jsonToRows(`{"items":[{"crane":"LTM 1100","tons":100},{"crane":"GMK","tons":60,"extra":{"a":1}}]}`);
eq(recs, [["crane", "tons", "extra"], ["LTM 1100", "100", ""], ["GMK", "60", '{"a":1}']], "JSON records → a sheet with a column per field");
eq(JSON.parse(C.rowsToJson(recs.map((r) => r.slice(0, 2)))), [{ crane: "LTM 1100", tons: 100 }, { crane: "GMK", tons: 60 }], "a sheet → JSON records (numbers stay numbers)");

// ---- subtitles ----
const srt = "1\n00:00:01,500 --> 00:00:03,000\nHello\n\n2\n00:01:02,050 --> 00:01:04,000\nمرحبا\nثاني سطر\n";
const cues = C.subsParse(srt);
eq(C.vttFromCues(cues), "WEBVTT\n\n00:00:01.500 --> 00:00:03.000\nHello\n\n00:01:02.050 --> 00:01:04.000\nمرحبا\nثاني سطر\n", "SRT → VTT");
eq(C.srtFromCues(C.subsParse(C.vttFromCues(cues))), srt, "VTT → SRT gives the same file back");
eq(C.subsParse("WEBVTT\n\n01:02.5 --> 01:04.000 align:start\nShort time\n")[0].start, 62500, "short VTT times (mm:ss.t) are read");

// ---- page lists, kinds ----
eq(C.pageList("1-3, 5, 9-", 10), [1, 2, 3, 5, 9, 10], "page list: ranges, single pages and 'to the end'");
eq(C.pageList("٢، ٤-٥", 8), [2, 4, 5], "page list typed with Arabic digits and comma");
eq(["a.pptx", "a.odt", "a.ods", "a.epub", "a.html", "a.rtf", "a.json", "a.srt", "a.vtt", "a.gif"].map((n) => C.kindOf(n)), ["pptx", "odt", "ods", "epub", "html", "rtf", "json", "srt", "vtt", "image"], "the new kinds are recognised");

// ---- real PowerPoint from python-pptx (when installed) ----
let py = false; try { execSync(`python3 -c "import pptx"`, { stdio: "ignore" }); py = true; } catch (e) {}
if (py) {
  const dir = "/tmp/attune-v537"; if (!existsSync(dir)) mkdirSync(dir);
  execSync(`python3 -c "
from pptx import Presentation
from pptx.util import Inches
p = Presentation()
s = p.slides.add_slide(p.slide_layouts[0]); s.shapes.title.text = 'Fleet review'; s.placeholders[1].text = 'Q3 2026'
s = p.slides.add_slide(p.slide_layouts[1]); s.shapes.title.text = 'Cranes'; tf = s.placeholders[1].text_frame; tf.text = 'LTM 1100 – 100 t'; tf.add_paragraph().text = 'ونش ٥٠ طن'
s.notes_slide.notes_text_frame.text = 'Mention the service dates'
s = p.slides.add_slide(p.slide_layouts[5]); s.shapes.title.text = 'Prices'
t = s.shapes.add_table(2, 2, Inches(1), Inches(2), Inches(6), Inches(1)).table
t.cell(0,0).text='Crane'; t.cell(0,1).text='EGP/day'; t.cell(1,0).text='50 t'; t.cell(1,1).text='18,000'
p.save('${dir}/deck.pptx')
"`);
  const deck = await C.pptxToBlocks(readFileSync(dir + "/deck.pptx"));
  eq(deck, [{ type: "h2", text: "1. Fleet review" }, { type: "p", text: "Q3 2026" }, { type: "h2", text: "2. Cranes" }, { type: "li", text: "LTM 1100 – 100 t" }, { type: "li", text: "ونش ٥٠ طن" }, { type: "p", text: "Notes: Mention the service dates" }, { type: "h2", text: "3. Prices" }, { type: "table", rows: [["Crane", "EGP/day"], ["50 t", "18,000"]] }],
    "a real PowerPoint: a heading per slide, subtitle, bullets (Arabic), speaker notes and a table");
  writeFileSync(dir + "/ours.odt", C.odtFromBlocks(blocks));
  execSync(`cd ${dir} && rm -rf x && mkdir x && cd x && unzip -q ../ours.odt && python3 -c "import xml.dom.minidom as m; [m.parse(f) for f in ['content.xml','META-INF/manifest.xml']]"`);
  eq(true, true, "our .odt XML is well-formed");
} else console.log("(python-pptx not installed — the real PowerPoint check is skipped)");

if (fails.length) { console.log(`\n${fails.length} FAILED`); process.exit(1); } else console.log("\nALL PASSED");
