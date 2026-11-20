// v10.8 (Ali, 20 Nov: "translate the travel guides"): every line a travel guide SHOWS (apps, arrival, overcharges, emergency,
// money, power, water, visa, best time, tipping, haggling, SIM, connection — 43 countries) and every phrase's meaning has its
// Egyptian Arabic, with the same numbers (phone numbers, prices, percentages) kept exactly.
import fs from "fs";
const AR = (await import("../../web-src/i18n-ar.js")).AR;
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const s = fs.readFileSync(new URL("../../web-src/attune.jsx", import.meta.url), "utf8"), a = s.indexOf("const COUNTRY_PACKS = {"), b = s.indexOf("\n};\n", a);
const P = new Function("return " + s.slice(a + "const COUNTRY_PACKS = ".length, b + 2))();
const F = ["apps", "arrival", "scams", "emergency", "currency", "plug", "water", "visa", "best", "tipping", "haggle", "sim", "connectivity"];
const lines = new Set(); for (const p of Object.values(P)) { for (const f of F) { const v = p[f]; if (Array.isArray(v)) v.forEach((x) => lines.add(x)); else if (v) lines.add(v); } (p.phrases || []).forEach((x) => x.en && lines.add(x.en)); }
ok(Object.keys(P).length === 43 && lines.size > 800, "43 guides, " + lines.size + " lines shown");
const miss = [...lines].filter((x) => !AR[x]); ok(!miss.length, "every shown line in Egyptian Arabic — missing: " + miss.slice(0, 3).join(" | "));
const nums = [...lines].filter((x) => AR[x] && (x.match(/\d+(?:[.,]\d+)?/g) || []).some((d) => !AR[x].includes(d)));
ok(!nums.length, "every number kept exactly (Western digits, like the rest of the app): " + nums.slice(0, 2).join(" | "));
ok(!Object.values(AR).some((v) => /[٠-٩]/.test(v) && /[0-9]/.test(v)), "no line mixes Eastern and Western digits");
const ui = fs.readFileSync(new URL("../../web-src/travel-ui.jsx", import.meta.url), "utf8");
ok(/\|\| tr\(ph\.en\)/.test(ui) && /const whole = tr\(a\)/.test(ui) && /asOfShown/.test(ui), "the page shows them (phrase meanings, whole app lines, the checked date)");
console.log(fail ? `FAIL ${fail}/${n}` : `PASS ${n}/${n}`); process.exit(fail ? 1 : 0);
