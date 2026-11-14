// v9.9.38 WK-1 + WK-2 (Ali's picks) — EXACTLY 10,000 weeks: a country of the 30, a day 2026–2028, and the person's choice in Settings
// (none / Saturday / Sunday / Monday). Checked against a table written HERE (the CLDR first day of each country — 0 Sunday … 6 Saturday):
// weekStart(), weekStartOf(), and Money's "how much did I spend this week / last week" span.
//     node tests/weekstart/gen.mjs [n]
import fs from "fs";
const store = new Map(); globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), key: () => null, length: 0 };
const C = await import("../../web-src/country.js"), L = await import("../../web-src/myledger.js");
const TRUTH = { eg: 6, sa: 0, ae: 1, kw: 6, qa: 6, bh: 6, om: 6, jo: 6, lb: 1, ma: 1, dz: 6, tn: 1, tr: 1, pk: 0, in: 0, id: 0, my: 1, us: 0, gb: 1, ca: 0, de: 1, fr: 1, es: 1, it: 1, pt: 0, nl: 1, br: 0, mx: 0, ng: 1, za: 0 };
const N = +(process.argv[2] || 10000);
let seed = 4747 + 7919 * +(process.env.SEED_SHIFT || 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const seen = new Set(), bad = {}; let pass = 0, made = 0;
while (made < N) {
  const cc = pick(Object.keys(TRUTH)), choice = pick(["", "", "6", "0", "1"]), day = new Date(2026 + Math.floor(rnd() * 3), Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 28), 8 + Math.floor(rnd() * 12));
  const key = cc + choice + iso(day); if (seen.has(key)) continue; seen.add(key); made++;
  store.clear(); store.set("attune:country", cc); if (choice) store.set("attune:week-start", choice);
  const ws = choice ? +choice : TRUTH[cc];
  const start = new Date(day); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - ((start.getDay() - ws + 7) % 7));
  const lastEnd = new Date(start); lastEnd.setDate(lastEnd.getDate() - 1); const lastStart = new Date(lastEnd); lastStart.setDate(lastStart.getDate() - 6);
  let why = "";
  if (C.weekStart() !== ws) why = cc + ": first day " + C.weekStart() + " ≠ " + ws + (choice ? " (chosen)" : " (country)");
  else if (iso(C.weekStartOf(day)) !== iso(start)) why = "start of week";
  else { const a = L.spanOf("how much did I spend this week?", day.getTime()), b = L.spanOf("how much did I spend last week?", day.getTime());
    if (a.from !== iso(start) || a.to !== iso(day)) why = "this week " + a.from + "…" + a.to + " ≠ " + iso(start) + "…" + iso(day);
    else if (b.from !== iso(lastStart) || b.to !== iso(lastEnd)) why = "last week " + b.from + "…" + b.to + " ≠ " + iso(lastStart) + "…" + iso(lastEnd); }
  if (why) (bad[why.replace(/\d{4}-\d\d-\d\d/g, "D").slice(0, 70)] = bad[why.replace(/\d{4}-\d\d-\d\d/g, "D").slice(0, 70)] || []).push(key); else pass++;
}
const md = `# Week start — ${N} weeks, ${pass} right (${(100 * pass / N).toFixed(2)}%)\n\n` + Object.entries(bad).map(([k, v]) => `- **${k}** × ${v.length}: ${v.slice(0, 4).join(" · ")}`).join("\n") + "\n";
if (N === 10000) fs.writeFileSync(new URL(+process.env.SEED_SHIFT ? "../onemillion/B-weekstart-s" + process.env.SEED_SHIFT + ".md" : "./report.md", import.meta.url), md);
console.log(md);
