// v6.38 — answers' calculations re-done by code; repeated blocks removed. node tests/unit/v740mathcheck.test.mjs
import assert from "node:assert/strict";
import { evalExpr, sideValue, checkMath, dedupeAnswer } from "../../web-src/mathcheck.js";
assert.equal(evalExpr("2+3*4"), 14);
assert.ok(Math.abs(evalExpr("ln(4.0)/4") - 0.34657) < 1e-4);
assert.equal(evalExpr("2^3"), 8); assert.equal(evalExpr("√16"), 4); assert.equal(evalExpr("10⁻¹"), 0.1);
assert.equal(evalExpr("alert(1)"), null);
assert.equal(sideValue("(10.5 g/L - 0.5 g/L)/(25 g/L - 5 g/L)"), 0.5);
assert.equal(sideValue("0.34657 h⁻¹"), 0.34657);
assert.equal(sideValue("ln(X₂/X₁)/(t₂ − t₁)"), null, "variables are never guessed");
assert.equal(sideValue("μ"), null);
// Ali's screenshot, question 1 (from the model's LaTeX): the doubling time is 2.00 h, not 1.980 h
const q1 = String.raw`$$\mu = \frac{\ln(3.20 / 0.80)}{6 \text{ h} - 2 \text{ h}}$$
$$\mu = \frac{\ln(4.0)}{4 \text{ h}}$$
$$\mu \approx 0.34657 \text{ h}^{-1}$$
$$t_d = \frac{\ln(2)}{0.34657 \text{ h}^{-1}}$$
$$t_d = \frac{0.69315}{0.34657 \text{ h}^{-1}}$$
$$t_d \approx 1.980 \text{ h}$$
$$Y_{X/S} = \frac{10.5 \text{ g/L} - 0.5 \text{ g/L}}{25 \text{ g/L} - 5 \text{ g/L}} = \frac{10.0 \text{ g/L}}{20 \text{ g/L}} = 0.5$$`;
const r = checkMath(q1); if (process.env.DBG) console.log(JSON.stringify(r));
assert.ok(r.checked >= 2, "checked: " + r.checked);
// chained across lines the model writes t_d = … on separate lines; within one line the yield chain is right
assert.equal(r.wrong.length, 1, JSON.stringify(r.wrong)); assert.match(r.wrong[0].written, /1\.980/); assert.equal(r.wrong[0].value, "2");
const one = checkMath("t_d = ln(2)/0.34657 h⁻¹ = 0.69315/0.34657 ≈ 1.980 h");
assert.equal(one.wrong.length, 1); assert.equal(one.wrong[0].value, "2"); assert.match(one.wrong[0].written, /1\.980/);
assert.equal(checkMath("x = 5 + 5 = 10").wrong.length, 0);
assert.equal(checkMath("The yield is 0.5 = 50%").wrong.length, 0);
// repeats
const rep = "Intro text here.\n\n**Final Answer:**\na. exponential phase between 2 and 8 h\nb. glucose depleted at 10 h\n\n**Final Answer:**\na. The growth phase most like occurring between 2 and 8 h is exponential\n\nDone.";
const d = dedupeAnswer(rep);
assert.equal((d.match(/Final Answer/g) || []).length, 1); assert.match(d, /Done\./);
assert.equal(dedupeAnswer("A long paragraph about biomass yield and glucose consumed in batch.\n\nA long paragraph about biomass yield and glucose consumed in batch."), "A long paragraph about biomass yield and glucose consumed in batch.");
console.log("v740mathcheck: all passed");
// every half-written formula (as it streams) finishes — "\text" with no "{" yet used to loop forever
const { mathToText } = await import("../../web-src/quality.js");
const s = String.raw`$$t_d = \frac{0.69315}{0.34657 \text{ h}^{-1}} \approx 1.980 \mathrm{ h} \sqrt{4} \frac{a}{b}$$ and $Y_{X/S}$`;
const t0 = Date.now(); for (let k = 0; k <= s.length; k++) { mathToText(s.slice(0, k)); checkMath(s.slice(0, k)); }
assert.ok(Date.now() - t0 < 2000, "all prefixes in " + (Date.now() - t0) + " ms");
console.log("v740mathcheck: streaming prefixes passed");
