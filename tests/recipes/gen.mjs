// v9.9.18 AU3 — 10,000 people (random salary day, rent, gam'eya, fund, family, car, kids, trip, baby, prayers on/off, any day of
// 2026–2028): the gallery holds exactly the recipes that fit, each with exactly the rules whose data exist, and Ramadan's days left
// match an independent day-by-day scan of the Umm al-Qura calendar. Ramadan never shows when prayers / Ramadan are switched off.
import fs from "fs";
import { gallery, RECIPES } from "../../web-src/recipes.js";
const N = +(process.argv[2] || 10000);
let seed = 20261117 + 7919 * +(process.env.SEED_SHIFT || 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1)), DAY = 864e5;
const H = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "numeric" });
const ramadanDays = (now) => { const d = new Date(now); d.setHours(12, 0, 0, 0); for (let i = 0; i < 400; i++) { const p = H.formatToParts(d), m = +p.find((x) => x.type === "month").value, dd = +p.find((x) => x.type === "day").value; if (m === 9 && dd === 1) return i; d.setDate(d.getDate() + 1); } return null; };
let ok = 0; const bad = {}; const fail = (k) => { bad[k] = (bad[k] || 0) + 1; };
const base = Date.parse("2026-01-01T09:00:00");
for (let i = 0; i < N; i++) {
  const now = base + int(0, 365 * 3) * DAY;
  const p = { salaryDay: rnd() < 0.7 ? int(1, 28) : 0, rent: rnd() < 0.5 ? int(2000, 20000) : 0, gameya: rnd() < 0.3 ? 2000 : 0, carFund: rnd() < 0.4 ? "car" : "", family: rnd() < 0.5 ? ["Nada"] : [], car: rnd() < 0.5,
    kids: rnd() < 0.4 ? int(1, 3) : 0, tripAt: rnd() < 0.4 ? now + int(-10, 200) * DAY : 0, baby: rnd() < 0.15, prayersOn: rnd() < 0.6 };
  const g = gallery(p, now), ids = g.map((x) => x.id);
  const rd = ramadanDays(now);
  const want = { salary: p.salaryDay > 0, ramadan: p.prayersOn && rd != null && rd <= 120, school: p.kids > 0, trip: p.tripAt > now && p.tripAt - now <= 120 * DAY, car: p.car, baby: p.baby };
  let err = "";
  for (const [k, v] of Object.entries(want)) if (v !== ids.includes(k)) { err = (v ? "missed " : "offered ") + k; break; }
  if (!err && ids.includes("ramadan") && g.find((x) => x.id === "ramadan").n !== rd) err = "Ramadan days " + g.find((x) => x.id === "ramadan").n + " ≠ " + rd;
  if (!err && ids.includes("salary")) { const s = g.find((x) => x.id === "salary"); if (s.on.includes("rent") !== p.rent > 0 || s.on.includes("gameya") !== p.gameya > 0 || s.on.includes("save") !== !!p.carFund || !s.on.includes("split")) err = "salary recipe's rules"; }
  if (!err && ids.includes("ramadan") && g.find((x) => x.id === "ramadan").on.includes("eidiya") !== (p.family.length > 0 || p.kids > 0)) err = "Ramadan's eidiya rule";
  if (!err) for (let k = 1; k < g.length; k++) if (g[k].n < g[k - 1].n) { err = "order"; break; }
  if (err) fail(err); else ok++;
}
const s = `# Recipes run — ${N} people, ${ok} right (${(100 * ok / N).toFixed(2)}%)\n` + Object.entries(bad).map(([k, v]) => `\n- ✗ ${k} × ${v}`).join("") + "\n";
if (N === 10000) fs.writeFileSync(new URL(process.env.SEED_SHIFT ? "../onemillion/B-recipes-s" + process.env.SEED_SHIFT + ".md" : "./report.md", import.meta.url), s);
console.log(s);
