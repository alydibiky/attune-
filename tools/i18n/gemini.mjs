// node tools/i18n/gemini.mjs [lang…] — translates every todo/<lang>/NN.json that has no out/<lang>/NN.json with Gemini,
// checks it with check.mjs and sends the problems back once or twice until it passes. Needs GEMINI_API_KEY.
// GEMINI_MODEL (default gemini-2.5-pro), PAR = chunks at the same time (default 4).
import fs from "fs";
import { execFileSync } from "child_process";
const BASE = new URL(".", import.meta.url).pathname;
const KEY = process.env.GEMINI_API_KEY, MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro", PAR = +(process.env.PAR || 4);
if (!KEY) { console.error("GEMINI_API_KEY is not set"); process.exit(2); }
const NAMES = { arb: "Modern Standard Arabic (الفصحى) — NOT Egyptian; the `ar` hint is Egyptian, never copy its dialect words", es: "Spanish", fr: "French",
  pt: "Brazilian Portuguese", hi: "Hindi", id: "Indonesian", tr: "Turkish", de: "German", ru: "Russian", ur: "Urdu", it: "Italian", zh: "Simplified Chinese",
  ja: "Japanese", ko: "Korean", fa: "Persian", bn: "Bengali", vi: "Vietnamese", th: "Thai", sw: "Kiswahili" };
const LANGS = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(NAMES);
const BRIEF = fs.readFileSync(BASE + "BRIEF.md", "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ask(prompt) {
  for (let i = 0; i < 6; i++) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 65536 } }) });
    if (r.ok) { const j = await r.json(); const t = j.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
      try { return JSON.parse(t); } catch { console.log("  bad JSON, retrying"); continue; } }
    const msg = (await r.text()).slice(0, 200); console.log(`  HTTP ${r.status} ${msg}`);
    if (r.status === 400 || r.status === 403) throw new Error("API refused: " + msg);
    await sleep(15000 * (i + 1));
  }
  throw new Error("no answer");
}
const check = (lang, nn) => { try { execFileSync("node", [BASE + "check.mjs", lang, nn], { encoding: "utf8" }); return ""; }
  catch (e) { return String(e.stdout || ""); } };

async function chunk(lang, nn) {
  const todo = JSON.parse(fs.readFileSync(`${BASE}todo/${lang}/${nn}.json`, "utf8"));
  const gl = fs.existsSync(`${BASE}glossary-${lang}-full.json`) ? fs.readFileSync(`${BASE}glossary-${lang}-full.json`, "utf8") : "{}";
  const head = `${BRIEF}\n\n# Your job\nTranslate into ${NAMES[lang]} (code ${lang}). Glossary — use these words exactly:\n${gl}\n\n` +
    `Return ONLY one JSON object: every "en" below as a key, copied byte-for-byte, mapped to its translation.\n\nLines:\n${JSON.stringify(todo)}`;
  const out = `${BASE}out/${lang}/${nn}.json`; fs.mkdirSync(`${BASE}out/${lang}`, { recursive: true });
  let res = await ask(head);
  for (let round = 0; round < 3; round++) {
    const keep = {}; for (const { en } of todo) if (typeof res[en] === "string") keep[en] = res[en];
    fs.writeFileSync(out, JSON.stringify(keep, null, 0));
    const probs = check(lang, nn);
    if (!probs) { console.log(`${lang} ${nn}: ok`); return true; }
    const bad = todo.filter(({ en }) => probs.includes(JSON.stringify(en).slice(0, 90)) || !(en in keep));
    console.log(`${lang} ${nn}: ${bad.length} lines to redo`);
    const fix = await ask(`${BRIEF}\n\nTranslate into ${NAMES[lang]} (code ${lang}). Glossary:\n${gl}\n\nThese lines failed the checker:\n${probs}\n\n` +
      `Return ONLY a JSON object {english: translation} for these lines (keys byte-for-byte):\n${JSON.stringify(bad)}`);
    res = { ...keep, ...fix };
  }
  fs.rmSync(out); console.log(`${lang} ${nn}: FAILED, left for later`); return false;
}

const jobs = [];
for (const lang of LANGS) for (const f of fs.readdirSync(`${BASE}todo/${lang}`).filter((f) => /^\d+\.json$/.test(f)).sort())
  if (!fs.existsSync(`${BASE}out/${lang}/${f}`)) jobs.push([lang, f.slice(0, -5)]);
console.log(`${jobs.length} chunks to do with ${MODEL}`);
let i = 0, failed = 0;
await Promise.all(Array.from({ length: PAR }, async () => { while (i < jobs.length) { const [l, n] = jobs[i++];
  try { if (!(await chunk(l, n))) failed++; } catch (e) { failed++; console.log(`${l} ${n}: ${e.message}`); if (/refused/.test(e.message)) process.exit(2); } } }));
console.log(`done, ${failed} failed`);
