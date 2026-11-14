// v9.9.28 place reminders: exactly 10,000 sequences of Android proximity events (entered / left, with Android's repeats) for an "arrive"
// or a "leave" reminder: real visits (minutes to hours), drive-pasts (in and out within a minute), GPS bounces (out and back within
// 2 minutes), around-the-block (back within 10 minutes), new visits after 10+ minutes away, done reminders. A separate oracle (works from
// whole visits: arrive = its start; leave = the first exit after 3+ minutes in it) says when it must ring. Checked: exactly those rings.
const P = await import(process.env.PL || "../../web-src/placering.js");
function rng(seed) { let s = (seed + 7919 * +(process.env.SEED_SHIFT || 0)) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export function make(i) {
  const r = rng(i * 53 + 7), on = r() < 0.5 ? "arrive" : "leave", done = r() < 0.05, evs = [], visits = [];
  let t = Date.parse("2026-11-13T08:00:00");
  for (let v = 0; v < 1 + Math.floor(r() * 5); v++) {
    t += (10 + Math.floor(r() * 300)) * 60000 + 1;   // ≥ 10 min away → a new visit
    const start = t, leaves = [];
    let inside = Math.floor(r() * 120) * 60000 + (r() < 0.25 ? 20000 : 60000);   // some are drive-pasts (20 s)
    evs.push({ at: t, entering: true }); if (r() < 0.2) evs.push({ at: t + 1000, entering: true });   // Android repeats
    t += inside;
    // sometimes bounces / around the block within the same visit
    for (let k = 0; k < Math.floor(r() * 3); k++) { evs.push({ at: t, entering: false }); leaves.push(t); const gap = (r() < 0.5 ? 30 : 300 + Math.floor(r() * 290)) * 1000; t += gap; evs.push({ at: t, entering: true }); t += Math.floor(r() * 20) * 60000 + 5000; }
    evs.push({ at: t, entering: false }); leaves.push(t); visits.push({ start, end: t, leaves });
  }
  return { rem: { on, done }, evs, visits };
}
function oracle(rem, visits) {
  if (rem.done) return [];
  // "leave": the first time it leaves after being in this visit 3+ minutes (the phone can't know you'll come back)
  return visits.map((v) => rem.on === "arrive" ? v.start : (v.leaves.find((t) => t - v.start >= 3 * 60000) ?? null)).filter((x) => x != null);
}
export function run(N = 10000, from = 0) {
  let pass = 0; const bad = [];
  for (let i = from; i < from + N; i++) {
    const c = make(i); let st = {}; const rings = [];
    for (const e of c.evs) { const d = P.placeRing(c.rem, e, st, e.at); st = d.state; if (d.ring) rings.push(e.at); }
    const want = oracle(c.rem, c.visits);
    if (JSON.stringify(rings) === JSON.stringify(want)) pass++; else if (bad.length < 5) bad.push({ i, on: c.rem.on, rings: rings.length, want: want.length });
  }
  return { pass, N, rate: pass / N, bad };
}
if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) console.log(JSON.stringify(run(+(process.argv[2] || 10000), +(process.argv[3] || 0))));
