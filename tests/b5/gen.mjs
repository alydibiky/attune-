// v9.9.22 B5 — exactly 10,000 cases EACH for N3 on this day, P1 keep in touch, P3 occasions, over many "todays" (leap years, year ends,
// 29 Feb) and the oracle written here. node tests/b5/gen.mjs [n] → pass rates (+ report.md at 10,000).
import fs from "fs";
const B = await import(process.env.B5 || "../../web-src/b5people.js");
const N = +(process.argv[2] || 10000);
let seed = 5 + 7919 * +(process.env.SEED_SHIFT || 0); const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff) / 2147483648), int = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = (l) => l[Math.floor(rnd() * l.length)];
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h, 0, 0).getTime(), pad = (n) => String(n).padStart(2, "0"), isoOf = (y, m, d) => y + "-" + pad(m) + "-" + pad(d);
const leap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0, dim = (y, m) => new Date(y, m, 0).getDate();
const res = {};
const run = (name, make) => { let pass = 0; const miss = {}; for (let i = 0; i < N; i++) { const c = make(i); let why; try { why = c.check(); } catch (e) { why = "crash " + e.message; } if (!why) pass++; else (miss[why] = miss[why] || []).push(i); } res[name] = { pass, miss }; };
// ---- N3
run("N3 on this day", () => {
  const ty = int(2025, 2030), tm = int(1, 12), td = int(1, dim(ty, tm)), now = at(ty, tm, td, int(7, 22));
  const recs = [], txns = []; let want = null;   // want = { id } of the right one, chosen by the rule: nearest year, then the bigger amount
  const cands = [];
  for (let k = 0; k < int(0, 12); k++) {
    const same = rnd() < 0.4, yy = same ? ty - int(1, 5) : ty - int(0, 5), mm = same ? tm : int(1, 12), ddd = same ? Math.min(td, dim(yy, mm)) : int(1, dim(yy, mm));
    const ok = mm === tm && ddd === td && yy < ty, money = rnd() < 0.5, dead = rnd() < 0.15, id = (money ? "t" : "r") + k;
    if (money) { const amt = int(1, 9000); txns.push({ id, date: isoOf(yy, mm, ddd), amount: amt, note: "x", type: "expense", ...(dead ? { deleted: true } : {}) }); if (ok && !dead) cands.push({ id, years: ty - yy, amount: amt }); }
    else { recs.push({ id, ts: at(yy, mm, ddd, int(0, 23)), title: "note", kind: "note", meta: dead ? { trashed: true } : {} }); if (ok && !dead) cands.push({ id, years: ty - yy, amount: 0 }); }
  }
  // today's own notes and payments (this year) are never "on this day"
  if (rnd() < 0.35) recs.push({ id: "today-r", ts: now - int(0, 5) * 3600e3, title: "today", kind: "note", meta: {} });
  if (rnd() < 0.35) txns.push({ id: "today-t", date: isoOf(ty, tm, td), amount: 99999, note: "today", type: "expense" });
  cands.sort((a, b) => a.years - b.years || b.amount - a.amount || a.id.localeCompare(b.id)); want = cands[0] || null;
  return { check: () => { const g = B.onThisDay({ records: recs, txns }, now); if (!want) return g ? "found one where none" : ""; if (!g) return "missed one"; return g.id === want.id ? "" : "wrong one (nearest year, then bigger amount)"; } };
});
// ---- P1
run("P1 keep in touch", () => {
  const now = at(int(2025, 2028), int(1, 12), int(1, 28), int(8, 22)), people = [], events = [], want = {};
  for (let k = 0; k < int(1, 6); k++) { const id = "p" + k, every = pick([1, 3, 7, 14, 30, 60]); people.push({ id, name: "P" + k, every }); let last = null;
    for (let e = 0; e < int(0, 8); e++) { const t = now - int(0, 90) * 864e5 - int(0, 20) * 3600e3, kind = pick(["call", "missed", "chat", "missed", "visit"]), future = rnd() < 0.05; const tt = future ? now + int(1, 5) * 864e5 : t;
      events.push({ who: id, at: tt, kind }); if (kind !== "missed" && !future && (!last || tt > last)) last = tt; }
    const since = last ? Math.round((new Date(now).setHours(12, 0, 0, 0) - new Date(last).setHours(12, 0, 0, 0)) / 864e5) : null;
    want[id] = { since, due: since == null || since >= every }; }
  return { check: () => { const g = B.keepInTouch(people, events, now); if (g.length !== people.length) return "lost a person";
    for (const x of g) { const w = want[x.id]; if (x.since !== w.since) return "days since wrong (a missed call / a future call counted?)"; if (x.due !== w.due) return "due wrong"; }
    for (let k = 1; k < g.length; k++) if (g[k].over > g[k - 1].over) return "not most overdue first";
    const today = isoOf(new Date(now).getFullYear(), new Date(now).getMonth() + 1, new Date(now).getDate());
    if (B.nudgeToday(g, today, now) !== null) return "nudged twice in a day";
    const n = B.nudgeToday(g, "", now); if (n && !n.due) return "nudge for someone not due"; if (!n && g.some((x) => x.due)) return "no nudge though someone is due"; return ""; } };
});
// ---- P3
run("P3 occasions", () => {
  const ty = int(2025, 2032), tm = int(1, 12), td = int(1, dim(ty, tm)), now = at(ty, tm, td, int(6, 23)), dates = [], want = {};
  for (let k = 0; k < int(1, 6); k++) { const feb29 = rnd() < 0.15, m = feb29 ? 2 : int(1, 12), d = feb29 ? 29 : int(1, dim(2023, m)), year = rnd() < 0.6 ? int(1950, ty) : undefined, id = "o" + k;
    dates.push({ id, who: "W" + k, kind: pick(["birthday", "anniversary"]), md: pad(m) + "-" + pad(d), ...(year ? { year } : {}) });
    // oracle: the first year Y ≥ this year whose date (29 Feb → 28 Feb when not leap) is on or after today
    let Y = ty, dd = m === 2 && d === 29 && !leap(Y) ? 28 : d; if (m < tm || (m === tm && dd < td)) { Y = ty + 1; dd = m === 2 && d === 29 && !leap(Y) ? 28 : d; }
    const inDays = Math.round((new Date(Y, m - 1, dd, 12) - new Date(ty, tm - 1, td, 12)) / 864e5);
    want[id] = { next: isoOf(Y, m, dd), inDays, turns: year && year <= Y ? Y - year : null }; }
  return { check: () => { const g = B.occasions(dates, now); if (g.length !== dates.length) return "lost a date";
    for (const x of g) { const w = want[x.id]; if (x.next !== w.next) return "next date wrong" + (x.md === "02-29" ? " (29 Feb)" : ""); if (x.inDays !== w.inDays) return "days left wrong"; if (x.turns !== w.turns) return "age / years wrong"; }
    for (let k = 1; k < g.length; k++) if (g[k].inDays < g[k - 1].inDays) return "not nearest first"; return ""; } };
});
const lines = ["# B5 people — " + N + " cases each", ""];
for (const [k, r] of Object.entries(res)) { lines.push("- **" + k + "**: " + r.pass + " / " + N + " (" + (100 * r.pass / N).toFixed(2) + "%)"); for (const [w, l] of Object.entries(r.miss)) lines.push("  - " + w + " — " + l.length); }
if (N === 10000) fs.writeFileSync(new URL(+process.env.SEED_SHIFT ? "../onemillion/B-b5-s" + process.env.SEED_SHIFT + ".md" : "./report.md", import.meta.url), lines.join("\n") + "\n");
console.log(lines.join("\n"));
