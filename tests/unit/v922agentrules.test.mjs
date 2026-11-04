// v9.2 (Ali picked 2A: "make sure that I can interact with the agents and set any rules I want and it understands")
import * as R from "../../web-src/agent-rules.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const p = (t) => R.parseRule(t) || {};
const j = (x) => JSON.stringify(x);

ok(p("only 4 stars").minStars === 4, "“only 4 stars” → 4+ stars");
ok(p("٥ نجوم بس").minStars === 5, "«٥ نجوم بس» → 5 stars");
ok(p("under 40,000").below === 40000 && p("max 40k").below === 40000 && p("اقل من ٤٠ الف").below === 40000, "price: under 40,000 / max 40k / «اقل من ٤٠ الف»");
ok(p("rating 8 or more").minRating === 8, "rating 8 or more");
ok(p("walking under 500 m").maxWalk === 500 && p("within 1 km of the Haram").maxWalk === 1000 && p("قريب من الحرم ٣٠٠ متر").maxWalk === 300, "walk: 500 m / 1 km / «٣٠٠ متر»");
ok(j(p("with breakfast").mustHave) === '["breakfast"]' && j(p("بفطار").mustHave) === '["breakfast"]', "with breakfast / «بفطار» → must have breakfast");
ok(j(p("no hostels").avoid) === '["hostel"]', "no hostels → avoid hostels");
ok(j(p("only Booking").onlySites) === '["booking"]' && j(p("not Agoda").avoidSites) === '["agoda"]' && j(p("بلاش اجودا").avoidSites) === '["agoda"]', "only Booking / not Agoda / «بلاش اجودا»");
ok(p("check every 6 hours").hours === 6 && p("دور كل ٣ ساعات").hours === 3 && p("check every day").hours === 24, "how often: every 6 hours / «كل ٣ ساعات» / every day");
ok(p("direct only").maxStops === 0 && p("مباشر بس").maxStops === 0 && p("max 1 stop").maxStops === 1, "flights: direct only / «مباشر» / max 1 stop");
ok(p("1 bag").bags === 1 && p("with a bag").bags === 1 && p("hand luggage only").bags === 0, "bags: 1 bag / with a bag / hand luggage only");
ok(p("morning flights").timeOfDay === "morning" && p("not before 8am").notBefore === 8 && p("business class").cabin === "business", "morning / not before 8 / business");
ok(j(p("EgyptAir only").onlySites) === '["egyptair"]' && j(p("not flynas").avoidSites) === '["flynas"]', "airlines: EgyptAir only / not flynas");
ok(R.parseRule("hello how are you") === null && R.parseRule("") === null, "a sentence with no rule → null (the model tries it)");

// merging and removing
let rules = R.mergeRules({}, p("only 4 stars")); rules = R.mergeRules(rules, p("under 40,000")); rules = R.mergeRules(rules, p("not Agoda")); rules = R.mergeRules(rules, p("not Expedia"));
ok(rules.minStars === 4 && rules.below === 40000 && j(rules.avoidSites) === '["agoda","expedia"]', "rules add up: " + j(rules));
ok(R.ruleChips(rules).length === 4, "…shown as 4 chips");
rules = R.dropRule(rules, "avoidSites", "agoda");
ok(j(rules.avoidSites) === '["expedia"]', "…a chip removes only itself");
ok(j(R.cleanRules({ minStars: 9, below: "x", hours: 2, avoid: ["", "a", "used"], evil: "<script>" })) === '{"hours":2,"avoid":["used"]}', "the model's JSON is cleaned (nothing out of range, no unknown keys)");

// applying
const offers = [{ name: "Swissôtel Makkah", price: 41000, text: "5 stars · 8.6 · 350 m from the Haram · Breakfast included", site: "Booking.com" },
  { name: "Elaf Al Mashaer", price: 30000, text: "3 stars · 7.9 · 1.2 km", site: "Booking.com" },
  { name: "Hilton Suites", price: 38000, text: "5-star hotel · 9.0 · 200 m", site: "agoda.com" }];
const names = (l) => l.map((o) => o.name).join(",");
ok(names(R.applyRules(offers, p("only 4 stars"))) === "Swissôtel Makkah,Hilton Suites", "4+ stars keeps the 5-star hotels");
ok(names(R.applyRules(offers, p("walking under 500 m"))) === "Swissôtel Makkah,Hilton Suites", "under 500 m keeps the close ones");
ok(names(R.applyRules(offers, p("not Agoda"))) === "Swissôtel Makkah,Elaf Al Mashaer", "not Agoda drops the Agoda offer");
ok(names(R.applyRules(offers, p("under 40,000"))) === "Elaf Al Mashaer,Hilton Suites", "under 40,000");
const flights = [{ name: "EgyptAir MS643", price: 9840, stops: 0, departHour: 7, site: "EgyptAir" }, { name: "flynas", price: 9100, stops: 1, departHour: 23, site: "flynas" }];
ok(names(R.applyRules(flights, R.mergeRules(p("direct only"), p("morning")))) === "EgyptAir MS643", "flights: direct + morning");

// status and brand
ok(R.agentStatus({ kind: "buy", on: true, pending: { price: 1 }, step: "confirm" }) === "needs" && R.agentStatus({ kind: "watch", on: true, best3: [{}] }) === "found"
  && R.agentStatus({ kind: "watch", on: false }) === "paused" && R.agentStatus({ kind: "buy", step: "ordered" }) === "done" && R.agentStatus({ kind: "track", on: true }) === "working", "status: Needs you · Found · Paused · Done · Working");
ok(R.brandOf("Booking.com")[1] === "B." && R.brandOf("https://www.agoda.com/x")[0] === "Agoda" && R.brandOf("EgyptAir")[1] === "MS", "brands: Booking, Agoda, EgyptAir marks");
ok(R.isSiteName("Booking.com") && R.isSiteName("booking.com") && !R.isSiteName("Swissôtel Makkah"), "the word “Booking.com” as a hotel name is recognised");

// v9.2 round 3 (Ali: "when it opens Booking it doesn't open the specific listing")
const A0 = { site: "Booking.com", url: "https://www.booking.com/searchresults.html?ss=Makkah&checkin=2027-01-08&checkout=2027-01-12&group_adults=2" };
ok(R.offerUrl(A0, { href: "https://www.booking.com/hotel/sa/hilton-suites.html?checkin=2027-01-08&checkout=2027-01-12" }) === "https://www.booking.com/hotel/sa/hilton-suites.html?checkin=2027-01-08&checkout=2027-01-12", "an offer with its own link opens that link");
ok(/hotel\/sa\/hilton-suites\.html\?checkin=2027-01-04&checkout=2027-01-08&group_adults=2$/.test(R.offerUrl(A0, { href: "https://www.booking.com/hotel/sa/hilton-suites.html", checkin: "2027-01-04", checkout: "2027-01-08" })), "…a hotel link without dates gets the offer's days and the guests (else Booking shows no price)");
ok(/ss=Swiss%C3%B4tel\+Makkah/.test(R.offerUrl(A0, { name: "Swissôtel Makkah", url: A0.url })), "no link → that hotel searched by its own name on the same site, same dates: " + R.offerUrl(A0, { name: "Swissôtel Makkah", url: A0.url }));
ok(R.offerUrl(A0, { name: "Booking.com", url: A0.url }) === A0.url, "…but a name that is only the website stays the search");
ok(/k=AirPods\+Pro\+2/.test(R.offerUrl({ site: "Amazon", url: "https://www.amazon.eg/s?k=airpods" }, { name: "AirPods Pro 2" })), "Amazon: k= gets the product's own name");
