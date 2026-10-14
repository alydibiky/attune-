// v6.27 Travel (travel.js): fair-price checks from every country pack's own price lines, the passport against the trip,
// trip links and the trip's Radar reminders. Nothing is guessed: no matching price line → "unknown".
import fs from "node:fs";
import * as T from "../../web-src/travel.js";
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
// every cost line in every real pack: each one with a number is read, and its own range is read back exactly
const src = fs.readFileSync(new URL("../../web-src/attune.jsx", import.meta.url), "utf8");
const lines = [...src.matchAll(/costs: \[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]));
const withNum = lines.filter((l) => /:\s*[^0-9]*\d/.test(l.slice(l.indexOf(":"))));
const read = withNum.map((l) => T.costRanges([l], "PACK")[0]).filter(Boolean);
ok(lines.length > 120 && read.length === withNum.length, `every price line with a number is read: ${read.length}/${withNum.length} (of ${lines.length})`);
ok(read.every((r) => r.lo > 0 && r.hi >= r.lo && r.cur), "each has a range and a currency: " + JSON.stringify(read.filter((r) => !(r.lo > 0 && r.hi >= r.lo && r.cur)).map((r) => r.line)));
const R = (l) => T.costRanges([l])[0];
ok(R("Warung meal: 20,000–40,000 IDR").lo === 20000 && R("Warung meal: 20,000–40,000 IDR").hi === 40000, "20,000–40,000 IDR");
ok(R("Espresso at the bar: €1–1.50").hi === 1.5 && R("Espresso at the bar: €1–1.50").cur === "EUR", "€1–1.50");
ok(R("Hawker meal: S$4–7").cur === "SGD" && R("Street food: R30–60").cur === "ZAR" && R("Subway ride: ₩1,400–2,000").hi === 2000, "S$, R, ₩ with thousands");
ok(R("Coffee: approx. CHF 4–6").cur === "CHF" && R("Coffee: approx. CHF 4–6").hi === 6 && R("Metro ticket: €2.15, carnet cheaper").lo === 2.15, "CHF before the number; €2.15 followed by a comma");
ok(R("Taxi 5km in Bangkok: 60–100 THB on the meter").lo === 60, "the 5km in the label is not the price");
ok(T.costRanges(["Tokyo metro ride: ¥180–320"], "JPY")[0].cur === "JPY" && T.costRanges(["Street breakfast: ¥5–15"], "CNY")[0].cur === "CNY", "¥ is yen in Japan and yuan in China (the pack decides)");
// fair price
const TR = ["Street simit/tea: 15–40 TRY", "Local restaurant meal: 200–400 TRY", "Taxi 5km in Istanbul: 150–250 TRY", "Metro/tram ride: ~27 TRY with İstanbulkart"];
const f = (t, o) => T.fairPrice(TR, t, { packCur: "TRY", ...o });
ok(f("taxi 200").status === "fair" && f("taxi 200").line.startsWith("Taxi 5km"), "taxi 200 TRY → fair, from the taxi line");
ok(f("taxi 900").status === "high" && f("taxi 900").times === 3.6, "taxi 900 → high, 3.6× the usual top");
ok(f("uber 5km 340").status === "bit-high" && f("uber 5km 340").amount === 340, "'uber 5km 340': the price is 340 (not 5), uber = a taxi line, a bit high");
ok(f("dinner 100").status === "low" && f("dinner 100").label === "Local restaurant meal", "dinner → the restaurant meal line; 100 is unusually low");
ok(f("metro 27").status === "fair", "metro ~27 TRY → fair");
ok(f("haircut 300").status === "unknown", "no price line for a haircut → unknown, never guessed");
ok(f("taxi").status === "no-amount", "no amount → asked");
ok(f("تاكسي ٢٠٠").status === "fair", "Arabic: تاكسي ٢٠٠ (Arabic digits) → fair");
const conv = (a, from, to) => (from === "USD" && to === "TRY" ? a * 40 : null);
ok(f("taxi 10 USD", { convert: conv }).status === "bit-high" && f("taxi 10 USD", { convert: conv }).amount === 400, "taxi 10 USD → converted to 400 TRY first, then judged");
ok(f("taxi $10").status === "need-rate", "a price in another currency without a rate → says it needs the rate");
ok(f("10 for a meal").status === "low" && f("10 for a meal").said === "TRY", "'10 for a meal': 'for' is not a currency");
// passport
const radar = [{ kind: "expiry", doc: "passport", date: "2027-02-10", status: "active" }];
ok(T.passportCheck(radar, { depart: "2026-11-01", ret: "2026-11-10" }).status === "short", "passport ends Feb 2027, back Nov 2026 → under 6 months after: warned");
ok(T.passportCheck(radar, { depart: "2026-07-01", ret: "2026-07-20" }).status === "ok", "back July 2026 → ok");
ok(T.passportCheck(radar, { depart: "2027-02-01", ret: "2027-02-20" }).status === "expires-during", "it expires during the trip");
ok(T.passportCheck(radar, { depart: "2027-03-01", ret: "2027-03-05" }).status === "expired", "expired before leaving");
ok(T.passportCheck([], { depart: "2026-11-01" }).status === "none", "no passport saved → asked to add it");
ok(T.passportCheck([...radar, { kind: "expiry", doc: "passport", date: "2035-01-01", status: "active" }], { depart: "2026-11-01", ret: "2026-11-10" }).status === "ok", "a renewed passport (newer date) is the one used");
ok(T.addMonths("2026-08-31", 6) === "2027-02-28", "+6 months from 31 Aug = 28 Feb");
// trip
ok(!T.tripShape({ depart: "2026-11-10", ret: "2026-11-01" }).ok && T.tripShape({ depart: "2026-11-01", ret: "2026-11-08" }).nights === 7, "a return before the departure is refused; 7 nights counted");
const fl = T.tripFlights({ from: "cai", depart: "2026-11-01", ret: "2026-11-08", adults: 2 }, "IST");
ok(fl.length === 3 && /cai\/ist\/261101\/261108/.test(fl[1].url) && /adults=2/.test(fl[1].url), "flight links CAI→IST with both dates and 2 adults");
ok(T.tripHotels({ depart: "2026-11-01", ret: "2026-11-08", adults: 2 }, "Istanbul")[0].url.includes("checkin=2026-11-01&checkout=2026-11-08"), "hotel links with the trip's dates");
ok(T.tripHotels({ depart: "2026-11-01" }, "Istanbul").length === 0, "no return date → no hotel link with made-up dates");
const dl = T.tripDeadlines({ depart: "2026-11-01", ret: "2026-11-08" }, { country: "Turkey", entryStatus: "evisa" });
ok(dl.length === 2 && dl[1].date === "2026-10-11" && /official portal/.test(dl[1].note), "Radar: the trip + an e-visa reminder 3 weeks before");
ok(T.tripDeadlines({ depart: "2026-11-01" }, { country: "Jordan", entryStatus: "free" }).length === 1, "no visa needed → only the trip");
console.log(bad ? bad + " FAILED" : "v727travel ok");
