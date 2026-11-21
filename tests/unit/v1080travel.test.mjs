// v10.8 (Ali, 20 Nov: "translate the travel guides"): every line a travel guide SHOWS (apps, arrival, overcharges, emergency,
// money, power, water, visa, best time, tipping, haggling, SIM, connection — 43 countries) and every phrase's meaning has its
// Egyptian Arabic, with the same numbers (phone numbers, prices, percentages) kept exactly.
// v10.8 later (Ali: "do the 5 main languages now and the others"): the same for every language that is finished (DONE grows to all 19).
import fs from "fs";
const AR = (await import("../../web-src/i18n-ar.js")).AR;
const DONE = { arb: "ARB", es: "ES", fr: "FR", tr: "TRK", hi: "HI", de: "DE", pt: "PT", it: "IT", ru: "RU", id: "IDN", ur: "UR", fa: "FA", bn: "BN", sw: "SW", th: "TH", vi: "VI", zh: "ZH", ja: "JA", ko: "KO" };
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
// in other languages a decimal comma (3,75) or a thousands dot is fine — the digits must be the same
const digits = (t) => t.replace(/(\d)[.,](?=\d)/g, "$1");
for (const [id, ex] of Object.entries(DONE)) {
  const L = (await import("../../web-src/i18n-" + id + ".js"))[ex];
  const m = [...lines].filter((x) => !L[x]); ok(!m.length, id + ": every shown line translated — missing " + m.length + ": " + m.slice(0, 2).join(" | "));
  const bad = [...lines].filter((x) => L[x] && (digits(x).match(/\d+/g) || []).some((d) => !digits(L[x]).includes(d)));
  ok(!bad.length, id + ": every number kept: " + bad.slice(0, 2).map((x) => x + " → " + L[x]).join(" | "));
  const same = [...lines].filter((x) => L[x] === x && /[a-z]{4,} [a-z]{4,} [a-z]{4,}/.test(x)); ok(same.length < 25, id + ": sentences really translated, not copied (" + same.length + " copied)");
}
// v10.8 later: the guide's deeper sections on the Know tab (money, manners, health, costs, getting around, food, laws, dangers,
// holidays, customs, numbers) — 1,140 more lines; DEEP grows as each language is finished (main languages first, Ali 21 Nov)
const DEEP = { ar: "AR", arb: "ARB", es: "ES" };
const F2 = ["money", "etiquette", "health", "costs", "getAround", "eat", "laws", "dangers", "holidays", "customs", "numbers"];
const deep = new Set(); for (const p of Object.values(P)) for (const f of F2) (p[f] || []).forEach((x) => deep.add(x));
ok(deep.size > 1100, "the deeper sections: " + deep.size + " lines");
for (const [id, ex] of Object.entries(DEEP)) {
  const L = (await import("../../web-src/i18n-" + id + ".js"))[ex];
  const m = [...deep].filter((x) => !L[x]); ok(!m.length, id + ": every deeper line translated — missing " + m.length + ": " + m.slice(0, 2).join(" | "));
  const bad = [...deep].filter((x) => L[x] && (digits(x).match(/\d+/g) || []).some((d) => !digits(L[x]).includes(d)));
  ok(!bad.length, id + ": every number kept in the deeper lines: " + bad.slice(0, 2).map((x) => x + " → " + L[x]).join(" | "));
}
const ui = fs.readFileSync(new URL("../../web-src/travel-ui.jsx", import.meta.url), "utf8");
ok(/\|\| tr\(ph\.en\)/.test(ui) && /const whole = tr\(a\)/.test(ui) && /asOfShown/.test(ui), "the page shows them (phrase meanings, whole app lines, the checked date)");
console.log(fail ? `FAIL ${fail}/${n}` : `PASS ${n}/${n}`); process.exit(fail ? 1 : 0);
