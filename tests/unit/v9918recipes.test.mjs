// v9.9.18 AU3 recipes: what the gallery offers and the rules it switches on, checked on real dates (Ramadan, a trip, the car).
import { gallery, nextRamadan, daysTo } from "../../web-src/recipes.js";
let bad = 0; const ok = (c, t) => { console.log((c ? "PASS " : "FAIL ") + t); if (!c) bad++; };
const DAY = 864e5, now = Date.parse("2026-11-12T10:00:00");
const base = { salaryDay: 25, rent: 0, gameya: 0, carFund: "", family: [], car: false, licenceAt: 0, kids: 0, tripAt: 0, baby: false, prayersOn: false, weekend: [5, 6] };
{ const g = gallery(base, now); ok(g.length === 1 && g[0].id === "salary", "a salary alone → only Salary day"); 
  const s = g[0].rules; ok(s.find((x) => x.id === "split").on && !s.find((x) => x.id === "rent").on, "no rent in the data → the rent rule is off"); }
{ const r = nextRamadan(now); ok(r && new Date(r).getFullYear() === 2027 && new Date(r).getMonth() === 1, "next Ramadan from Nov 2026 is in Feb 2027: " + (r && new Date(r).toDateString()));
  ok(!gallery({ ...base, prayersOn: false }, now).some((x) => x.id === "ramadan"), "Ramadan is not offered while prayers are off (Ali, 5 Nov)");
  const g = gallery({ ...base, prayersOn: true, kids: 2 }, now).find((x) => x.id === "ramadan"); ok(!!g && g.n === daysTo(r, now), "prayers on → Ramadan offered, days counted");
  const su = g.rules.find((x) => x.id === "suhoor").rule.when; ok(su.from === r && su.until === r + 30 * DAY && su.at.h === 3, "suhoor runs from the first day for 30 days at 3:30");
  ok(g.rules.find((x) => x.id === "eidiya").on && g.rules.find((x) => x.id === "zakat").rule.when.once, "eidiya on with children, zakat rings once"); }
{ const trip = Date.parse("2026-12-20T12:00:00"), g = gallery({ ...base, tripAt: trip }, now).find((x) => x.id === "trip");
  ok(!!g && g.rules.every((x) => x.on), "a trip in 38 days → papers and packing both on");
  const pk = g.rules.find((x) => x.id === "pack").rule.when; ok(pk.once && new Date(pk.from).getDate() === 18, "packing two days before (18 Dec), once");
  const g2 = gallery({ ...base, tripAt: now + 10 * DAY }, now).find((x) => x.id === "trip"); ok(!g2.rules.find((x) => x.id === "papers").on, "a trip in 10 days → the 30-days-before papers check is off (already late)"); }
{ const g = gallery({ ...base, kids: 1, weekend: [5, 6] }, now).find((x) => x.id === "school"); const d = g.rules.find((x) => x.id === "bag").rule.when.days;
  ok(!d.includes(4) && !d.includes(5) && d.includes(6) && d.includes(0), "Egypt: no bag on Thursday / Friday night, yes on Saturday / Sunday night");
  const g2 = gallery({ ...base, kids: 1, weekend: [0, 6] }, now).find((x) => x.id === "school").rules.find((x) => x.id === "bag").rule.when.days;
  ok(!g2.includes(5) && !g2.includes(6) && g2.includes(0), "Sat–Sun weekend: no bag on Friday / Saturday night, yes on Sunday"); }
{ const g = gallery({ ...base, car: true }, now).find((x) => x.id === "car"); ok(!g.rules.find((x) => x.id === "licence").on && g.rules.find((x) => x.id === "check").on, "a car with no licence date → only the monthly check"); }
console.log(bad ? "FAIL " + bad + " failed" : "ALL PASSED"); if (bad) process.exitCode = 1;
