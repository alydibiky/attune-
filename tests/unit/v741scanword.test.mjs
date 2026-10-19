// v6.41 S2: a photo's text lines with their boxes → pages → Word blocks with the heading, the paragraph and the table.
import * as C from "../../web-src/convert.js";
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
// a phone photo (1190 px wide): a big title, a paragraph, a 3-column table, a closing line
const L = (text, x, y, w, h) => ({ text, x, y, w, h });
const r = { width: 1190, height: 1684, text: "Quotation", lines: [
  L("Quotation", 100, 80, 420, 64),
  L("Thank you for your enquiry. Please find our prices for the crane hire below,", 100, 200, 980, 34),
  L("valid for thirty days from today.", 100, 244, 460, 34),
  L("Item", 100, 340, 90, 34), L("Days", 600, 342, 90, 34), L("Price", 900, 340, 110, 34),
  L("Tadano 50 t", 100, 392, 220, 34), L("3", 600, 394, 20, 34), L("54,000", 900, 392, 130, 34),
  L("Liebherr 100 t", 100, 444, 260, 34), L("2", 600, 446, 20, 34), L("70,000", 900, 444, 130, 34),
  L("Hassan Trading — 6th of October City", 100, 560, 640, 34)] };
r.text = r.lines.map((l) => l.text).join("\n");
ok(C.ocrUsable(r) && !C.ocrUsable({ ...r, text: "عرض سعر" }), "a Latin page goes the layout way; an Arabic one goes to the AI");
const pages = C.ocrPages(r);
ok(pages.length === 1 && pages[0].lines.length === 7 && pages[0].lines[3].sp.length === 3, "lines on one row become one line with 3 pieces (the table header): " + pages[0].lines.map((l) => l.sp.length).join(","));
const blocks = C.pdfLinesToBlocks(pages);
const types = blocks.map((b) => b.type);
const tab = blocks.find((b) => b.type === "table");
ok(tab && tab.rows.length === 3 && tab.rows[1].join("|") === "Tadano 50 t|3|54,000", "the table: 3 rows × 3 columns: " + JSON.stringify(tab && tab.rows));
ok(/^h/.test(types[0]) || blocks[0].level || blocks[0].type === "heading", "the big first line is a heading: " + JSON.stringify(blocks[0]).slice(0, 80));
ok(blocks.some((b) => b.type === "p" || b.type === "para" || b.type === "paragraph") && JSON.stringify(blocks).includes("valid for thirty days"), "the two paragraph lines are one paragraph: " + types.join(","));
console.log(bad ? bad + " FAILED" : "v741scanword ok");
