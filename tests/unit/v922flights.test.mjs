// v9.2 the flight agent (Ali, 4 Nov 2026: "the cheapest flight tickets with the modifications I want" — 3A, organised, many places)
import * as F from "../../web-src/flights.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const NOW = new Date("2026-11-04T10:00:00").getTime();

const s = "cheapest flight from Cairo to Jeddah on 8 January, ± 3 days, return 13 January, direct, one bag, morning, under 12,000";
ok(F.isFlightAgent(s) && F.isFlightAgent("ارخص تذكرة طيران من القاهرة لجدة يوم 8 يناير") && !F.isFlightAgent("book a hotel in Makkah") && !F.isFlightAgent("how long is a flight to Jeddah?"), "a flight sentence for an agent is recognised (not a hotel, not a question)");
const p = F.parseFlight(s, { now: NOW });
ok(p && p.ok && p.f.from === "CAI" && p.f.to === "JED" && p.f.depart === "2027-01-08" && p.f.ret === "2027-01-13", "route and days read: " + JSON.stringify(p && p.f));
ok(p.flex === 3 && p.below === 12000, "± 3 days, under 12,000");
ok(p.rules.maxStops === 0 && p.rules.bags === 1 && p.rules.timeOfDay === "morning", "the conditions become rules (direct, 1 bag, morning): " + JSON.stringify(p.rules));
const ar = F.parseFlight("ارخص تذكرة طيران من القاهرة لجدة يوم 8 يناير مباشر الصبح", { now: NOW });
ok(ar && ar.f.from === "CAI" && ar.f.to === "JED" && ar.rules.maxStops === 0 && ar.rules.timeOfDay === "morning", "in Egyptian Arabic too: " + JSON.stringify(ar && { f: ar.f, r: ar.rules }));
ok(F.flexIn("around the 8th") === 3 && F.flexIn("plus or minus 2 days") === 2 && F.flexIn("on the 8th") === 0, "flexible days: around → 3, ± 2, none");

// many places, each link carrying the conditions
const tries = F.flightTries({ ...p.f, direct: true }, 3);
ok(tries.length === 6 && tries.map((t) => t.site).join() === "Kayak,momondo,Google Flights,Skyscanner,Expedia,Wego", "6 places: " + tries.map((t) => t.site));
ok(/CAI-JED\/2027-01-08-flexible-3days\/2027-01-13-flexible-3days\/1adults\?sort=price_a&fs=stops=0/.test(tries[0].url), "Kayak: ± 3 days, cheapest first, direct: " + tries[0].url);
ok(/nonstop/.test(decodeURIComponent(tries[2].url)) && /preferdirects=true/.test(tries[3].url) && /maxhops%3A0/.test(tries[4].url), "Google Flights / Skyscanner / Expedia carry “direct”");
const ag = F.flightAgent(s, { now: NOW, currency: "EGP" });
ok(ag.kind === "watch" && ag.fields.flight.from === "CAI" && ag.tries.length === 6 && ag.below === 12000 && /Flights · CAI → JED · 08\/01 → 13\/01 ±3/.test(ag.title), "→ a flight agent: " + ag.title);
const miss = F.flightAgent("cheapest flight to Jeddah", { now: NOW });
ok(miss && miss.kind === "do" && miss.plan.missing.length >= 1, "no day or no departure → it asks first");

// reading result cards
const x = F.flightFacts({ text: "7:40 AM – 9:50 AM EgyptAir 2 hr 10 min CAI–JED Nonstop EGP 9,840 round trip" }, 2027);
ok(x.airline === "EgyptAir" && x.dep === "07:40" && x.arr === "09:50" && x.dur === 130 && x.stops === 0, "a Google Flights card: " + JSON.stringify(x));
const y = F.flightFacts({ text: "Thu, Jan 8 · 11:15 pm – 4:05 am · flynas · 1 stop · 4h 50m · EGP 8,900" }, 2027);
ok(y.airline === "flynas" && y.depHour === 23 && y.stops === 1 && y.dur === 290 && y.date === "2027-01-08", "a Kayak card with its day: " + JSON.stringify(y));

// organised
const offers = [
  { price: 9840, site: "Google Flights", text: "7:40 AM – 9:50 AM EgyptAir 2 hr 10 min Nonstop", href: "g" },
  { price: 9790, site: "Kayak", text: "Thu, Jan 8 7:40 am – 9:50 am EgyptAir nonstop 2h 10m", href: "k" },
  { price: 8900, site: "Kayak", text: "Thu, Jan 8 11:15 pm – 4:05 am flynas 1 stop 4h 50m" },
  { price: 10120, site: "Skyscanner", text: "Fri, Jan 9 10:15 – 12:30 Saudia Direct 2h 15m" },
  { price: 9950, site: "Expedia", text: "Wed, Jan 7 18:45 – 21:00 Nile Air nonstop 2h 15m" },
];
const all = F.organise(offers, {}, { depart: "2027-01-08" });
ok(all.rows.length === 4 && all.rows.find((r) => r.x.airline === "EgyptAir").sites.join() === "Kayak,Google Flights", "the same EgyptAir flight on 2 sites is ONE row, cheapest site first");
ok(all.cheapest.x.airline === "flynas" && all.fastest.x.airline === "EgyptAir" && all.direct.x.airline === "EgyptAir", "Cheapest (flynas) · Fastest (EgyptAir) · Direct (EgyptAir)");
ok(all.days.map((d) => d.date + ":" + d.price).join() === "2027-01-07:9950,2027-01-08:8900,2027-01-09:10120", "the cheapest price of each day: " + JSON.stringify(all.days));
const ruled = F.organise(offers, { maxStops: 0, timeOfDay: "morning" }, { depart: "2027-01-08" });
ok(ruled.cheapest.x.airline === "EgyptAir" && ruled.hidden === 2 && ruled.rows.length === 2, "with the rules (direct, morning): EgyptAir first, flynas and Nile Air hidden");
