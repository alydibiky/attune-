// v9.9.24 B6 X2 Upkeep: exactly 10,000 logs — half a car's service history (oil / filters / tyres / brakes / battery / service, with
// or without the km, the odometer moved on), half a home item (every N months, every N days, or no set time with 2–8 past dates to
// learn from); then Done or Done + cost. Checked by a separate oracle: the next date by MONTHS (end of month kept: 31 Aug + 6 → 28/29
// Feb), the next km, which comes first, "due now", the learned "about every N days" (median gap), and Done adds exactly one log line
// — with a Money expense only when there is a cost.
const U = await import(process.env.X2 || "../../web-src/upkeep.js");
const { SERVICES } = await import("../../web-src/car.js");
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 22695477 + 1) >>> 0) / 4294967296); }
const NOW = Date.parse("2026-11-12T12:00:00"), DAY = 864e5;
const iso = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const T = (s) => Date.parse(s + "T12:00:00");
function plusMonths(s, n) { let [y, m, d] = s.split("-").map(Number); m += n; while (m > 12) { m -= 12; y++; } const last = new Date(y, m, 0).getDate(); return y + "-" + String(m).padStart(2, "0") + "-" + String(Math.min(d, last)).padStart(2, "0"); }
const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : Math.round((s[n / 2 - 1] + s[n / 2]) / 2); };
export function run(N = 10000, from = 0) {
  let pass = 0; const bad = [];
  for (let i = from; i < from + N; i++) {
    const r = rng(i * 69069 + 5), why = [];
    if (i % 2 === 0) {   // a car
      const keys = Object.keys(SERVICES).filter((k) => SERVICES[k][1] || SERVICES[k][2]), sv = keys[Math.floor(r() * keys.length)], [, everyKm, everyMo] = SERVICES[sv];
      const lastDate = iso(NOW - Math.floor(r() * 900) * DAY), withKm = r() < 0.75, lastKm = withKm ? 1000 + Math.floor(r() * 90000) : 0, kmNow = lastKm + Math.floor(r() * 50000);
      const car = { km: kmNow, log: [{ kind: "service", service: sv, km: lastKm, date: lastDate }] };
      const L = U.carLines(car, NOW).find((x) => x.service === sv);
      const dueKm = everyKm && lastKm ? lastKm + everyKm : null, dueDate = everyMo ? plusMonths(lastDate, everyMo) : null;
      const kmLeft = dueKm ? dueKm - Math.max(kmNow, lastKm) : null, daysLeft = dueDate ? Math.round((T(dueDate) - T(iso(NOW))) / DAY) : null;
      const fk = kmLeft != null ? (everyKm - kmLeft) / everyKm : -1, fd = daysLeft != null ? 1 - daysLeft / (everyMo * 30.44) : -1;
      if (!L) why.push("no line");
      else {
        if (L.due !== dueDate) why.push("date " + L.due + " ≠ " + dueDate);
        if (L.dueKm !== dueKm) why.push("km " + L.dueKm + " ≠ " + dueKm);
        if (L.dueNow !== ((kmLeft != null && kmLeft <= 500) || (daysLeft != null && Math.abs(L.daysLeft - daysLeft) <= 1 && daysLeft <= 14))) why.push("due now " + L.dueNow + " (km left " + kmLeft + ", days " + daysLeft + ")");
        if (L.by !== (kmLeft != null && fk >= fd ? "km" : "date")) why.push("which first: " + L.by);
      }
    } else {   // a home item
      const kind = Math.floor(r() * 3), it = { id: "h" + i, name: "Item " + i, log: [] };
      let want = null;
      if (kind === 0) { it.everyMonths = [1, 3, 6, 12][Math.floor(r() * 4)]; const d = iso(NOW - Math.floor(r() * 400) * DAY); it.log = [{ date: d }]; want = plusMonths(d, it.everyMonths); }
      else if (kind === 1) { it.everyDays = 7 + Math.floor(r() * 80); const d = iso(NOW - Math.floor(r() * 200) * DAY); it.log = [{ date: d }]; want = iso(T(d) + it.everyDays * DAY); }
      else { const n = 2 + Math.floor(r() * 7), base = 20 + Math.floor(r() * 40); let t = NOW - (n + 1) * base * DAY; const ds = [];
        for (let k = 0; k < n; k++) { t += (base + Math.floor(r() * 9) - 4) * DAY; ds.push(iso(t)); } it.log = ds.map((date) => ({ date }));
        const gaps = ds.slice(1).map((d, k) => Math.round((T(d) - T(ds[k])) / DAY)).filter((g) => g > 0);
        want = gaps.length >= 2 ? iso(T(ds[ds.length - 1]) + median(gaps) * DAY) : null; }
      const L = U.homeLine(it, NOW);
      if (L.due !== want) why.push("next " + L.due + " ≠ " + want + " (" + JSON.stringify(it).slice(0, 120) + ")");
      if (want && L.dueNow !== (Math.round((T(want) - T(iso(NOW))) / DAY) <= 7)) why.push("due now");
      // Done / Done + cost
      const cost = r() < 0.5 ? 50 + Math.floor(r() * 900) : 0, res = U.doneHome(it, { cost, now: NOW });
      if (res.item.log.length !== it.log.length + 1 || res.item.log[res.item.log.length - 1].date !== iso(NOW)) why.push("done didn't add today");
      if (cost ? !(res.money && res.money.amount === cost && res.money.type === "expense") : res.money) why.push("money " + JSON.stringify(res.money));
      if (U.homeLine(res.item, NOW).last !== iso(NOW)) why.push("last after done");
    }
    if (why.length) { if (bad.length < 6) bad.push({ i, why }); } else pass++;
  }
  return { pass, N, rate: pass / N, bad };
}
if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) console.log(JSON.stringify(run(+(process.argv[2] || 10000), +(process.argv[3] || 0))));
