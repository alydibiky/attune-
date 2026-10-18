// v6.38 — research tables without blanks. node tests/unit/v740tableblanks.test.mjs
import assert from "node:assert/strict";
import { fillBlanks, isBlank, findValue } from "../../web-src/tableblanks.js";
const sources = [
  { url: "a", text: "The Lynk & Co 900 EM-P has a total output of 653 hp and does 0-100 km/h in 4.3 s. Prices start at CNY 265,900." },
  { url: "b", text: "Specs | Value\nThe 900 Max trim produces 870 hp. The 900 Max is priced at CNY 329,900." },
];
assert.ok(isBlank("—") && isBlank(" - ") && isBlank("N/A") && isBlank("") && !isBlank("653 hp"));
assert.deepEqual(findValue(sources, "900 EM-P", ["power", "Power", "", /\bpower|output|hp\b/i, /\d+\s?hp/i]), { value: "653 hp", n: 1 });
const md = `Intro.

| Version | Power | 0–100 km/h | Top speed | Price |
|---|---|---|---|---|
| 900 EM-P | — | — | — | — |
| 900 Max | 870 hp [2] | — | — | — |
| 900 Pro | — | — | — | — |

After.`;
const r = fillBlanks(md, sources);
assert.match(r.md, /\| 900 EM-P \| 653 hp \[1\] \| 4\.3 s \[1\] \| CNY 265,900 \[1\] \|/);
assert.match(r.md, /\| 900 Max \| 870 hp \[2\] \| not published \| CNY 329,900 \[2\] \|/);
assert.doesNotMatch(r.md, /Top speed/, "a column no source fills is dropped");
assert.doesNotMatch(r.md, /900 Pro/, "a row no source fills is dropped");
assert.doesNotMatch(r.md, /\| — \|/);
assert.match(r.md, /^Intro\./); assert.match(r.md, /After\.$/);
assert.equal(r.filled, 4);
// specs as rows, versions as columns
const md2 = "| Spec | 900 EM-P | 900 Max |\n|---|---|---|\n| Power | — | 870 hp |\n| Price | — | — |";
const r2 = fillBlanks(md2, sources, { ar: true });
assert.match(r2.md, /\| Power \| 653 hp \[1\] \| 870 hp \|/); assert.match(r2.md, /\| Price \| CNY 265,900 \[1\] \| CNY 329,900 \[2\] \|/);
assert.equal(fillBlanks("no tables here", sources).md, "no tables here");
console.log("v740tableblanks: all passed");
