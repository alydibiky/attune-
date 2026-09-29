// v6.8 — Word → PDF through the app's own code: docxRead → blocksToPrintHtml (the page the phone's Chrome
// engine prints — NativeBridge.htmlToPdf). node tests/convert/bench_pdf.mjs out/report.docx → out/report.print.html
import fs from "fs";
if (!globalThis.atob) globalThis.atob = (s) => Buffer.from(s, "base64").toString("binary");
if (!globalThis.btoa) globalThis.btoa = (s) => Buffer.from(s, "binary").toString("base64");
const C = await import("../../web-src/convert.js");
const src = process.argv[2];
const { blocks, opts } = await C.docxRead(fs.readFileSync(src));
fs.writeFileSync(src.replace(/\.docx$/, ".print.html"), C.blocksToPrintHtml(blocks, "doc", opts));
