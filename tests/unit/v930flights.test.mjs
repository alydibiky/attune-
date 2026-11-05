// v9.3 (Ali, 5 Nov 2026: "does it understand … check from 1 December to the end of January the cheapest flights to Spain, for 4 days go
// and return?") — a window of days, the length of the trip, a country as the destination; and "buy now or wait?" (D3 A).
import * as F from "../../web-src/flights.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const now = Date.parse("2026-11-05T12:00:00");
const w = (t) => F.windowIn(t, { now }) || {};
ok(w("from 1 December to the end of January").from === "2026-12-01" && w("from 1 December to the end of January").to === "2027-01-31", "“from 1 December to the end of January” → 1 Dec – 31 Jan");
ok(w("من ١ ديسمبر لآخر يناير").from === "2026-12-01" && w("من ١ ديسمبر لآخر يناير").to === "2027-01-31", "«من ١ ديسمبر لآخر يناير» → the same window");
ok(w("anytime in December or January").from === "2026-12-01" && w("anytime in December or January").to === "2027-01-31", "“anytime in December or January”");
ok(w("in February").to === "2027-02-28" && w("في شهر فبراير").to === "2027-02-28", "“in February” / «في شهر فبراير» → the whole month (28 days in 2027)");
ok(w("between 10 Dec and mid January").to === "2027-01-15", "“mid January” → the 15th");
ok(w("in November").from === "2026-11-05", "a month that has started → from today, not from the 1st");
ok(!F.windowIn("from Cairo to Madrid on 3 December", { now }), "a route with one day is not a window");
ok(F.stayIn("4 days go and return").nights === 3 && F.stayIn("5 nights").nights === 5 && F.stayIn("٤ ايام").nights === 3 && F.stayIn("for a week").nights === 7 && F.stayIn("اسبوع").nights === 7, "trip length: 4 days = 3 nights, 5 nights, «٤ ايام», a week, «اسبوع»");
ok(F.countryIn("to Spain").code === "ES" && F.countryIn("لاسبانيا").code === "ES" && F.countryIn("to Turkey").airports.includes("IST") && !F.countryIn("to Madrid"), "countries: Spain, «لاسبانيا», Turkey (IST) — a city is not a country");
const A = (t) => F.flightAgent(t, { now, country: "EG" });
const a1 = A("watch the cheapest flights from Cairo to Spain from 1 December to end of January, 4 days go and return");
ok(a1 && a1.kind === "watch" && a1.fields.flight.window.to === "2027-01-31" && a1.fields.flight.stay === 3 && a1.fields.flight.toCountry === "ES", "Ali's sentence → a flight agent over the window, 4-day trips, to Spain: " + (a1 && a1.title));
ok(a1.tries.length === 8 && a1.tries[0].depart === "2026-12-01" && a1.tries[7].depart <= "2027-01-28" && new Set(a1.tries.map((x) => x.site)).size === 3, "…8 departure days across the window, on Kayak, Skyscanner and momondo in turn: " + a1.tries.map((x) => x.depart.slice(5)).join(" "));
ok(/CAI-MAD,BCN,AGP\/2026-12-01-flexible-3days\/2026-12-04-flexible-3days/.test(a1.tries[0].url) && /\/cai\/es\/261209\/261212\//.test(a1.tries[1].url), "…Kayak gets Spain's main airports ± 3 days; Skyscanner the country itself");
ok(a1.tries.every((x) => x.label === x.site + "|" + x.depart), "…each page is labelled with its site and day (the board's price-by-day grid)");
const a2 = A("دورلي على ارخص طيران من القاهرة لاسبانيا من ١ ديسمبر لآخر يناير ٤ ايام رايح جاي");
ok(a2 && a2.kind === "watch" && a2.fields.flight.toCountry === "ES" && a2.fields.flight.window.from === "2026-12-01" && a2.fields.flight.stay === 3, "the same in Egyptian Arabic");
const a3 = A("cheapest flights from Cairo to Dubai in February direct only");
ok(a3.kind === "do" && a3.plan.missing.some((x) => /How many days/.test(x)), "a window with no trip length (and not one way) → asks how many days");
ok(A("cheapest flight from Cairo to Jeddah on 8 January back 13 January").tries.length === 6, "a normal flight (one day) still searches the 6 sites as before");
// organised by the day tried
const g = F.organise([{ price: 9800, text: "EgyptAir 07:10 - 12:00", site: "Kayak", depart: "2026-12-01" }, { price: 9100, text: "Iberia 10:00 - 15:00", site: "Skyscanner", depart: "2026-12-09" }], {}, a1.fields.flight);
ok(g.days.length === 2 && g.days[1].date === "2026-12-09" && g.days[1].price === 9100, "price by departure day: the day each page tried");
// buy or wait
const ch = (...p) => p.map((price, i) => ({ at: now - (p.length - i) * 864e5, price }));
ok(F.adviseBuy(ch(9000, 9500), { depart: "2027-01-10", now }).say === "" && /Not enough/.test(F.adviseBuy(ch(9000), { now }).why), "fewer than 3 checks → no advice yet");
ok(F.adviseBuy(ch(9800, 9600, 9100), { depart: "2027-01-10", now }).say === "buy", "at the lowest seen → buy");
ok(F.adviseBuy(ch(9000, 9200, 9400, 9700), { depart: "2027-01-10", now }).say === "buy", "rising 3 checks in a row → buy");
ok(F.adviseBuy(ch(8000, 9900, 9700, 9500), { depart: "2027-01-10", now }).say === "wait", "falling and more than a month away → wait");
ok(F.adviseBuy(ch(9000, 9900, 9500), { depart: "2026-11-15", now }).say === "buy", "less than 2 weeks to go → buy");
ok(F.adviseBuy(ch(9000, 9900, 9500), { depart: "2027-01-10", now }).conf === "low" && F.adviseBuy(ch(1, 2, 3, 4, 5, 6), { now }).conf === "medium", "confidence grows with the number of checks");
