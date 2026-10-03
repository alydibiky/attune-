// Unit tests for heat & speed phase 2: the heat level from Android's thermal status and
// headroom forecast, the Speed-screen warning, and its Arabic (no Latin letters).
const H = await import("../../web-src/heat.js");
const { AR } = await import("../../web-src/i18n-ar.js");
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

eq(H.heatLevel(null), 0, "no report → cool");
eq(H.heatLevel({ thermal: 0, thermalHeadroom: -1 }), 0, "status none, headroom unknown → cool");
eq(H.heatLevel({ thermal: 0, thermalHeadroom: 0.5 }), 0, "headroom 0.5 → cool");
eq(H.heatLevel({ thermal: 0, thermalHeadroom: 0.85 }), 1, "headroom 0.85 → warming");
eq(H.heatLevel({ thermal: 1 }), 1, "status light → warming");
eq(H.heatLevel({ thermal: 0, thermalHeadroom: 0.97 }), 2, "headroom ≥ 0.95 → hot (same as moderate)");
eq(H.heatLevel({ thermal: 2, thermalHeadroom: -1 }), 2, "status moderate → hot");
eq(H.heatLevel({ thermal: 3 }), 3, "status severe → very hot");
eq(H.heatLevel({ thermal: 5 }), 4, "status emergency → critical");
eq(H.heatLevel({ thermal: 0, thermalHeadroom: NaN }), 0, "NaN headroom ignored");
eq(H.heatWarning({ thermal: 0 }), null, "cool → no warning");
eq(H.heatWarning({ thermal: 1 })[0], "warn", "warming → a soft warning");
eq([2, 3, 4].map((t) => H.heatWarning({ thermal: t })[0]), ["bad", "bad", "bad"], "hot / very hot / critical → strong warning");

const latin = /[A-Za-z]/;
for (const t of [0.85, 1, 2, 3, 4]) {
  const w = t < 1 ? H.heatWarning({ thermal: 0, thermalHeadroom: t }) : H.heatWarning({ thermal: t });
  const ar = AR[w[1]];
  eq([!!ar, ar ? latin.test(ar) : null], [true, false], `Arabic for level ${t} exists and has no Latin letters`);
}
eq(latin.test(AR[" · warm — running cooler"] || "x"), false, "status-line heat note in Arabic has no Latin letters");

if (fails.length) { console.log(fails.length + " FAILED"); process.exit(1); }
console.log("v620heat: all passed");
