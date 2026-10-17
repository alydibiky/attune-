// Unit tests for web-src/pdfedit.js (Converter → Edit a PDF, v6.32).   node tests/unit/pdfedit.test.mjs
import * as E from "../../web-src/pdfedit.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }
const near = (a, b, d = 1e-3) => Math.abs(a - b) < d;

// pdfWords: [x, y, w, h, text]; h = size × 1.08, y = baseline − size × 0.82
const W = (x, base, size, t, w) => [x, base - size * 0.82, w || t.length * size * 0.5, size * 1.08, t];
const row = (x, base, size, ts) => ts.map((t) => { const w = W(x, base, size, t); x += w[2] + size * 0.3; return w; });
const words = [
  ...row(0.1, 0.10, 0.02, ["Delta", "Lift"]),
  ...row(0.1, 0.15, 0.015, ["Bill", "to:", "Nile"]),
  ...row(0.1, 0.20, 0.012, ["Monthly", "service"]), W(0.80, 0.20, 0.012, "4,500"),   // a table: two cells
  ...row(0.5, 0.30, 0.015, ["الكلي", "الإجمالي"]),     // pdfWords gives Arabic words left to right on the page
];
const ls = E.linesOf(words);
eq(ls.map((l) => l.text), ["Delta Lift", "Bill to: Nile", "Monthly service", "4,500", "الإجمالي الكلي"], "words → lines; a wide gap is another cell; Arabic reads right to left");
eq(near(ls[1].size, 0.015) && near(ls[1].base, 0.15), true, "a line keeps its size and baseline");
eq(ls[4].rtl, true, "an Arabic line is right-to-left");
eq((E.hitLine(ls, 0.15, 0.145) || {}).text, "Bill to: Nile", "a tap on a line finds it");
eq(E.hitLine(ls, 0.5, 0.6), null, "a tap on an empty spot finds nothing");
eq((E.hitLine(ls, 0.82, 0.196) || {}).text, "4,500", "a tap on a table cell finds only that cell");

eq(E.plainLatin("Total — €5,750 “paid”"), true, "Latin text is written as real PDF text");
eq(E.plainLatin("الإجمالي"), false, "Arabic is drawn as a picture");

const r = E.selectRects(words, 0.11, 0.145, 0.15, 0.2);
eq(r.length, 2, "dragging from 'Bill' to 'service' highlights two lines");
eq(E.selectRects(words, 0.5, 0.9, 0.6, 0.95), [], "dragging over nothing highlights nothing");

const o = [{ n: 1 }, { n: 2 }, { n: 3 }];
eq(E.movePage(o, 2, 0).map((p) => p.n), [3, 1, 2], "a page moved to the front");
eq(E.changed([], o, 3), false, "nothing changed");
eq(E.changed([], [{ n: 1 }, { n: 3 }], 3), true, "a page left out is a change");
eq(E.changed([], [{ n: 1, rot: 90 }, { n: 2 }, { n: 3 }], 3), true, "a turned page is a change");

const edits = [
  { id: "a", page: 1, kind: "retext", rect: { x: 0.1, y: 0.13, w: 0.2, h: 0.02 }, bg: "#fffff0", text: "Bill to: Nile Towers", x: 0.1, base: 0.15, size: 0.015, rtl: false, color: "#000000" },
  { id: "b", page: 1, kind: "text", text: "مدفوع", x: 0.5, base: 0.5, size: 0.02, rtl: true },
  { id: "c", page: 2, kind: "highlight", rects: [[0.1, 0.1, 0.2, 0.02]], color: "#ffd54a" },
  { id: "d", page: 2, kind: "ink", pts: [[0.1, 0.1]] },
  { id: "e", page: 3, kind: "image", png: "AAAA", x: 0.6, y: 0.8, w: 0.3, h: 0.08 },
];
const ops = await E.buildOps(edits, [{ n: 3, rot: 450 }, { n: 0 }], async (e) => ({ png: "PIC", x: e.x - 0.1, y: e.base - e.size, w: 0.1, h: e.size * 1.3 }));
eq(ops.items.map((i) => i.kind), ["cover", "text", "image", "highlight", "image"], "a changed line = cover + text; Arabic = a picture; a one-point drawing is left out");
eq(ops.items[0].color, "#fffff0", "the cover has the page's own colour");
eq(ops.order, [{ n: 3, rot: 90 }, { n: 0, rot: 0 }], "the order with turns as 0/90/180/270");
eq(E.hitEdit(edits, 3, 0.7, 0.84), edits[4], "a tap on the signature finds it");

console.log(fails.length ? "FAILED: " + fails.length : "ALL PASSED");
process.exit(fails.length ? 1 : 0);
