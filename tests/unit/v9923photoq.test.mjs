// v9.9.23 photo quality (Ali: "if the photo isn't clear make Attune tell take another clearer photo"): a 2,500 sample of tests/photoq/gen.mjs
// (sharp / blurred / dark / glare / too small, with sensor noise) must stay at 100%, plus the rules one by one.
import { run, make } from "../photoq/gen.mjs";
import * as Q from "../../web-src/photoquality.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const r = run(2500, 0); ok(r.pass === 2500, "2,500 generated photos: " + r.pass + " / 2500 " + JSON.stringify(r.bad.slice(0, 2)));
const h = run(500, 90000); ok(h.pass === 500, "500 held-out photos (seeds never tuned on): " + h.pass + " / 500");
ok(Q.quality({ gray: null, w: 0, h: 0 }).why === "unreadable", "no pixels → couldn't open it");
ok(Q.quality({ gray: new Uint8Array(300 * 200).fill(200), w: 300, h: 200 }).why === "small", "300×200 → too far / too small");
ok(Q.quality({ gray: new Uint8Array(800 * 600).fill(20), w: 800, h: 600 }).why === "dark", "all dark → too dark");
ok(Q.quality({ gray: new Uint8Array(800 * 600).fill(255), w: 800, h: 600 }).why === "glare", "burnt white → glare");
ok(Q.quality({ gray: new Uint8Array(800 * 600).fill(180), w: 800, h: 600 }).why === "blur", "a plain page with no edges at all → blurry");
const sharp = make(0); ok(sharp.want === "" && Q.quality(sharp).ok, "a sharp card → ok (sharpness " + Q.quality(sharp).sharp + ")");
for (const k of ["blur", "dark", "glare", "small", "unreadable", "unread"]) ok(typeof Q.ADVICE[k] === "string" && /another|again|closer/.test(Q.ADVICE[k]), "advice for " + k + " says what to do");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
