// v9.9.18 M1 — 10,000 salaries (27 currencies, one or two parts, plans of fixed amounts and %): the rows and "left" add up to the
// salary to the smallest coin, a part that doesn't fit is flagged (never cut), and two parts within 3 days are one salary.
import fs from "fs"; import { salaryOf, sortSalary } from "../../web-src/salarysort.js"; import { toUnits } from "../../web-src/moneyunits.js"; import { rng, CURS } from "../b3common.mjs";
const N = +(process.argv[2] || 10000), rnd = rng(20261119), pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1)), DAY = 864e5;
let ok = 0; const bad = {}; const now = Date.parse("2026-11-25T12:00:00");
for (let i = 0; i < N; i++) {
  const cur = pick(CURS), whole = Math.round(pick([3000, 25000, 400000, 1500.5]) * (0.5 + rnd()) * 100) / 100, two = rnd() < 0.3, gap = int(0, 6);
  const parts = two ? [{ at: now - gap * DAY, amount: Math.round(whole * 0.6 * 100) / 100, currency: cur, salary: true }, { at: now, amount: Math.round(whole * 0.4 * 100) / 100, currency: cur, salary: true }] : [{ at: now, amount: whole, currency: cur, salary: true }];
  const old = { at: now - 30 * DAY, amount: whole, currency: cur, salary: true };
  const s = salaryOf([...parts, old], now); let err = "";
  const wantU = two && gap <= 3 ? parts.reduce((a, p) => a + toUnits(p.amount, cur), 0) : toUnits(parts[parts.length - 1].amount, cur);
  if (!s || toUnits(s.amount, cur) !== wantU) err = "salary " + (s && s.amount) + " (two parts " + two + ", gap " + gap + ")";
  if (!err) { const plan = Array.from({ length: int(0, 8) }, (_, k) => (rnd() < 0.5 ? { id: "p" + k, name: "Part " + k, pct: pick([5, 10, 12.5, 20, 33]) } : { id: "p" + k, name: "Part " + k, amount: Math.round(s.amount * rnd() * 0.5 * 100) / 100 }));
    const r = sortSalary(s, plan), total = toUnits(s.amount, cur), used = r.rows.filter((x) => !x.over).reduce((a, x) => a + toUnits(x.amount, cur), 0);
    if (used + toUnits(r.left, cur) !== total) err = "rows + left ≠ salary";
    else if (toUnits(r.left, cur) < 0) err = "left is negative";
    else { let run = 0; for (const p of plan) { const u = p.pct != null ? Math.round(total * p.pct / 100) : toUnits(p.amount, cur); if (!(u > 0)) continue; const row = r.rows.find((x) => x.id === p.id); if (!row) { err = "a part vanished"; break; } if (run + u > total) { if (!row.over) { err = "an over part not flagged"; break; } } else { run += u; if (row.over) { err = "a fitting part flagged"; break; } } } } }
  if (err) bad[err.replace(/[\d.]+/g, "#")] = (bad[err.replace(/[\d.]+/g, "#")] || 0) + 1; else ok++;
}
const out = `# Salary sorter run — ${N} salaries, ${ok} right (${(100 * ok / N).toFixed(2)}%)\n` + Object.entries(bad).map(([k, v]) => `\n- ✗ ${k} × ${v}`).join("") + "\n";
if (N === 10000) fs.writeFileSync(new URL(process.env.SEED_SHIFT ? "../onemillion/B-salarysort-s" + process.env.SEED_SHIFT + ".md" : "./report.md", import.meta.url), out); console.log(out);
