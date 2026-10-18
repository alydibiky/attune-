// v6.40 (W2) — the lift plan. node tests/unit/v740liftplan.test.mjs
import assert from "node:assert/strict";
import { liftPlan, planHtml } from "../../web-src/liftplan.js";
const base = { job: "Beam lift", site: "Port Said", crane: "LTM 1100", config: "full counterweight", radius: "14", boom: "40", capacity: "30", load: "18", hook: "0.8", rig: "0.4",
  craneMass: "48", counterweight: "22", matL: "1.2", matW: "1.2", soil: "dense_gravel", legs: 2, angle: 30, swl: "12", vChart: "9.8", area: "20", vNow: "6" };
const r = liftPlan(base);
assert.equal(r.checks.length, 4);
assert.equal(r.gross, 19.2);
assert.equal(r.checks[0].level, "ok");   // 19.2 / 30 = 64 %
assert.equal(r.checks.find((c) => c.id === "ground").level, "stop", "0.75 × (48 + 22 + 19.2) t on a 1.2 m mat is far over 300 kN/m²");
assert.equal(r.checks.find((c) => c.id === "slings").level, "ok");   // 18 / 2 × 1.155 = 10.39 t ≤ 12
assert.equal(r.overall, "stop");
const big = liftPlan({ ...base, matL: "4", matW: "4" });
assert.equal(big.checks.find((c) => c.id === "ground").level, "ok");
assert.equal(big.checks.find((c) => c.id === "wind").level, "caution", "a 20 m² load lowers the wind limit");
assert.equal(big.overall, "caution");
assert.equal(liftPlan({ ...base, matL: "4", matW: "4", load: "22.5", swl: "15" }).overall, "plan", "over 75 % of the chart: a critical lift");
assert.equal(liftPlan({ capacity: "", load: "" }).overall, "incomplete");
const h = planHtml({ ...base, matL: "4", matW: "4" });
assert.match(h, /GO WITH CARE/); assert.match(h, /Lift planner — name, signature, date/); assert.match(h, /Port Said/);
assert.doesNotMatch(planHtml({ ...base, job: "<script>x</script>" }), /<script>x/);
console.log("v740liftplan: all passed");
