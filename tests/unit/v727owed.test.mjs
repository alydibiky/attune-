// v6.27 What you're owed (owed.js): flight compensation decided by code from EU261 / UK261 / Canada's APPR, and the letters.
import * as O from "../../web-src/owed.js";
import { airportOf } from "../../web-src/agent.js";
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
// distances (great circle, published values ±2%)
const near = (a, b, km) => Math.abs(O.distanceKm(a, b) - km) / km < 0.02;
ok(near("CDG", "LHR", 348) && near("CAI", "LHR", 3530) && near("FRA", "JFK", 6200) && near("MAD", "BCN", 483) && near("CAI", "FRA", 2930), "distances: CDG–LHR 348, CAI–LHR ~3,530, FRA–JFK ~6,200, MAD–BCN 483, CAI–FRA ~2,930 km");
ok(Object.keys(O.AIRPORT_POS).length >= 150, "every airport the booking agent knows has a position: " + Object.keys(O.AIRPORT_POS).length);
// EU261 bands
const c = (f) => O.flightClaim({ cause: "technical", ...f });
ok(c({ from: "MAD", to: "BCN", kind: "delay", arrivalDelayH: 3.5 }).amount === 250, "MAD→BCN 483 km, 3.5 h late, technical → €250");
ok(c({ from: "FRA", to: "CAI", kind: "delay", arrivalDelayH: 5 }).amount === 400, "FRA→CAI ~2,930 km → €400 (departing the EU, any airline)");
ok(c({ from: "FRA", to: "JFK", kind: "delay", arrivalDelayH: 5 }).amount === 600, "FRA→JFK over 3,500 km, 5 h → €600");
ok(c({ from: "FRA", to: "JFK", kind: "delay", arrivalDelayH: 3.5 }).amount === 300, "…3.5 h late over 3,500 km → may be halved to €300");
ok(c({ from: "LIS", to: "HEL", kind: "delay", arrivalDelayH: 4 }).amount === 400, "inside the EU over 3,350 km stays the middle band €400");
ok(c({ from: "MAD", to: "BCN", kind: "delay", arrivalDelayH: 2.5 }).status === "not-owed", "2.5 h late → not owed (3 h at arrival)");
// into Europe: only on a European airline
ok(c({ from: "CAI", to: "FRA", flight: "MS785", kind: "delay", arrivalDelayH: 4 }).status === "no-rule", "CAI→FRA on EgyptAir (MS): no EU rule into Europe on a non-EU airline");
ok(c({ from: "CAI", to: "FRA", flight: "LH583", kind: "delay", arrivalDelayH: 4 }).amount === 400, "CAI→FRA on Lufthansa (LH): EU261 €400");
ok(c({ from: "CAI", to: "FRA", kind: "delay", arrivalDelayH: 4 }).status === "ask", "no flight number → asks whether the airline is European");
// UK
ok(c({ from: "LHR", to: "CAI", kind: "delay", arrivalDelayH: 6 }).amount === 520 && c({ from: "LHR", to: "CAI", kind: "delay", arrivalDelayH: 6 }).cur === "GBP", "LHR→CAI ~3,530 km → £520 (UK261)");
ok(c({ from: "CDG", to: "LHR", kind: "denied" }).amount === 250 && c({ from: "CDG", to: "LHR", kind: "denied" }).rule === "EU261", "refused boarding CDG→LHR → €250 (EU departure)");
// cancellations
ok(c({ from: "MAD", to: "BCN", kind: "cancel", noticeDays: 20 }).status === "not-owed", "cancelled with 20 days' notice → refund, not compensation");
ok(c({ from: "MAD", to: "BCN", kind: "cancel", noticeDays: 3 }).amount === 250 && /1 h earlier/.test(c({ from: "MAD", to: "BCN", kind: "cancel", noticeDays: 3 }).note), "cancelled 3 days ahead → €250, with the re-routing exception said");
// causes
ok(O.flightClaim({ from: "MAD", to: "BCN", kind: "delay", arrivalDelayH: 5, cause: "weather" }).status === "not-owed", "bad weather → not owed (care still owed)");
const u = O.flightClaim({ from: "MAD", to: "BCN", kind: "delay", arrivalDelayH: 5 });
ok(u.status === "likely" && u.askCause, "cause not known → 'likely', and the cause is asked — never assumed");
// Canada
ok(c({ from: "YYZ", to: "LHR", flight: "AC848", kind: "delay", arrivalDelayH: 7 }).amount === 700 && c({ from: "YYZ", to: "LHR", flight: "AC848", kind: "delay", arrivalDelayH: 7 }).cur === "CAD", "YYZ→LHR on Air Canada 7 h → CAD 700 (APPR; UK rule doesn't cover a non-UK airline into the UK)");
ok(c({ from: "YVR", to: "YYZ", flight: "AC100", kind: "delay", arrivalDelayH: 10 }).amount === 1000, "Canada 10 h → CAD 1,000");
// nothing applies
ok(c({ from: "CAI", to: "DXB", kind: "delay", arrivalDelayH: 6 }).status === "no-rule", "CAI→DXB: no compensation law — says so and suggests asking the airline");
ok(O.flightClaim({ from: "XXX", to: "CAI", kind: "delay" }).status === "ask", "an unknown airport or a missing delay is asked");
// letters
const r = c({ from: "FRA", to: "JFK", flight: "LH400", kind: "delay", arrivalDelayH: 5 });
const L = O.claimLetter(r, { name: "Ali", booking: "ABC123", date: "2026-10-01", passengers: 2 });
ok(/€600 per passenger/.test(L) && /€1,200 for 2 passengers/.test(L) && /261\/2004/.test(L) && /ABC123/.test(L), "the claim letter: amount, total, the law, the booking");
ok(/تعويض/.test(O.claimLetter(r, { lang: "ar" })), "…and in Arabic");
ok(/return window, which ends on 2026-11-01/.test(O.returnLetter({ title: "Headphones", base: "2026-10-02", date: "2026-11-01", amount: 99, currency: "EUR" })), "return request letter");
ok(/still under warranty until 2027-10-02/.test(O.warrantyLetter({ title: "Phone", base: "2025-10-02", date: "2027-10-02" }, { fault: "the screen flickers" })), "warranty claim letter");
// chat
const t = O.flightFromText("my flight LH400 from FRA to JFK was 5 hours late", airportOf);
ok(t && t.kind === "delay" && t.arrivalDelayH === 5 && t.from === "FRA" && t.to === "JFK" && t.flight === "LH400", "Chat: 'my flight LH400 from FRA to JFK was 5 hours late' → read");
const t2 = O.flightFromText("رحلتي من القاهرة إلى لندن اتلغت", airportOf);
ok(t2 && t2.kind === "cancel" && t2.from === "CAI" && t2.to === "LHR", "Arabic: رحلتي من القاهرة إلى لندن اتلغت → a cancellation CAI→LHR: " + JSON.stringify(t2));
ok(O.flightFromText("what time is my flight tomorrow", airportOf) === null, "a question about a flight time is not a claim");
console.log(bad ? bad + " FAILED" : "v727owed ok");
