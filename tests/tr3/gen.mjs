// v9.9.25 B7 TR3 the trip's money and papers: exactly 10,000 trips — a budget in the home currency at a rate (EGP→SAR 0.0767, EGP→EUR
// 0.0189, SAR→TRY 9.2, …), 0–12 payments in either currency (with piastres), 2–6 people sharing 1–8 costs (some among a few, odd
// piastres), and a passport against one of the 30 countries' rules (arrive / leave dates, a passport ending just before / on / after the
// day it must last to). Checked (separate integer maths): both columns to the piastre, nothing lost in conversion; the shares add up to
// each cost exactly, the nets sum to ZERO, the transfers pay every debt and number at most people − 1; the passport says renew exactly
// when it ends before arrival/leave + the country's months.
const M = await import(process.env.TR3 || "../../web-src/tripmoney.js");
function rng(seed) { let s = (seed + 7919 * +(process.env.SEED_SHIFT || 0)) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const COUNTRIES = ["eg", "sa", "ae", "kw", "qa", "bh", "om", "jo", "lb", "ma", "dz", "tn", "tr", "pk", "in", "id", "my", "us", "gb", "ca", "de", "fr", "es", "it", "pt", "nl", "br", "mx", "ng", "za"];
const RULE = { sa: [6, 0], ae: [6, 0], kw: [6, 0], qa: [6, 0], bh: [6, 0], om: [6, 0], jo: [6, 0], eg: [6, 0], id: [6, 0], my: [6, 0], in: [6, 0], de: [3, 1], fr: [3, 1], es: [3, 1], it: [3, 1], pt: [3, 1], nl: [3, 1], gb: [0, 1], ca: [0, 1] };
const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
function plusMonths(s, n) { let [y, m, d] = s.split("-").map(Number); m += n; while (m > 12) { m -= 12; y++; } const last = new Date(y, m, 0).getDate(); return y + "-" + String(m).padStart(2, "0") + "-" + String(Math.min(d, last)).padStart(2, "0"); }
export function run(N = 10000, from = 0) {
  let pass = 0; const bad = [];
  for (let i = from; i < from + N; i++) {
    const r = rng(i * 911 + 3), pick = (a) => a[Math.floor(r() * a.length)], why = [];
    // money
    const home = Math.floor(r() * 9000000) / 100, rate = pick([0.0767, 0.0189, 9.2, 0.27, 3.75, 52.3, 1, 0.2667]), spent = [];
    for (let k = 0; k < Math.floor(r() * 13); k++) spent.push({ amount: Math.floor(r() * 500000) / 100, cur: r() < 0.5 ? "trip" : "home" });
    const b = M.budget({ home, rate }, spent);
    let usedC = 0; for (const s of spent) usedC += s.cur === "trip" ? Math.round(Math.round(s.amount * 100) / rate) : Math.round(s.amount * 100);
    const totC = Math.round(home * 100);
    if (Math.round(b.spentHome * 100) !== usedC || Math.round(b.leftHome * 100) !== totC - usedC || Math.round(b.trip * 100) !== Math.round(totC * rate) || b.over !== (totC - usedC < 0)) why.push("budget");
    // split
    const n = 2 + Math.floor(r() * 5), people = ["Ali", "Mona", "Omar", "Sara", "Karim", "Laila"].slice(0, n), costs = [];
    for (let k = 0; k < 1 + Math.floor(r() * 8); k++) { const who = pick(people), sub = r() < 0.4 ? people.filter(() => r() < 0.6) : []; costs.push({ who, amount: Math.floor(r() * 300000 + 1) / 100, for: sub.length ? sub : [] }); }
    const st = M.settle(people, costs);
    const netC = Object.values(st.net).map((v) => Math.round(v * 100));
    if (netC.reduce((a, x) => a + x, 0) !== 0) why.push("nets don't sum to 0");
    // each person's net = paid − share (shares of each cost add up to the cost)
    const paid = Object.fromEntries(people.map((p) => [p, 0])); for (const c of costs) paid[c.who] += Math.round(c.amount * 100);
    const owes = {}; for (const p of people) owes[p] = paid[p] - Math.round(st.net[p] * 100);
    const shareSum = Object.values(owes).reduce((a, x) => a + x, 0), costSum = costs.reduce((a, c) => a + Math.round(c.amount * 100), 0);
    if (shareSum !== costSum) why.push("shares ≠ costs");
    const after = Object.fromEntries(people.map((p) => [p, Math.round(st.net[p] * 100)])); for (const t of st.transfers) { after[t.from] += Math.round(t.amount * 100); after[t.to] -= Math.round(t.amount * 100); }
    if (Object.values(after).some((v) => v !== 0)) why.push("transfers don't settle");
    if (st.transfers.length > n - 1) why.push("too many transfers " + st.transfers.length);
    // papers
    const to = pick(COUNTRIES), arr = new Date(2027, Math.floor(r() * 12), 1 + Math.floor(r() * 28)), lv = new Date(arr.getTime() + (2 + Math.floor(r() * 25)) * 864e5);
    const [months, fromLeave] = RULE[to] || [6, 1], must = plusMonths(iso(fromLeave ? lv : arr), months);
    const pp = new Date(Date.parse(must + "T12:00:00") + (Math.floor(r() * 5) - 2) * 864e5 * pick([1, 1, 30])), passport = iso(pp);
    const pa = M.papers({ to, arrive: iso(arr), leave: iso(lv), passport, visa: r() < 0.5 ? null : r() < 0.5, insurance: r() < 0.5 });
    if (pa.items[0].ok !== (passport >= must)) why.push("passport " + to + " ends " + passport + " must last to " + must + " → " + pa.items[0].ok);
    if (why.length) { if (bad.length < 6) bad.push({ i, why }); } else pass++;
  }
  return { pass, N, rate: pass / N, bad };
}
if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) console.log(JSON.stringify(run(+(process.argv[2] || 10000), +(process.argv[3] || 0))));
