// v9.8 C6 (Ali picked "each area its own colour"): Money green, Agents blue, Follow-ups amber, Documents violet — readable in light
// and dark, the area's page gets its colour as the accent, the theme colour stays everywhere else
globalThis.localStorage = { _: {}, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = String(v); }, removeItem(k) { delete this._[k]; } };
import assert from "node:assert/strict";
const S = await import("../../web-src/spaces.js");
const lum = (h) => { const c = h.replace("#", "").match(/../g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
let n = 0;
for (const [k, v] of Object.entries(S.AREA)) {
  assert.ok(ratio(v.l[0], "#FFFFFF") >= 4.5, k + " light text on white ≥ 4.5"); n++;
  assert.ok(ratio(v.l[0], v.l[1]) >= 4.5, k + " light text on its soft button ≥ 4.5"); n++;
  assert.ok(ratio(v.d[0], "#1C1B1B") >= 4.5, k + " dark text on the dark card ≥ 4.5"); n++;
  assert.ok(ratio(v.d[0], v.d[1]) >= 4.5, k + " dark text on its soft button ≥ 4.5"); n++;
}
const css = S.calmCss({ accent: "burgundy", bg: "light" });
for (const k of ["money", "agents", "fu", "docs"]) { assert.ok(css.includes(`[data-area="${k}"] .calm{--c-acc:`) && css.includes(`--c-area-${k}:`), k + " page colour + token"); n++; }
assert.ok(/--c-acc:#7A1F3D/.test(css), "the theme colour stays for the rest of the app"); n++;
assert.equal(S.AREA_OF.money, "money"); assert.equal(S.AREA_OF.agents, "agents"); assert.equal(S.AREA_OF.timeline, "fu"); assert.equal(S.AREA_OF.pdfchat, "docs"); n += 4;
console.log(`ALL PASSED v980c6 (${n} checks)`);
