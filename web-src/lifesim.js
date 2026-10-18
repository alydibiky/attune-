/* ---- v6.38 Missions phase 2 — the Life Simulator inside Missions (agent B): test a big decision before you make it.
   "Buy the car cash or in installments?", "take the flat with the higher rent?", "buy a second crane?" — each option is
   money now, money every month for some months, and what you get (a car keeps part of its value). From YOUR Money history
   it runs thousands of futures, 5 years ahead, month by month:
     - each month's net (income − spending) is one of your own past 30-day stretches (a bootstrap), in today's pounds;
     - inflation is drawn each year (Egypt: mean 25%, ±8) — installments are fixed in pounds, so they shrink in real terms;
     - savings earn the bank certificate rate (default 20%) — after inflation that is often a loss, and the model says so;
     - stress tests: the pound loses 30% (a year of +20 points inflation), inflation at 35% for five years, three months
       without income.
   Everything is in TODAY's pounds. Pure, seeded (the same data gives the same answer); tests/unit/v740lifesim.test.mjs.  */
const DAY = 86400000;
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = (r) => { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const q = (arr, p) => { const a = [...arr].sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.max(0, Math.floor(p * (a.length - 1))))] : 0; };

export const DEFAULTS = { inflation: 0.25, inflationSd: 0.08, certificate: 0.20, depreciation: 0.08, years: 5, sims: 2000 };
export const STRESS = [
  { id: "pound", en: "The pound loses 30%", ar: "الجنيه يخسر 30%", inflAdd: [0.2] },
  { id: "infl35", en: "Inflation at 35% for five years", ar: "تضخم 35% لمدة 5 سنين", inflFix: 0.35 },
  { id: "noincome", en: "Three months without income", ar: "3 شهور من غير دخل", noIncome: [2, 3, 4] },
];

/** Your money in 30-day stretches: { blocks: [net per 30 days], income, spend (monthly averages) } from daily nets + incomes. */
export function monthlyBlocks(net, income) {
  if (!net || net.length < 30) return null;
  const blocks = [], inc = [];
  for (let i = 0; i + 30 <= net.length; i++) { blocks.push(net.slice(i, i + 30).reduce((a, b) => a + b, 0)); if (income) inc.push(income.slice(i, i + 30).reduce((a, b) => a + b, 0)); }
  const avg = (l) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0);
  const income30 = income ? avg(inc) : 0;
  return { blocks, income: income30, spend: income30 - avg(blocks) };
}

/**
 * options: [{ name, now (paid today), monthly, months, value (what you get, in today's pounds; 0 for none) }]
 * → { results: [{ name, ok (chance cash never goes below 0), at: {1,3,5: {p10, p50, p90}} (cash), worth5 (p50 cash + what you own),
 *      lowest (p10 of the lowest point), stress: [{ id, ok, p50 }] }], best, months }
 */
export function simulate({ blocks, balance = 0, options = [], rates = {}, seed = 7, stress = true } = {}) {
  if (!blocks || !blocks.blocks || blocks.blocks.length < 1) return null;
  const R = { ...DEFAULTS, ...rates }, months = R.years * 12;
  const run = (opt, sc = {}) => {
    const r = rng(seed), oks = [], cash = { 12: [], 36: [], 60: [] }, lows = [], worth = [];
    for (let s = 0; s < R.sims; s++) {
      let bal = balance - (opt.now || 0), price = 1, low = bal, infl = 0;
      for (let m = 1; m <= months; m++) {
        if ((m - 1) % 12 === 0) { const y = (m - 1) / 12; infl = sc.inflFix != null ? sc.inflFix : R.inflation + R.inflationSd * gauss(r) + ((sc.inflAdd && sc.inflAdd[y]) || 0); infl = Math.max(-0.05, infl); }
        const mi = Math.pow(1 + infl, 1 / 12) - 1;
        price *= 1 + mi;
        // savings earn the certificate rate in pounds; in today's pounds that is (1 + rate) / (1 + inflation) − 1
        if (bal > 0) bal *= (1 + R.certificate / 12) / (1 + mi);
        let net = blocks.blocks[Math.floor(r() * blocks.blocks.length)];
        if (sc.noIncome && sc.noIncome.includes(m)) net = -blocks.spend;
        bal += net;
        if (opt.monthly && m <= (opt.months || 0)) bal -= opt.monthly / price;   // a fixed installment: smaller each month in today's pounds
        if (bal < low) low = bal;
        if (cash[m]) cash[m].push(bal);
      }
      oks.push(low >= 0 ? 1 : 0); lows.push(low);
      worth.push(bal + (opt.value || 0) * Math.pow(1 - R.depreciation, R.years));
    }
    const pk = (l) => ({ p10: Math.round(q(l, 0.1)), p50: Math.round(q(l, 0.5)), p90: Math.round(q(l, 0.9)) });
    return { ok: oks.reduce((a, b) => a + b, 0) / R.sims, at: { 1: pk(cash[12]), 3: pk(cash[36]), 5: pk(cash[60]) }, worth5: Math.round(q(worth, 0.5)), lowest: Math.round(q(lows, 0.1)) };
  };
  const all = [{ name: "Don't do it", now: 0, monthly: 0, months: 0, value: 0, base: true }, ...options];
  const results = all.map((o) => ({ name: o.name, base: !!o.base, ...run(o), stress: stress ? STRESS.map((sc) => { const x = run(o, sc); return { id: sc.id, ok: x.ok, p50: x.at[5].p50 }; }) : [] }));
  // the best real option: the most you own after 5 years among those that stay safe (≥ 90% never run out), else the safest
  const real = results.filter((x) => !x.base);
  const safe = real.filter((x) => x.ok >= 0.9);
  const best = (safe.length ? safe.sort((a, b) => b.worth5 - a.worth5)[0] : real.sort((a, b) => b.ok - a.ok)[0]) || null;
  return { results, best: best && best.name, months };
}

/** One plain sentence about the result (English template + values, for tr()). */
export function verdict(sim) {
  if (!sim || !sim.best) return null;
  const b = sim.results.find((x) => x.name === sim.best), others = sim.results.filter((x) => !x.base && x.name !== sim.best);
  const o = others[0];
  const v = { best: b.name, ok: Math.round(b.ok * 100), worth: b.worth5.toLocaleString("en-US") };
  if (b.ok < 0.9) return ["Careful: with every option, your cash runs out in more than 1 future in 10. The safest is {best} ({ok}% of futures stay above zero).", v];
  if (!o) return ["{best}: {ok}% of futures never run out of cash; after 5 years you would have about {worth} (today's pounds, including what you bought).", v];
  return ["{best} is better: {ok}% of futures never run out of cash, and after 5 years you would have about {worth} in today's pounds — {diff} more than {other}.", { ...v, other: o.name, diff: Math.max(0, b.worth5 - o.worth5).toLocaleString("en-US") }];
}
