// v10.8 (launch, Ali: smaller first install): each interface language is its own file (www/i18n/<id>.js, v8.9) and now
// carries ONLY the lines the shipped code can show. A line is kept when its English text appears anywhere in the code
// (web-src without the dictionaries, the Android app, the desktop app) — case ignored, so labels made by changing
// case ("personal" → "Personal") are kept. Removed features' lines stay in web-src/i18n-<id>.js (their code is archived,
// one prompt brings them back) but are not shipped. Run by build.sh: node build/i18n-split.mjs <out dir>
import fs from "fs"; import path from "path";
const out = process.argv[2], here = process.cwd();
const M = { ar: "AR", arb: "ARB", fr: "FR", es: "ES", tr: "TRK", pt: "PT", hi: "HI", id: "IDN", ur: "UR", de: "DE", it: "IT", ru: "RU", zh: "ZH", ja: "JA", ko: "KO", fa: "FA", bn: "BN", vi: "VI", th: "TH", sw: "SW" };
let corpus = "";
const walk = (d) => { let list = []; try { list = fs.readdirSync(d); } catch (e) { return; }
  for (const f of list) { const p = path.join(d, f); let st; try { st = fs.statSync(p); } catch (e) { continue; }
    if (st.isDirectory()) { if (/^(\.pyodide-cache|node_modules|vendor|test|dist|build-out|\.cache)$/.test(f)) continue; walk(p); }
    else if (/\.(jsx?|mjs|cjs|json|html|txt|kt|xml)$/.test(f) && !/^i18n-/.test(f) && st.size < 8e6) corpus += fs.readFileSync(p, "utf8") + "\n"; } };
walk(here); walk(path.join(here, "../app/src/main/java")); walk(path.join(here, "../app/src/main/res")); walk(path.join(here, "../desktop"));
corpus = corpus.toLowerCase();
const t0 = Date.now();
const seen = new Map();   // the English lines are the same in every language: each is looked for once
const used = (k) => { let r = seen.get(k); if (r === undefined) { const kl = k.toLowerCase(); r = corpus.includes(kl) || (/["\\\n\t]/.test(kl) && corpus.includes(JSON.stringify(kl).slice(1, -1))); seen.set(k, r); } return r; };
let kept = 0, dropped = 0;
for (const [l, n] of Object.entries(M)) {
  const d = (await import(here + "/i18n-" + l + ".js"))[n], o = {};
  for (const [k, v] of Object.entries(d)) { if (used(k)) { o[k] = v; kept++; } else dropped++; }
  fs.writeFileSync(out + "/" + l + ".js", "(window.__ATTUNE_DICTS=window.__ATTUNE_DICTS||{})[" + JSON.stringify(l) + "]=" + JSON.stringify(o).replace(/<\/script/gi, "<\\/script") + ";\n");
}
console.log(`languages (${((Date.now() - t0) / 1000).toFixed(1)} s, code ${(corpus.length / 1e6).toFixed(1)} MB): ${kept} lines kept, ${dropped} unused lines left out (removed features)`);
