// Unit tests for v5.17: sums corrected, VAT sums detected, Business designs
// checked, queries/forms from a sentence, related records, preview links.
import { arithmeticSlips, fixSlips, looksLikeMathProblem } from "../../web-src/verify.js";
import { htmlDoc } from "../../web-src/sandbox.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

// ---- Ali's "And with 5 cranes" screenshot ----
const a = "**Total: 453,000 EGP**\n1. 5 × 4 × 25,000 = **500,000**\n2. 14% of 500,000 = 70,000\n3. 500,000 + 70,000 = **453,000**";
const sl = arithmeticSlips(a);
eq(sl.map((x) => x.right), [570000], "a wrong sum on a numbered line is caught (500,000 + 70,000 ≠ 453,000)");
const f = fixSlips(a, sl);
eq([f.fixed, f.text.includes("Total: 570,000 EGP"), f.text.includes("= **570,000**"), f.text.includes("453")], [1, true, true, false], "…and corrected everywhere, the Total line too");
eq(fixSlips("x = 1,000,453,000", [{ expr: "1 + 1 = 453,000", right: 2 }]).text, "x = 1,000,453,000", "only whole numbers are replaced, not digits inside bigger ones");
eq(looksLikeMathProblem("3 cranes × 4 days × 25,000 EGP + 14% VAT"), true, "a priced sum with VAT goes to the checked maths route");

// (v9.1: the Business part of this test is archived in archive/business/tests/unit/v517.test.mjs)
// (v9.1: the Business part of this test is archived in archive/business/tests/unit/v517.test.mjs)
// (v9.1: the Business part of this test is archived in archive/business/tests/unit/v517.test.mjs)
// (v9.1: the Business part of this test is archived in archive/business/tests/unit/v517.test.mjs)
// ---- previews keep links inside the page ----
const doc = htmlDoc("<html><head></head><body><a href='#menu'>Menu</a></body></html>", "t1");
eq(doc.includes('closest("a[href]")') && doc.includes('addEventListener("submit"'), true, "previewed pages handle #links and forms themselves (no reloading Attune inside)");

console.log(fails.length ? fails.length + " FAILED" : "ALL PASSED");
if (fails.length) process.exit(1);
