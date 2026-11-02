// v9.0 (Ali, 2 Nov: "I want all the languages to be correct and accurate — make sure"): audits the FINAL dictionaries
// (web-src/i18n-<id>.js) for every language: placeholders, script, left in English, Egyptian vs Fusha, and — the kind of mistake
// that made "Left" (money still to pay) «شمال» (the direction) — one English word used with two meanings in the code.
//   node tools/i18n/audit.mjs [lang]        → prints problems; exit 1 when any (ambiguous words are listed separately)
import fs from "fs";
const ROOT = new URL("../../", import.meta.url).pathname;
const SCRIPT = { hi: /[ऀ-ॿ]/, ur: /[؀-ۿ]/, fa: /[؀-ۿ]/, ar: /[؀-ۿ]/, arb: /[؀-ۿ]/, ru: /[Ѐ-ӿ]/, zh: /[一-鿿]/, ja: /[぀-ヿ一-鿿]/, ko: /[가-힯]/, bn: /[ঀ-৿]/, th: /[฀-๿]/ };
const ph = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(",");
const load = async (l) => { const m = await import(`${ROOT}web-src/i18n-${l}.js`); return Object.values(m).find((v) => v && typeof v === "object" && Object.keys(v).length > 50) || {}; };
const langs = (process.argv[2] ? [process.argv[2]] : fs.readdirSync(`${ROOT}web-src`).map((f) => (/^i18n-([a-z]+)\.js$/.exec(f) || [])[1]).filter(Boolean));
const KEEP = /^(Attune|Pro|PDF|Word|Excel|WhatsApp|Gmail|Google|Android|AI|SMS|OK|EGP|USD|EUR|kg|kcal|km|GB|MB|CV|HbA1c|Wi-?Fi|Booking\.com|Talabat|Uber|Instagram|YouTube|Huawei|Franco|Facebook|Amazon|noon|Jumia|Python|JavaScript|[A-Z]{2,6}|[\d\W]+)$/;
const FUSHA = /(?:^|\s)(سوف|لقد|الذي|التي|هذا|هذه|ذلك|ليس|لماذا|كيف|ماذا|أيضًا|الآن|لدي|لديك|يجب)(?=\s|$|[،.؟!])/;
const EGY = /(?:^|\s)(ده|دي|عشان|إزاي|ازاي|بتاع|بتاعك|عايز|عاوز|دلوقتي|كده|مش|إيه|ايه|ليه|فين|امتى|بقى|خلاص|اوي|أوي)(?=\s|$|[،.؟!])/;
// names, file names and English lessons that rightly stay as written
const IGNORE = new Set(["owner/repo:QUANT", "WhatsApp Chat with Design ideas.zip", "Excel & Power Automate", "Hourani p. 84 · Lapidus p. 291", "contract.pdf · 12 pages", "paris saint-germain", "Present simple vs continuous"]);
let bad = 0;
for (const l of langs) {
  let d; try { d = await load(l); } catch (e) { console.log(`${l}: cannot read — ${e.message}`); bad++; continue; }
  const probs = [];
  for (const [en, t] of Object.entries(d)) {
    if (typeof t !== "string" || IGNORE.has(en)) continue;
    const letters = en.replace(/\{\w+\}/g, "").replace(/[^A-Za-z]/g, "");
    if (ph(en) !== ph(t)) probs.push(["placeholders differ", en, t]);
    const sentence = (en.replace(/\{\w+\}/g, "").match(/\b[a-z]{3,}\b/g) || []).length >= 2;
    if (SCRIPT[l] && sentence && !SCRIPT[l].test(t) && !KEEP.test(en.trim())) probs.push(["not in the script", en, t]);
    if (!SCRIPT[l] && t === en && letters.length >= 14 && /\s\w+\s/.test(en)) probs.push(["left in English", en, t]);
    if (l === "ar" && FUSHA.test(t)) probs.push(["formal Arabic in Egyptian", en, t]);
    if (l === "arb" && EGY.test(t)) probs.push(["Egyptian in formal Arabic", en, t]);
    if ((l === "ar" || l === "arb") && /\bEGP\b/.test(t) && !/\bEGP\b/.test(en)) probs.push(["EGP added", en, t]);
  }
  if (probs.length) { bad += probs.length; console.log(`\n== ${l}: ${probs.length}`); for (const [w, en, t] of probs.slice(0, 400)) console.log(`${w} — ${JSON.stringify(en).slice(0, 100)} → ${JSON.stringify(t).slice(0, 100)}`); }
}
// one English word, several meanings: short keys used in more than one file — each use is printed so a person can judge
if (!process.argv[2] || process.argv[3] === "amb") {
  const files = fs.readdirSync(`${ROOT}web-src`).filter((f) => /\.(jsx?|mjs)$/.test(f) && !/^i18n/.test(f));
  const uses = new Map();
  for (const f of files) { const s = fs.readFileSync(`${ROOT}web-src/${f}`, "utf8"); const re = /\btr\("([^"{}]{1,22})"\)/g; let m;
    while ((m = re.exec(s))) { const k = m[1]; if (k.split(/\s+/).length > 2) continue; const line = s.slice(s.lastIndexOf("\n", m.index) + 1, s.indexOf("\n", m.index)).trim().slice(0, 140);
      if (!uses.has(k)) uses.set(k, []); uses.get(k).push(f + ": " + line); } }
  const amb = [...uses].filter(([, u]) => new Set(u.map((x) => x.split(":")[0])).size > 1);
  fs.writeFileSync(`${ROOT}tools/i18n/ambiguous.txt`, amb.map(([k, u]) => `## ${k}\n` + u.slice(0, 8).join("\n")).join("\n\n"));
  console.log(`\n${amb.length} short words used in more than one file → tools/i18n/ambiguous.txt (read for two meanings)`);
}
console.log(bad ? `\n${bad} problems` : "\nno problems");
process.exit(bad ? 1 : 0);
