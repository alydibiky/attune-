// v6.8 — PDF → Word through the app's own code (convert.js), as the Convert screen does it
// (convert-ui.jsx), from the phone reader's output (PdfLayout.java = DocTools.kt).
//   node tests/convert/bench.mjs out/report.json → out/report.out.docx
import fs from "fs";
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => delete mem[k] };
if (!globalThis.atob) globalThis.atob = (s) => Buffer.from(s, "base64").toString("binary");
if (!globalThis.btoa) globalThis.btoa = (s) => Buffer.from(s, "binary").toString("base64");
const C = await import("../../web-src/convert.js");
const src = process.argv[2], r = JSON.parse(fs.readFileSync(src, "utf8"));
const name = src.replace(/\.json$/, "").split("/").pop();
// exactly the screen's choice: pages with their layout go through the layout reader
const doc = C.pdfToDocx ? C.pdfToDocx(r.pages, name) : C.docxFromBlocks(r.pages.flatMap((p) => (!p.scan && p.lines && p.lines.length ? C.pdfLinesToBlocks([p]) : C.textToBlocks(p.text || ""))), name);
fs.writeFileSync(src.replace(/\.json$/, ".out.docx"), doc);
console.log("wrote", src.replace(/\.json$/, ".out.docx"), doc.length, "bytes");
