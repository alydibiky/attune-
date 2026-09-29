// v6.8 — PowerPoint → PDF through the app's own code: pptxToSlidesHtml (one page per slide, as the phone's
// Chrome engine prints it). node tests/convert/bench_slides.mjs out/deck.pptx → out/deck.slides.html
import fs from "fs";
if (!globalThis.atob) globalThis.atob = (s) => Buffer.from(s, "base64").toString("binary");
if (!globalThis.btoa) globalThis.btoa = (s) => Buffer.from(s, "binary").toString("base64");
const C = await import("../../web-src/convert.js");
const r = await C.pptxToSlidesHtml(fs.readFileSync(process.argv[2]));
fs.writeFileSync(process.argv[2].replace(/\.pptx$/, ".slides.html"), r.html);
console.log(r.slides, "slides", Math.round(r.w), "x", Math.round(r.h), "pt");
