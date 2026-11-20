// v10.8 (launch, "smaller first install"): the shipped language files (www/i18n/<id>.js) leave out the lines of removed features —
// but EVERY line the code asks for by name (tr("…") / T("…")) must still be there, in every language, or a screen would show English.
import fs from "fs"; import path from "path";
const R = (p) => new URL("../../" + p, import.meta.url);
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const files = fs.readdirSync(R("web-src")).filter((f) => /\.(jsx?|mjs)$/.test(f) && !/^i18n-/.test(f));
const asked = new Set();
for (const f of files) { const s = fs.readFileSync(path.join(R("web-src").pathname, f), "utf8");
  for (const m of s.matchAll(/\b(?:tr|T)\(\s*"((?:[^"\\]|\\.)+)"/g)) { try { asked.add(JSON.parse('"' + m[1] + '"')); } catch (e) {} } }
ok(asked.size > 3000, "found the lines the code asks for: " + asked.size);
const M = { arb: "ARB", fr: "FR", es: "ES", tr: "TRK", pt: "PT", hi: "HI", id: "IDN", ur: "UR", de: "DE", it: "IT", ru: "RU", zh: "ZH", ja: "JA", ko: "KO", fa: "FA", bn: "BN", vi: "VI", th: "TH", sw: "SW" };
let full = 0, shipped = 0;
for (const [l, nm] of Object.entries(M)) {
  const all = (await import(R("web-src/i18n-" + l + ".js").href))[nm];
  const raw = fs.readFileSync(R("app/src/main/assets/www/i18n/" + l + ".js"), "utf8"); const out = JSON.parse(raw.slice(raw.indexOf("]=") + 2).replace(/;\s*$/, ""));
  full += Object.keys(all).length; shipped += Object.keys(out).length;
  const missing = [...asked].filter((k) => all[k] && !(k in out));
  ok(!missing.length, l + ": every line the code asks for is shipped (missing: " + missing.slice(0, 3).join(" | ") + ")");
  ok(Object.keys(out).every((k) => out[k] === all[k]), l + ": shipped lines are the same as the dictionary's");
}
ok(shipped < full * 0.9, "the shipped files are smaller (removed features' lines left out): " + shipped + " of " + full);
console.log(fail ? `FAIL ${fail}/${n}` : `PASS ${n}/${n}`); process.exit(fail ? 1 : 0);
