// v6.12 — Ask a PDF: a 10-slide PowerPoint is 10 pages (it was cut into 2 text "pages"); slides follow the deck's order.
import fs from "fs";
const C = await import("../../web-src/convert.js");
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const b = await C.pptxToBlocks(new Uint8Array(fs.readFileSync(new URL("../fixtures/solar10.pptx", import.meta.url))));
const slides = [...new Set(b.map((x) => x.slide))];
ok(slides.length === 10 && slides.join() === "1,2,3,4,5,6,7,8,9,10", "every block knows its slide: 10 slides");
ok(b.find((x) => x.slide === 4 && x.type === "h2").text === "4. Earth", "slide 4 is Earth");
console.log(fail ? `${fail} FAILED` : "ALL PASSED");
