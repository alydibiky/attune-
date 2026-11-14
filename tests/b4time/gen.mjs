// v9.9.18 B4 time parts — 10,000 countdowns + 10,000 habits + 10,000 focus sessions, each against an independent count
// (day by day for countdowns and streaks, second by second for focus). Run it in several time zones (run.sh).
import fs from "fs"; import { daysLeft, streak, weekDots, goalCount, focused } from "../../web-src/b4time.js";
const N = +(process.argv[2] || 10000);
let seed = 20261121 + 7919 * +(process.env.SEED_SHIFT || 0) + [...(process.env.TZ || "x")].reduce((a, c) => a + c.charCodeAt(0), 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1)), DAY = 864e5, base = new Date(2026, 0, 1, 0, 0).getTime();
const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const res = { countdown: 0, habit: 0, focus: 0 }, bad = {};
for (let i = 0; i < N; i++) {
  // countdown: walk calendar days one by one
  { const now = new Date(base); now.setDate(now.getDate() + int(0, 900)); now.setHours(int(0, 23), int(0, 59)); const k = int(-40, 800); const target = new Date(now); target.setHours(12); target.setDate(target.getDate() + k);
    const asStr = rnd() < 0.5; const got = daysLeft(asStr ? ymd(target) : target.getTime() - int(0, 11) * 36e5, now.getTime());
    let n = 0, d = new Date(now); d.setHours(12, 0, 0, 0); const step = k >= 0 ? 1 : -1; while (ymd(d) !== ymd(target) && Math.abs(n) < 2000) { d.setDate(d.getDate() + step); n += step; }
    if (got === n) res.countdown++; else bad["countdown " + got + " ≠ " + n] = (bad["countdown " + got + " ≠ " + n] || 0) + 1; }
  // habit: a history of ticks, the streak counted by hand
  { const now = new Date(base); now.setDate(now.getDate() + int(30, 900)); now.setHours(int(6, 23));
    const days = rnd() < 0.4 ? null : [...new Set(Array.from({ length: int(1, 5) }, () => int(0, 6)))];
    const start = new Date(now); start.setDate(start.getDate() - int(5, 120)); const h = { days, start: start.getTime() };
    const done = []; for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) { const due = !days || days.includes(d.getDay()); if ((due && rnd() < 0.85) || (!due && rnd() < 0.1)) { const t = new Date(d); t.setHours(int(5, 22)); if (t.getTime() <= now.getTime()) { done.push(t.getTime()); if (rnd() < 0.1) done.push(t.getTime() + 60000); } } }
    const ds = new Set(done.map((t) => ymd(new Date(t))));
    let n = 0; const d = new Date(now); d.setHours(12, 0, 0, 0); const due = (x) => !days || days.includes(x.getDay());
    if (due(d) && ds.has(ymd(d))) n++; d.setDate(d.getDate() - 1); const s0 = new Date(start); s0.setHours(0, 0, 0, 0);
    while (d >= s0) { if (due(d)) { if (ds.has(ymd(d))) n++; else break; } d.setDate(d.getDate() - 1); }
    const g = goalCount(h, done), gWant = [...ds].filter((x) => due(new Date(x + "T12:00:00"))).length;
    const dots = weekDots(h, done, now.getTime()); const dotsOk = dots.length === 7 && dots.every((c) => "doxf".includes(c));
    if (streak(h, done, now.getTime()) === n && g === gWant && dotsOk) res.habit++; else bad["habit"] = (bad["habit"] || 0) + 1; }
  // focus: random start / pause / resume / stop, counted second by second
  { const plan = [10, 25, 45, 60][int(0, 3)], ev = []; let t = base + int(0, 1e6) * 1000; ev.push({ t, e: "start" }); let on = true;
    for (let k = 0, K = int(0, 6); k < K; k++) { t += int(30, 1500) * 1000; ev.push({ t, e: on ? "pause" : "resume" }); on = !on; if (rnd() < 0.1) ev.push({ t, e: on ? "resume" : "pause" }); }
    t += int(10, 1500) * 1000; ev.push({ t, e: "stop" });
    let s = 0, run = false; for (let k = 0; k < ev.length; k++) { const e = ev[k]; if ((e.e === "start" || e.e === "resume") && !run) { run = true; const next = ev.slice(k + 1).find((x) => x.e === "pause" || x.e === "stop"); if (next) s += (next.t - e.t); } else if (e.e === "pause" || e.e === "stop") run = false; if (e.e === "stop") break; }
    if (focused(ev, plan) === Math.min(s, plan * 60000)) res.focus++; else bad["focus"] = (bad["focus"] || 0) + 1; }
}
const out = `# B4 time run (${process.env.TZ || "local"}) — countdowns ${res.countdown}/${N} · habits ${res.habit}/${N} · focus ${res.focus}/${N} (${(100 * (res.countdown + res.habit + res.focus) / (3 * N)).toFixed(2)}%)` + Object.entries(bad).slice(0, 8).map(([k, v]) => `\n- ✗ ${k} × ${v}`).join("") + "\n";
if (N === 10000 && process.env.TZ === "Africa/Cairo") fs.writeFileSync(new URL(+process.env.SEED_SHIFT ? "../onemillion/B-b4time-s" + process.env.SEED_SHIFT + ".md" : "./report.md", import.meta.url), out); console.log(out);
