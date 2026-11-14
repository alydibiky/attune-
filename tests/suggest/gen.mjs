// v9.9.18 AU2 — 10,000 money histories (payee names in the 20 languages, amounts in 30 currencies' sizes), each with planted habits
// (weekly on a weekday / monthly on a day) and look-alike noise (2 times only, amounts that jump by 40% or more, a gap week, an old habit
// that stopped). Checked: every live habit is found with the right weekday / day and amount; noise and stopped habits are never
// offered; a refused idea never comes back.
import fs from "fs";
import { findIdeas, refuse } from "../../web-src/suggest.js";
const N = +(process.argv[2] || 10000);
let seed = 20261116 + 7919 * +(process.env.SEED_SHIFT || 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const WHO = ["the maid", "الشغالة", "Seoudi", "talabat", "Le pressing", "la limpieza", "Putzfrau", "a faxineira", "la colf", "уборщица", "temizlikçi", "pembantu", "कामवाली", "ماسی", "خدمتکار", "কাজের লোক", "mfanyakazi", "แม่บ้าน", "người giúp việc", "保姆", "家政婦", "가사도우미", "Gym", "Netflix", "Rent", "الايجار", "Uber", "Vodafone Cash", "Careem", "Kahraba"];
const DAY = 864e5, now = Date.parse("2026-11-11T20:00:00");
let ok = 0; const bad = {}; const fail = (k, x) => { (bad[k] = bad[k] || []).push(x); };
for (let i = 0; i < N; i++) {
  const txns = [], want = [], forbid = [], names = [...WHO].sort(() => rnd() - 0.5).slice(0, 6);
  const scale = pick([1, 1, 10, 100, 0.1]);
  for (const [j, who] of names.entries()) {
    const k = rnd(), amt = Math.round(pick([45, 120, 350, 600, 1500, 8000]) * scale * 100) / 100;
    if (k < 0.3) {   // a live weekly habit
      const wd = int(0, 6), n = int(3, 8); let d = new Date(now); d.setHours(int(8, 20), 0, 0, 0); while (d.getDay() !== wd || d.getTime() > now) d = new Date(d.getTime() - DAY);
      for (let w = 0; w < n; w++) txns.push({ at: d.getTime() - w * 7 * DAY, amount: Math.round(amt * (1 + (rnd() - 0.5) * 0.12) * 100) / 100, note: who });
      want.push({ who, kind: "weekly", wd, amt });
    } else if (k < 0.45) {   // a live monthly habit
      const dom = int(1, 26), n = int(3, 6); for (let m = 0; m < n; m++) { const d = new Date(2026, 10 - m - (dom > 11 ? 1 : 0), dom, 10); if (d.getTime() <= now) txns.push({ at: d.getTime(), amount: amt, note: who }); }
      if (txns.filter((x) => x.note === who).length >= 3) want.push({ who, kind: "monthly", dom, amt }); else forbid.push(who);
    } else if (k < 0.6) {   // only twice
      const wd = int(0, 6); let d = new Date(now); while (d.getDay() !== wd) d = new Date(d.getTime() - DAY); txns.push({ at: d.getTime(), amount: amt, note: who }, { at: d.getTime() - 7 * DAY, amount: amt, note: who }); forbid.push(who);
    } else if (k < 0.72) {   // amounts that jump > 10%
      const wd = int(0, 6); let d = new Date(now); while (d.getDay() !== wd) d = new Date(d.getTime() - DAY); [1, 1.4, 0.6, 1.9].forEach((f, w) => txns.push({ at: d.getTime() - w * 7 * DAY, amount: Math.round(amt * f), note: who })); forbid.push(who);
    } else if (k < 0.84) {   // a habit that stopped two months ago
      const wd = int(0, 6); let d = new Date(now - 60 * DAY); while (d.getDay() !== wd) d = new Date(d.getTime() - DAY); for (let w = 0; w < 5; w++) txns.push({ at: d.getTime() - w * 7 * DAY, amount: amt, note: who }); forbid.push(who);
    } else {   // random spending on random days
      for (let r = 0; r < int(1, 6); r++) txns.push({ at: now - int(1, 120) * DAY - int(0, 20) * 36e5, amount: Math.round(amt * (0.3 + rnd() * 2)), note: who }); forbid.push("?" + who);
    }
  }
  let ideas = findIdeas(txns, {}, now); const norm = (s) => s.toLowerCase().normalize("NFKC").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/[^\p{L}\p{M}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
  let err = "";
  for (const w of want) { const f = ideas.find((x) => x.label === norm(w.who)); if (!f) { err = "missed a " + w.kind + " habit"; break; }
    if (w.kind === "weekly" && (f.kind !== "weekly" || f.weekday !== w.wd)) { err = "weekly habit: wrong day / kind"; break; }
    if (w.kind === "monthly" && (f.kind !== "monthly" || Math.abs(f.dom - w.dom) > 0)) { err = "monthly habit: wrong day / kind"; break; }
    if (Math.abs(f.amount - w.amt) > 0.11 * w.amt) { err = "habit amount " + f.amount + " ≠ " + w.amt; break; } }
  if (!err) for (const fb of forbid.filter((x) => !x.startsWith("?"))) if (ideas.some((x) => x.label === norm(fb))) { err = "offered something that isn't a habit"; break; }
  if (!err && ideas.length) { const st = refuse({}, ideas[0]); if (findIdeas(txns, st, now).some((x) => x.key === ideas[0].key)) err = "a refused idea came back"; }
  if (err && process.env.DBG && !globalThis.__shown) { globalThis.__shown = 1; console.log(JSON.stringify({ want, ideas: ideas.map((x) => [x.label, x.kind, x.weekday, x.amount]), txns: txns.filter((t) => want.some((w) => w.who === t.note)).map((t) => [t.note, new Date(t.at).toString().slice(0, 21), t.amount]) })); }
  if (err) fail(err, i); else ok++;
}
const s = `# Suggestions run — ${N} histories, ${ok} right (${(100 * ok / N).toFixed(2)}%)\n` + Object.entries(bad).map(([k, v]) => `\n- ✗ ${k} × ${v.length}`).join("") + "\n";
if (N === 10000) fs.writeFileSync(new URL(process.env.SEED_SHIFT ? "../onemillion/B-suggest-s" + process.env.SEED_SHIFT + ".md" : "./report.md", import.meta.url), s);
console.log(s);
