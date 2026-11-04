// v6.43 the photo editor (Ali: "exactly like my Honor phone"): the main subject is the big one near the middle; a tap hits the
// smallest shape that covers the point; boxes scale to the mask.
import { mainSubject, maskRect, hitSubject } from "../../web-src/photoedit.js";
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
const subs = [{ x: 20, y: 330, w: 60, h: 120, area: 7200 }, { x: 170, y: 40, w: 300, h: 400, area: 120000 }, { x: 560, y: 0, w: 80, h: 470, area: 30000 }];
ok(mainSubject(subs, 640, 480) === 1, "the main subject is the big one in the middle, not the tall one at the edge");
ok(mainSubject([], 640, 480) === -1, "no subjects → none");
ok(maskRect(subs[1], 2).join() === "340,80,600,800", "a box scales to the mask");
const full = () => 255;
ok(hitSubject(subs, 300, 200, full) === 1 && hitSubject(subs, 50, 400, full) === 0, "a tap hits the shape under it");
ok(hitSubject(subs, 5, 5, full) === -1, "a tap on nothing hits nothing");
const nested = [{ x: 0, y: 0, w: 640, h: 480, area: 300000 }, { x: 100, y: 100, w: 50, h: 50, area: 2500 }];
ok(hitSubject(nested, 120, 120, full) === 1, "a small thing in front of a big one: the small one");
ok(hitSubject(subs, 300, 200, () => 0) === -1, "inside the box but outside the shape: nothing");
console.log(bad ? bad + " FAILED" : "ALL PASSED");
