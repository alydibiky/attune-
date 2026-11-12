// v9.9.19 (Ali's Agents screenshot, 12 Nov): "Huawei FreeClip 2 · EGP 120" still shown (a saved offer from before the v9.8 rule, and
// with one or two prices there was no middle to compare); hotel dates "01/08 → 01/12" (January or August?); "Best on Amazon · noon"
// over "Amazon · noon".
import fs from "fs";
import * as A from "../../web-src/agents.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const a = { what: "Huawei FreeClip 2", said: "Huawei free clips 2", currency: "EGP" };
ok(!A.believable({ name: "Huawei FreeClip 2", price: 120, currency: "EGP" }, a), "EGP 120 is not a Huawei FreeClip 2 (a case or a fake)");
ok(A.believable({ name: "Huawei FreeClip 2", price: 7999, currency: "EGP" }, a), "EGP 7,999 is believable");
ok(A.bestAcross([{ name: "Huawei FreeClip 2", price: 120, site: "amazon.eg", currency: "EGP" }], a).length === 0, "a single EGP 120 offer is left out, even with no other price to compare");
ok(A.bestAcross([{ name: "Huawei FreeClip 2 earbuds", price: 120, site: "amazon.eg", currency: "EGP" }, { name: "Huawei FreeClip 2", price: 8100, site: "noon.com", currency: "EGP" }], a)[0].price === 8100, "with two offers, the real one is the best");
ok(!A.believable({ name: "Galaxy Buds 3", price: 25, currency: "SAR" }, { what: "Samsung Galaxy Buds 3", currency: "SAR" }) && A.believable({ name: "Galaxy Buds 3", price: 499, currency: "SAR" }, { what: "Samsung Galaxy Buds 3", currency: "SAR" }), "the same floor in Saudi riyals");
ok(A.believable({ name: "Rice 5 kg", price: 120, currency: "EGP" }, { what: "rice 5 kg", currency: "EGP" }), "a cheap thing that is not a gadget keeps its price");
const ui = fs.readFileSync(new URL("../../web-src/agents-ui.jsx", import.meta.url), "utf8");
ok(/\(a\.best3 \|\| \[\]\)\.filter\(\(o\) => o && A\.believable\(o, a\)\)/.test(ui) && /A\.believable\(fb, a\)/.test(ui) && /export const offersOf = \(a\) => A\.knownOffers\(a\)\.filter\(\(o\) => A\.believable\(o, a\)\)/.test(ui), "saved offers are re-checked for believable prices only — 10 hotels on one site stay 10");
ok(!/checkin\.slice\(5\)\.replace\("-", "\/"\)/.test(ui) && /dWords\(o\.checkin\) \+ " → " \+ dWords\(o\.checkout\)/.test(ui), "hotel dates in words with the weekday (Thu 8 Jan → Mon 12 Jan), never 01/08 → 01/12");
const d = new Date("2027-01-08T12:00:00").toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short" });
ok(/Fri/.test(d) && /Jan/.test(d) && /8/.test(d), "the words read e.g. " + d);
ok(/o\.name && !R\.isSiteName\(o\.name, a\.site\) \? A\.siteOfOffer\(o\) : ""/.test(ui), "the site is said once (no 'Best on Amazon · noon' over 'Amazon · noon')");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
