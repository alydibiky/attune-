// v6.18 Fit's looks, the facts while a photo is read, and where the labels go on the photo.
import * as LK from "../../web-src/fitlook.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };

ok(LK.LOOKS.map((l) => l.id).join() === "fresh,night,bold,meals,rings,tiles" && LK.DEFAULT_LOOK === "fresh", "six looks, Fresh (A) the default");
ok(LK.lookOf({}) === "fresh" && LK.lookOf({ look: "bold" }) === "bold" && LK.lookOf({ look: "nope" }) === "fresh", "an unknown or missing look falls back to Fresh");
ok(["fresh", "night", "bold"].every((id) => LK.LOOK_CSS.includes(".fit-look-" + id + "{") && LK.LOOK_CSS.includes("body:has(.fit-look-" + id + ")")), "each look recolours the whole page while Fit is open");
ok(LK.FACTS.length >= 10 && LK.FACTS.every((f) => f.en.length > 30 && f.ar.length > 30 && f.src && f.src.en && f.src.ar && !/[a-z]{3}/i.test(f.ar.replace(/WHO|EFSA|USDA/g, ""))), "10+ facts, each in English and Arabic (no Latin words in the Arabic) with a source");
const o = LK.factOrder(42);
ok(o.length === LK.FACTS.length && new Set(o).size === o.length, "the facts come in a shuffled order, each once");

const it = (box, kcal = 100) => ({ name: "x", grams: 50, kcal, ...(box ? { box } : {}) });
const p1 = LK.placeMarks([it(null)]);
ok(p1.marks.length === 1 && p1.marks[0].x === 0.5 && p1.marks[0].y === 0.5 && !p1.loose.length, "one dish with no position (the fast look): its arrow points at the middle of the plate");
const p2 = LK.placeMarks([it([0.1, 0.1, 0.2, 0.2]), it([0.6, 0.1, 0.2, 0.2]), it(null)]);
ok(p2.marks.length === 2 && p2.loose.length === 1 && p2.loose[0] === 2, "foods with a position get arrows; one without is a chip at the bottom");
ok(p2.marks.find((m) => m.i === 0).side === "l" && p2.marks.find((m) => m.i === 1).side === "r", "a label sits on the side nearer its food");
const crowd = LK.placeMarks([0.20, 0.22, 0.24, 0.26].map((y) => it([0.1, y, 0.1, 0.02])));
const ys = crowd.marks.map((m) => m.ly).sort((a, b) => a - b);
ok(ys.every((y, i) => i === 0 || y - ys[i - 1] >= 0.129) && ys[ys.length - 1] <= 0.92, "four foods in a row on one side: their labels are spread apart, none off the photo");
