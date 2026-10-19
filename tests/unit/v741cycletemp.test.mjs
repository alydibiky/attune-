// v6.41 F4: ovulation from the watch's night temperature ("3 over 6"), the person's own luteal length, the next period.
import * as C from "../../web-src/cycletemp.js";
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
const day = (k, n) => new Date(Date.parse(k + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);
// a cycle from 2026-08-01: low ~ -0.1 until day 16, then +0.3 until the next period on 2026-08-30 (ovulation 08-16 → luteal 14)
const nights = [];
const cyc = (start, ovDay, len, noise = 0) => { for (let i = 0; i < len; i++) { const d = day(start, i); const hi = i > ovDay; nights.push({ day: d, t: (hi ? 0.3 : -0.1) + (((i * 7) % 5) - 2) * 0.02 * noise }); } };
cyc("2026-08-01", 15, 29, 1);   // ovulation 08-16, period 08-30
cyc("2026-08-30", 17, 31, 1);   // ovulation 09-16, period 09-30
cyc("2026-09-30", 13, 18, 1);   // this cycle: ovulation 10-13, nights high from 10-14 to 10-17
const sh = C.tempShifts(nights);
ok(sh.length === 3 && sh[0].ovulation === "2026-08-16" && sh[1].ovulation === "2026-09-16" && sh[2].ovulation === "2026-10-13", "3 rises found, ovulation the night before each: " + sh.map((s) => s.ovulation));
ok(sh.every((s) => s.rise >= 0.2), "each rise ≥ 0.2 °C: " + sh.map((s) => s.rise));
const L = C.lutealLength(["2026-08-01", "2026-08-30", "2026-09-30"], sh);
ok(L.days === 14 && L.own && L.n === 2, "her own luteal length: 14 days, from 2 cycles: " + JSON.stringify(L));
const stats = { last: { start: "2026-09-30" }, periods: [{ start: "2026-08-01" }, { start: "2026-08-30" }, { start: "2026-09-30" }], ovulation: "2026-10-16", nextStart: "2026-10-30" };
const w = C.withTemperature(stats, nights, "2026-10-17");
ok(w.temp.ovulation === "2026-10-13" && w.nextStart === "2026-10-27" && w.temp.luteal.own, "this cycle: ovulation 13 Oct by temperature → period 27 Oct (the average said 30 Oct)");
// no rise yet and past the usual day → waiting
const flat = nights.filter((x) => x.day < "2026-10-01").concat(Array.from({ length: 22 }, (_, i) => ({ day: day("2026-10-01", i), t: -0.1 })));
const w2 = C.withTemperature({ ...stats, ovulation: "2026-10-16" }, flat, "2026-10-21");
ok(w2.temp.waiting && w2.temp.ovulation === null && w2.nextStart === "2026-10-30", "no rise yet, 5 days past the usual ovulation → 'later than usual', the average date kept");
// noise: one hot night is not a rise
const one = Array.from({ length: 14 }, (_, i) => ({ day: day("2026-07-01", i), t: i === 8 ? 0.6 : 0 }));
ok(C.tempShifts(one).length === 0, "one warm night (a fever, a hot room) is not a rise");
ok(C.withTemperature(stats, nights.slice(0, 5), "2026-10-15").temp === null, "fewer than 9 nights → no temperature reading");
ok(C.mergeNights([{ day: "2026-10-01", t: 0.1 }], [{ day: "2026-10-01", t: 0.2 }, { day: "2026-10-02", t: 0.3 }]).map((x) => x.t).join() === "0.2,0.3", "nights merge by day; the newest reading wins");
console.log(bad ? bad + " FAILED" : "v741cycletemp ok");
