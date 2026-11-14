// v9.9.32 (Ali, 13 Nov 2026: "try the code and model with 100,000 scenarios and unique texts"). EXACTLY 100,000 different sentences:
// every group of hard.mjs ×10, each sentence then made harder the way people really type — a wake word or filler in front ("hey attune,",
// «يا أتيون»), thanks / emoji / "pls" after it, all lower-case or ALL CAPS, doubled spaces, a missing final letter of a filler, Arabic
// commas. The meaning never changes, so the expected kind and details stay hard.mjs's own. Seeded: every run gives the same sentences.
//     node tests/scenarios/mega.mjs            (100,000 → tests/scenarios/mega-report.md)
//     node tests/scenarios/mega.mjs 2500       (a sample, same proportions; used by tests/unit/v9932mega.test.mjs)
import fs from "fs";
globalThis.__HARD_IMPORT = true;
const H = await import("./hard.mjs");
const { classify } = await import("./brain.mjs");
const { readable: cleanTyped } = await import("../../web-src/wrapclean.js");
const { G, NOW } = H;
const TOTAL = +(process.argv[2] || 100000);
let seed = 20261113 + 7919 * +(process.env.SEED_SHIFT || 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const isAr = (s) => /[؀-ۿ]/.test(s);
const PRE_EN = ["", "", "", "hey attune, ", "ok so ", "Attune: ", "quick one - ", "pls ", "yo ", "um, ", "listen, ", "btw ", "hi! ", "ok ", "so, ", "attune ", "hey, "];
const PRE_AR = ["", "", "", "يا أتيون، ", "يا اتيون ", "بص ", "بقولك ايه، ", "اسمع ", "بقولك ", "طيب ", "يا عم ", "معلش ", "hey attune, "];
const SUF_EN = ["", "", "", " thanks", " 🙏", "!!", " pls", "...", " ty", ".", " 👍", " thx!", " ok?"];
const SUF_AR = ["", "", "", " شكرا", " 🙏", "!!", " يا معلم", "...", " ❤️", ".", " لو سمحت", " ميرسي"];
function harden(s, g) {
  const ar = isAr(s), calcish = /^(calc|smalltalk)$/.test(g);
  let pre = pick(ar ? PRE_AR : PRE_EN), suf = pick(ar ? SUF_AR : SUF_EN);
  if (calcish && rnd() < 0.5) { pre = ""; suf = ""; }
  if (/\?\s*$/.test(s) && /ok\?|!!/.test(suf)) suf = "";
  let t = pre + s + suf;
  const r = rnd();
  if (!ar && r < 0.12) t = t.toLowerCase(); else if (!ar && r < 0.16) t = t.toUpperCase(); else if (r < 0.22) t = t.replace(/ (?=\S)/, "  ");
  return t;
}
const full = G.reduce((s, g) => s + g[1], 0); if (full !== 10000) throw new Error("hard.mjs groups add up to " + full);
const seen = new Set(), rows = [];
for (const [name, n0, maker] of G) { const n = Math.round(n0 * TOTAL / 10000); let made = 0, tries = 0;
  while (made < n) { if (tries++ > n * 600) throw new Error(name + ": only " + made + " different sentences of " + n);
    const m = maker(); if (!m) continue; const [s0, accept, chk] = m; if (!s0) continue;
    // ALL CAPS changes a reminder's title on purpose — the title check is then about the words, not the case
    const s = harden(s0, name); if (seen.has(s)) continue; seen.add(s); made++;
    let r; try { r = classify(s, { now: NOW, both: true }); } catch (e) { r = { k: "THROW " + e.message }; }
    const wrongKind = accept.not ? accept.not.includes(r.k) : !accept.includes(r.k); let why = "";
    if (!wrongKind) { try { why = chk(r, cleanTyped(s)) || ""; } catch (e) { why = "check threw " + e.message; } }
    if (why && s !== s0 && /title (lost|keeps)/.test(why) && s === s.toUpperCase()) why = "";
    rows.push({ g: name, s, base: s0, k: r.k, ok: !wrongKind && !why, why: wrongKind ? "→ " + r.k + (r.sub ? "/" + r.sub : "") : why.replace(/\d+(\.\d+)?/g, "N").replace(/“[^”]*”/g, "“…”") }); } }
// the sentences must really all be different
if (new Set(rows.map((r) => r.s)).size !== rows.length) throw new Error("duplicate sentences");
const by = {}; for (const r of rows) { const b = (by[r.g] = by[r.g] || { n: 0, bad: 0, ex: {} }); b.n++; if (!r.ok) { b.bad++; (b.ex[r.why] = b.ex[r.why] || []).push(r.s); } }
const total = rows.length, bad = rows.filter((r) => !r.ok).length;
// how many were wrong only BECAUSE of the hardening (the plain sentence is right)?
let md = `# 100,000-sentence run — ${total} sentences, ${total - bad} right (${(100 * (total - bad) / total).toFixed(2)}%)\n\nEvery sentence is different (checked). Each is a hard.mjs sentence typed the way people really type (wake word, filler, thanks, emoji, caps, double spaces) and is checked for WHAT the app does and for the details (amount, direction, hour, person).\n\n| group | sentences | wrong | right % |\n|---|---|---|---|\n`;
for (const [g, b] of Object.entries(by).sort((a, b) => b[1].bad / b[1].n - a[1].bad / a[1].n)) md += `| ${g} | ${b.n} | ${b.bad} | ${(100 * (b.n - b.bad) / b.n).toFixed(2)} |\n`;
md += "\n## What went wrong (examples of each)\n";
for (const [g, b] of Object.entries(by)) if (b.bad) { md += `\n### ${g}\n`; for (const [why, ex] of Object.entries(b.ex).sort((a, b) => b[1].length - a[1].length).slice(0, 12)) md += `- **${why}** × ${ex.length}: ${ex.slice(0, 6).map((x) => "«" + x.replace(/\n/g, " ⏎ ") + "»").join(" · ")}\n`; }
if (TOTAL === 100000) fs.writeFileSync(new URL(+process.env.SEED_SHIFT ? "../onemillion/A1-mega-s" + process.env.SEED_SHIFT + ".md" : "./mega-report.md", import.meta.url), md);
if (process.env.MEGA_JSON) fs.writeFileSync(process.env.MEGA_JSON, JSON.stringify(rows));
console.log(md.split("\n## What")[0]);
export const RESULT = { total, bad };
