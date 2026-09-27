// Unit tests for v5.36: the File Converter's Word / Excel / CSV / text engine.
import { zipStore, unzip, crc32, textToBlocks, blocksToText, docxFromBlocks, docxToBlocks, xlsxFromRows, xlsxToRows, csvParse, csvStringify, kindOf } from "../../web-src/convert.js";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

eq(crc32(new TextEncoder().encode("hello")), 0x3610a686, "crc32 is right");
const z = await unzip(zipStore([{ name: "a.txt", data: "hello" }, { name: "dir/b.txt", data: "مرحبا" }]));
eq([new TextDecoder().decode(z.get("a.txt")), new TextDecoder().decode(z.get("dir/b.txt"))], ["hello", "مرحبا"], "a zip written here is read back (Arabic names and text too)");

const md = "# Crane rental offer\n\nDear Hassan,\nplease find our offer.\n\n- 50 t crane: 18,000 EGP / day\n- Operator included\n\n| Crane | Price |\n| --- | --- |\n| 50 t | 18,000 |\n| 100 t | 32,000 |\n\n## الشروط\n\nالدفع مقدم ٥٠٪.";
const blocks = textToBlocks(md);
eq(blocks.map((b) => b.type), ["h1", "p", "li", "li", "table", "h2", "p"], "text / Markdown → headings, paragraph, bullets, table, Arabic heading and paragraph");
eq(blocks[4].rows, [["Crane", "Price"], ["50 t", "18,000"], ["100 t", "32,000"]], "…the table rows (the --- rule is dropped)");

const docx = docxFromBlocks(blocks, "Offer");
const back = await docxToBlocks(docx);
eq(back.map((b) => b.type), ["h1", "p", "li", "li", "table", "h2", "p"], "Word written here → read back: the same structure");
eq(back[6].text, "الدفع مقدم ٥٠٪.", "…Arabic text survives");
eq(blocksToText(back).includes("| 100 t | 32,000") || blocksToText(back).includes("100 t | 32,000"), true, "…and back to text with the table as rows");

const xl = xlsxFromRows([["Item", "Qty", "Price"], ["Sling", "4", "1250.5"], ["شاكل", "10", "0123"]], "Parts");
const rows = await xlsxToRows(xl);
eq(rows, [["Item", "Qty", "Price"], ["Sling", "4", "1250.5"], ["شاكل", "10", "0123"]], "Excel written here → read back (a leading-zero code stays text)");
eq(csvParse('Name,Note\n"Ali, Jr.","said ""hi"""\nمحمود,تمام\n'), [["Name", "Note"], ["Ali, Jr.", 'said "hi"'], ["محمود", "تمام"]], "CSV with quotes, commas and Arabic");
eq(csvParse(csvStringify([["a", "b,c"], ["1", "x\"y"]])), [["a", "b,c"], ["1", 'x"y']], "CSV round trip");
eq([kindOf("offer.PDF"), kindOf("x.docx"), kindOf("scan.jpg"), kindOf("sheet.xlsx"), kindOf("d.csv"), kindOf("n.md"), kindOf("a.zip")], ["pdf", "docx", "image", "xlsx", "csv", "text", null], "file kinds from their names");

// Real-world check (when python-docx / openpyxl are installed): our .docx / .xlsx open in the
// strict Office readers, and files THEY write (deflate-compressed, their own styles) are read here.
let py = false; try { execSync(`python3 -c "import docx, openpyxl"`, { stdio: "ignore" }); py = true; } catch (e) {}
if (py) {
  const dir = "/tmp/attune-v536"; if (!existsSync(dir)) mkdirSync(dir);
  writeFileSync(dir + "/ours.docx", docx); writeFileSync(dir + "/ours.xlsx", xl);
  const out = execSync(`python3 -c "
import docx, openpyxl
d = docx.Document('${dir}/ours.docx')
print('|'.join(p.style.name + ':' + p.text for p in d.paragraphs if p.text))
print('TABLE', d.tables[0].cell(2, 1).text)
ws = openpyxl.load_workbook('${dir}/ours.xlsx').active
print('XL', ws['A2'].value, ws['C2'].value, ws['C3'].value)
d2 = docx.Document(); d2.add_heading('Site report', 1); d2.add_paragraph('The crane was inspected on Monday.'); d2.add_paragraph('هناك تسريب زيت بسيط.', style='List Bullet')
t = d2.add_table(rows=2, cols=2); t.cell(0, 0).text = 'Part'; t.cell(0, 1).text = 'State'; t.cell(1, 0).text = 'Hook'; t.cell(1, 1).text = 'OK'
d2.save('${dir}/theirs.docx')
wb = openpyxl.Workbook(); ws = wb.active; ws.append(['Crane', 'Tons']); ws.append(['LTM 1100', 100]); wb.save('${dir}/theirs.xlsx')
"`).toString();
  eq(/Heading 1:Crane rental offer/.test(out) && /List Bullet:50 t crane/.test(out) && /الدفع مقدم/.test(out), true, "python-docx opens our Word file: headings, bullets and Arabic");
  eq(/TABLE 32,000/.test(out), true, "…with a real Word table");
  eq(/XL Sling 1250\.5 0123/.test(out), true, "openpyxl opens our Excel file (numbers are numbers, 0123 stays text)");
  const theirs = await docxToBlocks(readFileSync(dir + "/theirs.docx"));
  eq(theirs.map((b) => b.type).join(","), "h1,p,li,table", "a Word file made by python-docx (compressed) is read here: heading, paragraph, bullet, table");
  eq(theirs[2].text, "هناك تسريب زيت بسيط.", "…with its Arabic text");
  eq(await xlsxToRows(readFileSync(dir + "/theirs.xlsx")), [["Crane", "Tons"], ["LTM 1100", "100"]], "an Excel file made by openpyxl (shared strings) is read here");
} else console.log("(python-docx / openpyxl not installed — the real-world check is skipped)");

if (fails.length) { console.log(`\n${fails.length} FAILED`); process.exit(1); } else console.log("\nALL PASSED");
