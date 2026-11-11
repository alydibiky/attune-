// v9.9.18 B4 — 10,000 location traces (arrive, stay, pass by fast, GPS jumps, standing at the edge, leave) and 10,000 weeks to plan
// (calendars, prayer times, work hours, tasks with deadlines), each checked independently: the arrive / leave events are the ones the
// trace was built to have; a planned block never touches a busy slot, a prayer, the night or the deadline, and a task gets all its
// minutes or is reported late — never half.
import fs from "fs"; import { placeEvents, planWeek, meters } from "../../web-src/b4plan.js";
const N = +(process.argv[2] || 10000);
let seed = 20261122; const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1)), M = 60000;
const PLACES = [{ lat: 29.9602, lng: 31.2569 }, { lat: 24.7136, lng: 46.6753 }, { lat: 51.5072, lng: -0.1276 }, { lat: -6.2, lng: 106.8166 }, { lat: 35.6762, lng: 139.6503 }, { lat: 40.7128, lng: -74.006 }];
const at = (p, m, bearing) => ({ lat: p.lat + (m * Math.cos(bearing)) / 111320, lng: p.lng + (m * Math.sin(bearing)) / (111320 * Math.cos((p.lat * Math.PI) / 180)) });
let okP = 0, okW = 0; const bad = {};
for (let i = 0; i < N; i++) {
  // ---- a trace: far → (maybe) inside for a while → far, with jumps and edge noise
  { const P = { ...PLACES[int(0, 5)], r: 150 }, b = rnd() * 6.28, S = [], want = []; let t = 0;
    const kind = int(0, 3);   // 0 arrive+leave, 1 pass by at speed (one sample inside), 2 stand at the edge outside (130–190 m), 3 arrive and stay
    for (let k = 0; k < 5; k++) S.push({ t: (t += M), ...at(P, 2000 - k * 300, b), acc: 20 });
    if (kind === 1) { S.push({ t: (t += M), ...at(P, 40, b), acc: 25 }); for (let k = 0; k < 4; k++) S.push({ t: (t += M), ...at(P, 600 + k * 400, b + 3.14), acc: 20 }); }
    else if (kind === 2) { for (let k = 0; k < 8; k++) S.push({ t: (t += M), ...at(P, 160 + rnd() * 25, b), acc: 15 }); }
    else { for (let k = 0; k < int(3, 12); k++) { S.push({ t: (t += M), ...at(P, rnd() * 90, b + rnd()), acc: 15 }); if (rnd() < 0.3) S.push({ t: (t += M), ...at(P, 3000, b), acc: 900 }); }
      want.push("arrive"); if (kind === 0) { for (let k = 0; k < 4; k++) S.push({ t: (t += M), ...at(P, 400 + k * 500, b + 1), acc: 20 }); want.push("leave"); } }
    const got = placeEvents(S, P).map((e) => e.e);
    if (JSON.stringify(got) === JSON.stringify(want)) okP++; else bad["place kind " + kind + ": " + got.join("+") + " ≠ " + want.join("+")] = (bad["place kind " + kind + ": " + got.join("+") + " ≠ " + want.join("+")] || 0) + 1; }
  // ---- a week to plan
  { const now = new Date(2026, 10, int(1, 25), int(6, 20), int(0, 59)).getTime(), busy = [], prayers = [];
    for (let d = 0; d < 7; d++) { const day = new Date(now); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() + d);
      for (let k = 0; k < int(0, 4); k++) { const f = day.getTime() + int(8 * 60, 21 * 60) * M; busy.push({ from: f, to: f + int(30, 180) * M }); }
      if (rnd() < 0.6) for (const h of [4.8, 12.1, 15.4, 17.9, 19.3]) prayers.push(day.getTime() + Math.round(h * 60) * M); }
    const work = rnd() < 0.5 ? { from: "09:00", to: "22:00" } : { from: "08:00", to: "18:00" };
    const tasks = Array.from({ length: int(1, 6) }, (_, k) => ({ id: "t" + k, minutes: [30, 60, 90, 180, 300, 600][int(0, 5)], due: now + int(1, 7 * 24) * 3600e3 }));
    const r = planWeek(tasks, busy, { now, work, prayers }); let err = "";
    const hmv = (s) => +s.slice(0, 2) * 60 + +s.slice(3);
    for (const b of r.blocks) { const k = tasks.find((x) => x.id === b.id), d = new Date(b.from), m = d.getHours() * 60 + d.getMinutes(), e = new Date(b.to), me = e.getHours() * 60 + e.getMinutes() || 1440;
      if (b.from < now) err = "a block in the past"; else if (b.to > k.due) err = "a block after its deadline"; else if (m < hmv(work.from) || me > hmv(work.to)) err = "a block outside work hours";
      else if (busy.some((x) => b.from < x.to && b.to > x.from)) err = "a block on a busy slot"; else if (prayers.some((p) => b.from < p + 15 * M && b.to > p)) err = "a block on a prayer time";
      if (err) break; }
    if (!err) for (const b of r.blocks) if (r.blocks.some((c) => c !== b && b.from < c.to && b.to > c.from)) { err = "two blocks overlap"; break; }
    if (!err) for (const k of tasks) { const got = r.blocks.filter((b) => b.id === k.id).reduce((a, b) => a + (b.to - b.from) / M, 0); const late = r.late.includes(k.id);
      if (late ? got !== 0 : got < k.minutes) { err = late ? "a late task got half its time" : "a task got less than it needs"; break; } }
    if (err) bad["week: " + err] = (bad["week: " + err] || 0) + 1; else okW++; }
}
const s = `# B4 plan run — places ${okP}/${N} · week plans ${okW}/${N} (${(100 * (okP + okW) / (2 * N)).toFixed(2)}%)` + Object.entries(bad).slice(0, 10).map(([k, v]) => `\n- ✗ ${k} × ${v}`).join("") + "\n";
if (N === 10000) fs.writeFileSync(new URL("./report.md", import.meta.url), s); console.log(s);
