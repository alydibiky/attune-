// node check.mjs <lang> [chunk]  — checks out/<lang>/<chunk>.json (or every chunk) against todo/<lang>/<chunk>.json
// Prints problems; exit code 1 when any. A translation file is a JSON object { "English": "translation", … }.
import fs from "fs";
const [lang, only] = process.argv.slice(2);
const BASE = new URL(".", import.meta.url).pathname;
const SCRIPT = { hi: /[ऀ-ॿ]/, ur: /[؀-ۿ]/, fa: /[؀-ۿ]/, ru: /[Ѐ-ӿ]/, zh: /[一-鿿]/, ja: /[぀-ヿ一-鿿]/,
  ko: /[가-힯]/, bn: /[ঀ-৿]/, th: /[฀-๿]/ };
const ph = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(",");
const count = (s, re) => (String(s).match(re) || []).length;
let bad = 0, total = 0, missing = 0;
const chunks = fs.readdirSync(`${BASE}todo/${lang}`).filter((f) => /^\d+\.json$/.test(f) && (!only || f === only.padStart(2, "0") + ".json" || f === only));
for (const f of chunks) {
  const todo = JSON.parse(fs.readFileSync(`${BASE}todo/${lang}/${f}`, "utf8"));
  const p = `${BASE}out/${lang}/${f}`;
  if (!fs.existsSync(p)) { console.log(`${f}: not done yet`); missing += todo.length; continue; }
  let out; try { out = JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { console.log(`${f}: NOT VALID JSON — ${e.message}`); bad++; continue; }
  for (const { en } of todo) {
    total++;
    const t = out[en];
    const say = (why) => { bad++; if (bad <= 60) console.log(`${f}: ${why} — ${JSON.stringify(en).slice(0, 90)}${t != null ? " → " + JSON.stringify(t).slice(0, 90) : ""}`); };
    if (t == null) { say("missing"); continue; }
    if (typeof t !== "string" || !t.trim()) { say("empty"); continue; }
    if (ph(en) !== ph(t)) { say("placeholders differ"); continue; }
    if (count(en, /\n/g) !== count(t, /\n/g)) say("line breaks differ");
    if (count(en, /\*\*/g) !== count(t, /\*\*/g)) say("bold ** marks differ");
    const letters = en.replace(/\{\w+\}/g, "").replace(/[^A-Za-z]/g, "");
    if (SCRIPT[lang] && letters.length >= 4 && !SCRIPT[lang].test(t) && t !== en) say("not in the language's script");
    if (t === en && letters.length >= 12 && /\s/.test(en)) say("left in English");
    if (t.length > en.length * 3.2 + 12) say("much longer than the English");
  }
  const extra = Object.keys(out).filter((k) => !todo.some((x) => x.en === k));
  if (extra.length) { console.log(`${f}: ${extra.length} keys not in the chunk (typo in a key?) e.g. ${JSON.stringify(extra[0]).slice(0, 80)}`); bad += extra.length; }
}
console.log(`${lang}: ${total} checked, ${bad} problems, ${missing} not done`);
process.exit(bad ? 1 : 0);
