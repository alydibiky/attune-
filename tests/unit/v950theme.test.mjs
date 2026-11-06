// v9.5 (Ali, 5 Nov phone test): "not all background colours work" + "I don't like the green — make it burgundy"
import assert from "node:assert/strict";
const LS = {}; globalThis.localStorage = { getItem: (k) => LS[k] ?? null, setItem: (k, v) => { LS[k] = String(v); }, removeItem: (k) => delete LS[k] };
const S = await import("../../web-src/spaces.js");
// every background × every accent gives its own tokens on the redesigned screens
const seen = new Set();
for (const [bg] of S.BACKGROUNDS.filter(([b]) => b !== "auto")) {
  const v = S.calmVars({ accent: "burgundy", bg });
  for (const k of ["--c-bg", "--c-surf", "--c-ink", "--c-acc", "--c-soft"]) assert.match(v[k], /^#[0-9A-F]{6}$/i, bg + " " + k);
  seen.add(v["--c-bg"]);
}
assert.equal(seen.size, 5, "Midnight, Black, Graphite, Warm and Light each have their own ground");
const accs = new Set(S.ACCENTS.map(([a]) => S.calmVars({ accent: a, bg: "light" })["--c-acc"]));
assert.equal(accs.size, S.ACCENTS.length, "each colour is its own accent");
assert.equal(S.calmVars({ accent: "burgundy", bg: "light" })["--c-acc"], "#7A1F3D");
assert.equal(S.calmVars({ accent: "burgundy", bg: "black" })["--c-bg"], "#000000");
assert.ok(S.calmCss({ accent: "violet", bg: "stone" }).startsWith("html.att-themed.att-themed .calm{"));
// the old green default moves to burgundy once; a colour chosen afterwards stays
LS["attune:theme"] = undefined;
const t0 = S.loadTheme(); assert.equal(t0.accent, "burgundy");
S.saveTheme({ accent: "emerald", bg: "light" }); assert.equal(S.loadTheme().accent, "emerald", "a green chosen in Settings is kept");
assert.ok(S.PALETTES.burgundy && S.ACCENTS[0][0] === "burgundy");
// v9.6 C1 "quiet burgundy" (Ali: "calm and clear"): soft buttons, calm chart colours (never all red), neutral ground
const q = S.calmVars({ accent: "burgundy", bg: "light" });
assert.equal(q["--c-btn"], "#F5E6EB"); assert.equal(q["--c-on-btn"], "#7A1F3D", "big buttons: light tint, burgundy text");
assert.deepEqual([q["--c-chart-1"], q["--c-chart-2"], q["--c-chart-3"], q["--c-chart-4"]], ["#2A9D8F", "#E0A13B", "#4C7DD9", "#9AA0A6"]);
assert.equal(q["--c-bg"], "#F5F4F2", "a neutral grey ground, no pink tint");
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
assert.ok(ratio(q["--c-on-btn"], q["--c-btn"]) >= 7, "button text reads easily (≥7:1)");
assert.ok(ratio(q["--c-ink"], q["--c-bg"]) >= 12 && ratio(q["--c-mut"], q["--c-bg"]) >= 5.5, "text and grey text on the ground read easily");
const qd = S.calmVars({ accent: "burgundy", bg: "slate" });
assert.ok(ratio(qd["--c-on-btn"], qd["--c-btn"]) >= 6 && ratio(qd["--c-ink"], qd["--c-bg"]) >= 12, "the same in dark");
// v9.7.2 (Ali: "that wasn't the colours we agreed on" — Rose was picked on his phone): C1 holds for EVERY colour
for (const [acc] of S.ACCENTS) for (const bg of ["light", "slate"]) {
  const v = S.calmVars({ accent: acc, bg });
  assert.deepEqual([v["--c-chart-1"], v["--c-chart-2"], v["--c-chart-3"], v["--c-chart-4"]].map((x) => x.toUpperCase()), (bg === "light" ? ["#2A9D8F", "#E0A13B", "#4C7DD9", "#9AA0A6"] : ["#4FC2B4", "#E8B04B", "#7FA6EE", "#8E949B"]), acc + " " + bg + ": calm charts, never all one colour");
  assert.ok(v["--c-btn"] && ratio(v["--c-on-btn"], v["--c-btn"]) >= 4.5, acc + " " + bg + ": soft buttons that read easily");
  if (bg === "light" && !["emerald", "teal"].includes(acc)) assert.equal(v["--c-bg"], "#F5F4F2", acc + ": the neutral ground, no pink");
}
console.log("ALL PASSED v950theme (16 + 36 checks)");
