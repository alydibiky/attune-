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
console.log("ALL PASSED v950theme (8 checks)");
