// node merge.mjs [lang…] — puts out/<lang>/*.json (+ fixes.json) into web-src/i18n-<lang>.js (only lines that pass the checks)
import fs from "fs";
const BASE = new URL(".", import.meta.url).pathname, WEB = new URL("../../web-src/", import.meta.url).pathname;
const NAME = { fr: "FR", es: "ES", tr: "TRK", pt: "PT", hi: "HI", id: "IDN", ur: "UR", de: "DE", it: "IT", ru: "RU", zh: "ZH", ja: "JA", ko: "KO", fa: "FA", bn: "BN", vi: "VI", th: "TH", sw: "SW", arb: "ARB" };
const ph = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(",");
const master = new Set(JSON.parse(fs.readFileSync(BASE + "master.json", "utf8")).map((x) => x.en));
for (const lang of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(NAME)) {
  const file = WEB + "i18n-" + lang + ".js", N = NAME[lang];
  const d = { ...(await import(file + "?t=" + Date.now()))[N] };
  let added = 0, fixed = 0, skipped = 0;
  const dir = BASE + "out/" + lang + "/"; if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((f) => /^\d+\.json$/.test(f)).sort()) {
    let o; try { o = JSON.parse(fs.readFileSync(dir + f, "utf8")); } catch (e) { console.log(lang, f, "bad JSON"); continue; }
    for (const [k, v] of Object.entries(o)) { if (typeof v !== "string" || !v.trim() || ph(k) !== ph(v) || !master.has(k)) { skipped++; continue; } if (!(k in d)) added++; d[k] = v; }
  }
  if (fs.existsSync(dir + "fixes.json")) for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(dir + "fixes.json", "utf8")))) { if (typeof v === "string" && v.trim() && ph(k) === ph(v) && k in d) { d[k] = v; fixed++; } }
  const head = fs.readFileSync(file, "utf8").split(/export const \w+ = \{/)[0];
  fs.writeFileSync(file, head + `export const ${N} = {\n` + Object.entries(d).map(([k, v]) => "  " + JSON.stringify(k) + ": " + JSON.stringify(v) + ",").join("\n") + "\n};\n");
  console.log(`${lang}: ${Object.keys(d).length} lines (+${added} new, ${fixed} fixed, ${skipped} skipped) — ${Math.round(100 * [...master].filter((k) => k in d).length / master.size)}% of the app`);
}
