// v9.9.18 AU5 "nag until done" — 10,000 reminder timelines (run.sh: 2,000 in each of 5 time zones), each checked against an
// independent minute-by-minute simulation: the first ring, no ring in quiet hours, the gap = the level, the cap, nothing after the tick.
import fs from "fs";
import { rings, LEVELS, inQuiet } from "../../web-src/nag.js";
const N = +(process.argv[2] || 2000), TZ = process.env.TZ || "local";
let seed = 20261112 + [...TZ].reduce((a, c) => a + c.charCodeAt(0), 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const QUIETS = [null, null, { from: "23:00", to: "07:00" }, { from: "22:30", to: "06:00" }, { from: "00:00", to: "08:00" }, { from: "13:00", to: "15:00" }, { from: "21:00", to: "09:30" }];
const M = 60000, base = Date.parse("2026-11-11T00:00:00");
const bad = {}; let ok = 0;
for (let i = 0; i < N; i++) {
  const lvl = pick(LEVELS), quiet = pick(QUIETS), at = base + int(0, 60 * 24 * 40) * M;   // any minute over 40 days (DST changes inside some zones)
  const r = { id: "r" + i, at, ...(rnd() < 0.2 && lvl.id === "m15" ? { important: true } : { nag: lvl.id }) };
  const doneAt = rnd() < 0.5 ? Infinity : at + int(1, 600) * M, until = at + 2 * 864e5;
  const got = rings(r, { quiet, doneAt, until });
  // the oracle: walk minute by minute
  const exp = []; let t = at; while (quiet && inQuietO(t, quiet)) t += M;
  let n = 0;
  while (t < doneAt && t <= until && exp.length < 500) {
    exp.push(t); if (!lvl.every || (lvl.cap && n >= lvl.cap)) break; n++;
    t += lvl.every * M; while (quiet && inQuietO(t, quiet)) t += M;
  }
  const why = JSON.stringify(got) === JSON.stringify(exp) ? "" : got.length !== exp.length ? "count " + got.length + " ≠ " + exp.length : "a ring at the wrong minute";
  if (why) (bad[lvl.id + " · " + why] = bad[lvl.id + " · " + why] || []).push(new Date(at).toISOString() + " " + JSON.stringify(quiet)); else ok++;
}
function inQuietO(t, q) { const d = new Date(t), m = d.getHours() * 60 + d.getMinutes(), [fh, fm] = q.from.split(":").map(Number), [th, tm] = q.to.split(":").map(Number), f = fh * 60 + fm, to = th * 60 + tm; return f < to ? m >= f && m < to : m >= f || m < to; }
const pct = (100 * ok / N).toFixed(2);
console.log(`${TZ}: ${ok} of ${N} right (${pct}%)` + Object.entries(bad).map(([k, v]) => `\n  ✗ ${k} × ${v.length}: ${v.slice(0, 3).join(" · ")}`).join(""));
if (process.env.NAG_OUT) fs.appendFileSync(process.env.NAG_OUT, JSON.stringify({ TZ, ok, N }) + "\n");
