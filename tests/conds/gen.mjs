// v9.9.27 rule conditions on the phone (money rules, message alerts, phone rules): exactly 10,000 cases — a rule with 0–3 conditions
// (after / before a time, both — sometimes over midnight —, weekdays / the weekend of Egypt (Fri–Sat), the UAE / Saudi (Sat–Sun / Fri–Sat),
// more / less than an amount) and an event at a random moment of a week with an amount read (or none). A separate oracle says fire or not.
// Checked: exactly — never a "more than 1,000" fired without an amount, never outside the hours / days.
const P = await import(process.env.CD || "../../web-src/phonerules.js");
function rng(seed) { let s = (seed + 7919 * +(process.env.SEED_SHIFT || 0)) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function oracle(ifs, at, we, amount) {
  const d = new Date(at), m = d.getHours() * 60 + d.getMinutes(), isWe = we.includes(d.getDay());
  let a = null, b = null;
  for (const x of ifs) {
    if (x.type === "weekdays" && isWe) return false; if (x.type === "weekend" && !isWe) return false;
    if (x.type === "more" && (amount == null || amount <= x.amount)) return false; if (x.type === "less" && (amount == null || amount >= x.amount)) return false;
    if (x.type === "after") a = x.at.h * 60 + x.at.m; if (x.type === "before") b = x.at.h * 60 + x.at.m; }
  if (a != null && b != null) return a <= b ? (m >= a && m < b) : (m >= a || m < b);
  if (a != null) return m >= a; if (b != null) return m < b; return true;
}
export function run(N = 10000, from = 0) {
  let pass = 0; const bad = [];
  for (let i = from; i < from + N; i++) {
    const r = rng(i * 29 + 3), pick = (x) => x[Math.floor(r() * x.length)], ifs = [];
    const kinds = ["after", "before", "weekdays", "weekend", "more", "less"];
    for (let k = 0; k < Math.floor(r() * 4); k++) { const t = pick(kinds); if (ifs.some((x) => x.type === t)) continue;
      if (t === "after" || t === "before") ifs.push({ type: t, at: { h: Math.floor(r() * 24), m: pick([0, 15, 30, 45]) } });
      else if (t === "more" || t === "less") ifs.push({ type: t, amount: pick([500, 1000, 2500, 10000]) }); else ifs.push({ type: t }); }
    const we = pick([[5, 6], [6, 0], [5, 6]]), at = new Date(2026, 10, 8 + Math.floor(r() * 7), Math.floor(r() * 24), Math.floor(r() * 60)).getTime();
    const amount = r() < 0.2 ? null : pick([499, 500, 501, 999, 1000, 1001, 2500, 9999, 10000, 15000, 120]);
    const got = P.condOk(ifs, at, we, amount), want = oracle(ifs, at, we, amount);
    if (got === want) pass++; else if (bad.length < 6) bad.push({ i, ifs, at: new Date(at).toString().slice(0, 21), amount, got, want });
  }
  return { pass, N, rate: pass / N, bad };
}
if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) console.log(JSON.stringify(run(+(process.argv[2] || 10000), +(process.argv[3] || 0))));
