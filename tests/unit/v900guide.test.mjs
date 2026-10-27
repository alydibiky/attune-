// v7.9 (Ali: "the guide must have everything that can be done in the app"): every page of the app sits in a life area of the
// guide with what you say and what you get; tried = opened, counted by area.
import { AREAS, SAY, areaOf, markTried, loadTried, progress } from "../../web-src/guide-areas.js";
import { HUBS, RETIRED } from "../../web-src/hubs.js";
import { TOOLS } from "../../web-src/guide.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const SKIP = new Set(["guide", "knowledge", ...RETIRED]);   // (v8.2: Instant / Ask classic are gone)   // the guide itself; Knowledge is the developer's only (v7.9)
const pages = [...new Set([...HUBS.flatMap((h) => h[3]), ...Object.keys(TOOLS)])].filter((m) => !SKIP.has(m));
const noArea = pages.filter((m) => !areaOf(m)), noSay = pages.filter((m) => !SAY[m]);
ok(!noArea.length, "every page of the app has a life area" + (noArea.length ? ": missing " + noArea.join(", ") : ` (${pages.length})`));
ok(!noSay.length, "every page has “You say → You get”" + (noSay.length ? ": missing " + noSay.join(", ") : ""));
const twice = AREAS.flatMap((a) => a.ids).filter((x, i, l) => l.indexOf(x) !== i);
ok(!twice.length, "no feature is in two areas" + (twice.length ? ": " + twice : ""));
ok(Object.values(SAY).every(([s, g]) => s.length === 2 && g.length === 2 && s.every(Boolean) && g.every(Boolean)), "each example in English and Egyptian Arabic");
ok(!AREAS.some((a) => a.ids.includes("knowledge")), "Knowledge is in no area (only the developer adds knowledge)");
const mem = { d: {}, getItem(k) { return this.d[k] || null; }, setItem(k, v) { this.d[k] = v; } };
ok(markTried("fit", mem) && !markTried("fit", mem) && !markTried("nonsense", mem) && loadTried(mem).join() === "fit", "opening a page marks it tried, once; unknown pages are not kept");
markTried("care", mem);
const h = progress(loadTried(mem), "health"), all = progress(loadTried(mem));
ok(h.tried === 2 && h.total === 4 && all.tried === 2 && all.total === AREAS.reduce((a, x) => a + x.ids.length, 0), "progress by area and in all: " + JSON.stringify([h, all]));
ok(progress([], "work", (id) => id !== "crane").total === 12, "a feature this device doesn't have isn't counted (the crane toolkit for non-fleet users)");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
