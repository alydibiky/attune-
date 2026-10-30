// v6.32: more interface languages (French, Spanish, Turkish). Each dictionary keeps every {placeholder}, has no empty lines,
// covers most of the first screens, and English / Arabic behave as before.
import { FR } from "../../web-src/i18n-fr.js";
import { ES } from "../../web-src/i18n-es.js";
import { TRK } from "../../web-src/i18n-tr.js";
import { AR } from "../../web-src/i18n-ar.js";
import { PT } from "../../web-src/i18n-pt.js";
import { HI } from "../../web-src/i18n-hi.js";
import { IDN } from "../../web-src/i18n-id.js";
import { UR } from "../../web-src/i18n-ur.js";
const NEW = {};
for (const [c, n] of [["de", "DE"], ["it", "IT"], ["ru", "RU"], ["zh", "ZH"], ["ja", "JA"], ["ko", "KO"], ["fa", "FA"], ["bn", "BN"], ["vi", "VI"], ["th", "TH"], ["sw", "SW"]])
  NEW[c] = (await import("../../web-src/i18n-" + c + ".js"))[n];
import fs from "node:fs";

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };
globalThis.localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = String(v); } };
const I = await import("../../web-src/i18n.js");

ok(I.LANGS.map((x) => x[0]).join(",") === "en,ar,arb,fr,es,tr,pt,hi,id,ur,de,it,ru,zh,ja,ko,fa,bn,vi,th,sw", "21 languages in the switch (v6.49 at least 20; v8.8 Egyptian + Standard Arabic)");
const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join(",");
for (const [name, d] of [["fr", FR], ["es", ES], ["tr", TRK], ["pt", PT], ["hi", HI], ["id", IDN], ["ur", UR], ...Object.entries(NEW)]) {
  const keys = Object.keys(d);
  ok(keys.length >= 600, `${name}: ${keys.length} lines`);
  ok(keys.every((k) => typeof d[k] === "string" && d[k].trim()), `${name}: no empty translation`);
  const bad = keys.filter((k) => ph(k) !== ph(d[k]));
  ok(!bad.length, `${name}: placeholders kept` + (bad.length ? " — " + bad.slice(0, 3).join(" | ") : ""));
  // every key is a line the app really shows (Arabic has it, or it is in the source)
  const src = fs.readdirSync("web-src").filter((f) => /\.(js|jsx)$/.test(f) && !/^i18n-/.test(f)).map((f) => fs.readFileSync("web-src/" + f, "utf8")).join("\n");
  const stray = keys.filter((k) => !(k in AR) && !src.includes(JSON.stringify(k).slice(1, -1)) && !src.includes(k));
  ok(stray.length <= 10, `${name}: keys come from the app (${stray.length} not found)`);
}

I.setLang("fr", { reload: false });
ok(I.tr("Save") === "Enregistrer" && I.tr("{n} tools", { n: 5 }) === "5 outils", "French shows");
ok(I.tr("A line nobody translated") === "A line nobody translated", "missing line stays English");
ok(!I.isRTL() && I.dateLocale() === "fr-FR", "French is left-to-right, French dates");
I.setLang("tr", { reload: false });
ok(I.tr("Save") === "Kaydet", "Turkish shows");
I.setLang("ur", { reload: false });
ok(I.isRTL() && I.tr("Save") === UR["Save"] && I.dateLocale() === "ur-PK-u-nu-latn", "Urdu is right-to-left, Western digits");
I.setLang("fa", { reload: false });
ok(I.isRTL() && I.tr("Save") === NEW.fa["Save"] && /latn/.test(I.dateLocale()), "Persian is right-to-left, Western digits");
I.setLang("ja", { reload: false });
ok(!I.isRTL() && I.tr("Save") === NEW.ja["Save"], "Japanese shows");
I.setLang("pt", { reload: false });
ok(!I.isRTL() && I.tr("Save") === PT["Save"] && I.tr("{n} tools", { n: 5 }).startsWith("5 "), "Portuguese shows");
I.setLang("ar", { reload: false });
ok(I.isRTL() && I.tr("Save") === AR["Save"], "Arabic unchanged");
I.setLang("en", { reload: false });
ok(I.tr("Save") === "Save" && I.dateLocale() === undefined, "English unchanged");
I.setLang("xx", { reload: false });
ok(I.getLang() === "en", "an unknown language falls back to English");
localStorage.setItem("ledger.v3", JSON.stringify({ lang: "en" }));
I.setLang("es", { reload: false });
ok(JSON.parse(localStorage.getItem("ledger.v3")).lang === "en", "the Money ledger stays English for Spanish");

if (fails) { console.log(fails + " FAILED"); process.exit(1); }
console.log("ALL PASSED");
