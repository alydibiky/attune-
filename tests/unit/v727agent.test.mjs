// v6.27 "Do it for me" (agent.js): requests read by code into exact plans — flights, hotels, food, rides, shopping —
// in several languages; anything missing or impossible is ASKED; questions stay in Chat; the links are exact.
import * as A from "../../web-src/agent.js";
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
const now = new Date("2026-10-14T10:00:00").getTime();   // a Wednesday
const P = (t, o = {}) => A.planTask(t, { now, country: "EG", homeAirport: "CAI", ...o });
const f = (t, exp, o) => { const p = P(t, o); const r = (p && p.fields) || {}; const miss = Object.entries(exp).filter(([k, v]) => JSON.stringify(r[k]) !== JSON.stringify(v));
  ok(p && !miss.length, `«${t}» → ${p ? p.task + " " + JSON.stringify(r) + (p.missing.length ? " missing: " + p.missing.join(" | ") : "") : "null"}`); return p; };

// airports
ok(A.airportOf("Dubai") === "DXB" && A.airportOf("القاهرة") === "CAI" && A.airportOf("jfk") === "JFK" && A.airportOf("São Paulo") === "GRU" && A.airportOf("a nice hotel") === "", "airports: Dubai, القاهرة, JFK, São Paulo; «a nice hotel» is not Nice");
// flights
let p = f("Book me the cheapest flight from Cairo to Dubai on Thursday morning", { from: "CAI", to: "DXB", depart: "2026-10-15", ret: "", adults: 1, cabin: "economy", cheapest: true, direct: false, time: "morning" });
ok(p.missing.length === 0 && p.links.length === 3 && p.links[1].url.includes("/cai/dxb/261015/") && p.links[0].url.includes("google.com/travel/flights"), "…with exact links (Skyscanner /cai/dxb/261015/)");
f("احجزلي طيارة من القاهرة لدبي يوم الخميس", { from: "CAI", to: "DXB", depart: "2026-10-15" });
f("flight to London on 20 November, 2 adults, business class", { from: "CAI", to: "LHR", depart: "2026-11-20", adults: 2, cabin: "business" });
f("Round trip from Paris to New York 3 Dec to 10 Dec nonstop", { from: "CDG", to: "JFK", depart: "2026-12-03", ret: "2026-12-10", direct: true });
f("Reserva un vuelo de Madrid a Barcelona mañana", { from: "MAD", to: "BCN", depart: "2026-10-15" });
f("Buche einen Flug von Berlin nach München am 05.11.2026", { from: "BER", to: "MUC", depart: "2026-11-05" });
p = P("Book a flight from Cairo to Atlantis tomorrow");
ok(p && p.missing.some((m) => /Atlantis/.test(JSON.stringify(m))) && !p.links.length, "an unknown city is asked, not guessed: " + JSON.stringify(p && p.missing));
p = P("Book a flight from Cairo to Dubai on 2 October 2026");
ok(p && p.missing.some((m) => /passed/.test(JSON.stringify(m))) === false ? /2027-10-02/.test(p.fields.depart) || p.missing.length > 0 : true, "a day already gone this year is next year's or asked: " + (p && p.fields.depart));
p = P("Book a round trip flight from Cairo to Rome on 20 November");
ok(p && p.missing.includes("Which day do you come back?"), "a round trip without its return day asks for it");
p = P("Book a flight to Dubai on Thursday", { homeAirport: "" });
ok(p && p.missing.includes("Flying from where?"), "no home airport known → asks where from");
// hotels
p = f("Book a hotel in Paris from 3 November to 6 November for 2 people", { city: "Paris", checkin: "2026-11-03", checkout: "2026-11-06", adults: 2 });
ok(p.links[0].url === "https://www.booking.com/searchresults.html?ss=Paris&checkin=2026-11-03&checkout=2026-11-06&group_adults=2&no_rooms=1", "Booking.com link exact");
f("احجز فندق في دبي من 20 نوفمبر 3 ليالي", { city: "دبي", checkin: "2026-11-20", checkout: "2026-11-23" });
p = P("book a hotel in Rome on 9 November");
ok(p && p.missing.some((m) => /nights/.test(m)), "a hotel without the length of stay asks for it");
// food and rides
p = f("Order koshary from Abou Tarek on Talabat", { what: "koshary", app: "talabat" });
ok(p.links[0].label === "Talabat" && p.links[0].app === "com.talabat" && p.links[0].copy.includes("koshary"), "Talabat opens, the search is ready to paste");
p = P("order a pepperoni pizza", { country: "US" });
ok(p && p.links[0].label === "DoorDash" && p.links[0].url.includes("pepperoni"), "in the US: DoorDash with the search filled in");
p = f("get me an Uber to Cairo Airport", { to: "Cairo Airport" });
ok(p.links[0].url.startsWith("https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=Cairo%20Airport"), "Uber's own link with the destination");
f("اطلبلي كريم لمدينة نصر", { to: "مدينه نصر" });
p = P("buy AirPods Pro on Amazon", { country: "DE" });
ok(p && p.task === "shop" && p.links[0].url === "https://www.amazon.de/s?k=AirPods%20Pro", "shopping: Amazon of the person's country");
// NOT tasks — must stay in Chat
for (const t of ["What is the cheapest airline to Dubai?", "How do planes fly?", "Explain hotel star ratings", "I had a great flight yesterday", "The food was amazing", "Tell me the history of Uber", "My room is cold", "عايز اعرف ازاي الطيارة بتطير", "Can you recommend food for diabetics?", "I need a healthy dinner recipe", "Suggest a hotel in Paris", "Can you get me ideas for a trip to Rome", "What should I eat for lunch"])
  ok(!A.planTask(t, { now }), "stays in Chat: «" + t + "»");
// ranking offers by the person's rules
const r = A.rankOffers([{ price: 300, stops: 1, hour: 8 }, { price: 340, stops: 0, hour: 9 }, { price: 280, stops: 0, hour: 22 }], { direct: true, time: "morning" });
ok(r[0].price === 340, "direct + morning: the 340 nonstop at 9:00 beats the cheaper 1-stop and the 22:00 one");
console.log(bad ? bad + " FAILED" : "v727agent ok");
