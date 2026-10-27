import assert from "node:assert/strict";
import { makerOf, makerNote, fixMakerCountry } from "../../web-src/makers.js";
import { tidyAnswer } from "../../web-src/answerfix.js";
import { fillBlanks } from "../../web-src/tableblanks.js";
import { answerTemplate } from "../../web-src/research.js";

// the maker's country is a fact the app knows
assert.equal(makerOf("Lynk & Co 900 specs").country, "China");
assert.equal(makerOf("lynk and co 09").maker, "Geely Holding");
assert.equal(makerOf("Hyundai Tucson price").country, "South Korea");
assert.equal(makerOf("how is the weather"), null);
assert.match(makerNote("Lynk & Co 900"), /Chinese brand.*Geely/);
const q = "Lynk & Co 900 specs";
let r = fixMakerCountry("**Overview — Lynk & Co 900 is an SUV from South Korea, featuring plug-in hybrid powertrains [2].**", q);
assert.match(r.text, /SUV from China/); assert.equal(r.fixed, 1);
r = fixMakerCountry("The Lynk & Co 900 is a Korean SUV.", q);
assert.match(r.text, /a Chinese SUV/);
r = fixMakerCountry("Its rival, the Hyundai Palisade, is a South Korean SUV.", q);   // a rival keeps its own country
assert.match(r.text, /South Korean SUV/);
r = fixMakerCountry("لينك آند كو 900 عربية من كوريا الجنوبية", "لينك آند كو 900");
assert.match(r.text, /من الصين/);
assert.equal(fixMakerCountry("Lynk & Co 900 is from China.", q).fixed, 0);

// "Prices … are available" with no price, and a sentence cut in the middle, are dropped
const t = tidyAnswer("## Prices\n- Prices in Egypt in EGP are available for the Lynk & Co 900 2026 [1].\n- Official price: EGP 3,250,000 [1].\n\n## Reliability\n- It has been reliable so far [3].\n- Official safety recalls for the model years given are not");
assert.doesNotMatch(t, /are available/);
assert.match(t, /3,250,000/);
assert.doesNotMatch(t, /are not$/);
assert.match(tidyAnswer("- The price is available from EGP 2,900,000 [1]."), /2,900,000/);

// the template's table line has no extra words a model copies as a column
const tpl = answerTemplate("Lynk & Co 900", "vehicle");
const tableLine = tpl.split("\n").find((l) => /Trims and versions/.test(l));
assert.match(tableLine, /\| Price \(home currency\) \|$/);

// Ali's answer: the empty columns go
const ali = "| Trim | Power (hp) | Torque (Nm) | Price (USD) | — official price; and the market price |\n| :--- | :--- | :--- | :--- | :--- |\n| EM-P 2.0T | 884 Hp | — | — | — |";
const fb = fillBlanks(tidyAnswer(ali), []);
assert.doesNotMatch(fb.md, /Torque|official price/);
console.log("v840web ok");
