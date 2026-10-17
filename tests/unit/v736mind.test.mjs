// v6.32 Mind look A (the wall): a photo's main colour by name, colour counts, a link's preview hue.
import * as M from "../../web-src/mind.js";
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };
const cases = [[[210, 40, 35], "red"], [[230, 140, 50], "orange"], [[230, 200, 60], "yellow"], [[70, 160, 80], "green"], [[60, 165, 155], "teal"],
  [[60, 100, 210], "blue"], [[130, 80, 200], "purple"], [[215, 100, 160], "pink"], [[120, 80, 45], "brown"], [[240, 240, 236], "white"], [[128, 130, 134], "grey"], [[20, 22, 25], "black"]];
for (const [[r, g, b], want] of cases) ok(M.colourName(r, g, b) === want, `${r},${g},${b} → ${want} (${M.colourName(r, g, b)})`);
const px = new Uint8ClampedArray(16 * 4); for (let i = 0; i < 16; i++) px.set([60, 100, 210, 255], i * 4);
ok(M.mainColour(px) === "blue", "pixels → their main colour");
ok(M.mainColour(new Uint8ClampedArray(8)) === "", "fully transparent → no colour");
const cc = M.colourCounts([{ meta: { colour: "red" } }, { meta: { colour: "blue" } }, { meta: { colour: "red" } }, { meta: {} }, { meta: { colour: "nope" } }]);
ok(JSON.stringify(cc) === JSON.stringify([{ colour: "red", count: 2 }, { colour: "blue", count: 1 }]), "colour chips: most first, unknown names dropped");
ok(M.siteHue("liebherr.com") === M.siteHue("liebherr.com") && M.siteHue("a.com") !== M.siteHue("b.com"), "a site always gets the same preview colour");
if (fails) { console.log(fails + " FAILED"); process.exit(1); }
console.log("ALL PASSED");
