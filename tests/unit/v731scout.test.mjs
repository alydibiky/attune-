// v6.28 Scout: goals read by code; ads read and every wish checked against the ad's own words; twins merged; fair price; 👍/👎.
import * as S from "../../web-src/scout.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
// ---- goals
let g = S.parseGoal("Find me a 3-bedroom flat for rent in Maadi under 15,000, not ground floor, near the metro, allows a cat");
ok(g.kind === "rent" && g.place === "maadi" && g.max === 15000, "flat goal: rent in Maadi, max 15,000: " + JSON.stringify([g.kind, g.place, g.max]));
ok(["beds", "notGround", "metro", "pets"].every((k) => g.wish.some((w) => w.k === k)) && g.wish.find((w) => w.k === "beds").min === 3, "…wishes: 3+ beds, not ground, metro, pets");
let ga = S.parseGoal("دورلي على شقة ٣ غرف للإيجار في المعادي أقل من ١٥ ألف مش دور أرضي");
ok(ga.kind === "rent" && ga.max === 15000 && /المعادي/.test(ga.place) && ga.wish.some((w) => w.k === "notGround") && ga.wish.find((w) => w.k === "beds").min === 3, "the same in Egyptian Arabic: " + JSON.stringify([ga.kind, ga.place, ga.max]));
let gc = S.parseGoal("Hyundai Tucson 2019 to 2021 under 900k, one owner, no accident, automatic");
ok(gc.kind === "car" && gc.max === 900000 && gc.wish.find((w) => w.k === "year").min === 2019 && gc.wish.find((w) => w.k === "year").max === 2021 && ["oneOwner", "noAccident", "auto"].every((k) => gc.wish.some((w) => w.k === k)), "car goal: Tucson 2019–2021, under 900k, one owner, no accident, automatic");
ok(S.parseGoal("iPhone 16 Pro 256GB new under 70000").kind === "product" && S.parseGoal("data analyst job in Cairo, remote").kind === "job" && S.parseGoal("crane hire 100 ton in 6th of October").kind === "service" && S.parseGoal("مناقصات هياكل معدنية").kind === "tender", "products, jobs, services and tenders are told apart");
ok(S.parseGoal("flat in Maadi under 12000").kind === "rent", "a flat with a monthly-sized budget is a rent");
ok(S.searchesFor(g).some((q) => /site:aqarmap\.com\.eg/.test(q)) && S.searchesFor(gc).some((q) => /site:hatla2ee\.com/.test(q)), "each goal searches the sites that matter for it");
ok(S.looksLikeGoal("find me a flat in Maadi") && S.looksLikeGoal("دورلي على عربية") && !S.looksLikeGoal("I found my keys"), "a goal is recognised from Home / Chat");
// ---- prices: not phone numbers, years or sizes
const P = (t) => S.pricesIn(t).map((p) => p.v);
ok(JSON.stringify(P("Apartment 165 m² in Maadi, 3rd floor. Price: 14,000 EGP / month. Call 01001234567. Built 2015.")) === "[14000]", "the price only — not the size, the phone number or the year");
ok(JSON.stringify(P("السعر ١٣٥٠٠ جنيه شهريا — للتواصل ٠١١٢٣٤٥٦٧٨٩")) === "[13500]", "Arabic digits, the price only (not the phone)");
ok(P("Price 1.25 million EGP")[0] === 1250000 || P("Price 1,250,000 EGP")[0] === 1250000, "a million read right");
// ---- reading ads and checking the wishes
const FLAT = { url: "https://www.aqarmap.com.eg/en/listing/123456-apartment-maadi", title: "Apartment for rent in Maadi Sarayat", text: "Apartment for rent in Maadi, Sarayat. 3 bedrooms, 2 bathrooms, 180 m². Floor: 4. Fully furnished, elevator, 5 minutes walk to Maadi metro station. Price: 14,000 EGP per month. Pets allowed. Contact 01005556667." };
let ad = S.readAd(FLAT, g);
ok(ad.facts.price === 14000 && ad.facts.beds === 3 && ad.facts.area === 180 && ad.facts.floor === 4 && ad.facts.metro && ad.facts.pets, "the ad read: 14,000 · 3 beds · 180 m² · floor 4 · metro · pets: " + JSON.stringify(ad.facts));
let c = S.check(ad, g);
ok(c.bad.length === 0 && c.unknown.length === 0 && c.ok.length >= 6 && c.score >= 90, "every wish ✓ (" + c.ok.map((x) => x.k).join(",") + ") score " + c.score);
ok(c.ok.find((x) => x.k === "notGround").quote.includes("Floor: 4"), "each ✓ quotes the ad: «" + c.ok.find((x) => x.k === "notGround").quote + "»");
const GROUND = { url: "https://www.dubizzle.com.eg/en/ad/apartment-ground-floor-maadi-ID9988.html", title: "شقة للإيجار المعادي", text: "شقة للايجار بالمعادي دور ارضي ٣ غرف ١٦٠ متر السعر ١٢٠٠٠ جنيه شهريا" };
let c2 = S.check(S.readAd(GROUND, ga), ga);
ok(c2.out && c2.bad.some((b) => b.k === "notGround"), "a ground-floor flat is ruled out (the ad says «دور ارضي»)");
const VAGUE = { url: "https://www.dubizzle.com.eg/en/ad/flat-maadi-ID7777.html", title: "Flat Maadi", text: "Nice flat in Maadi, 3 rooms. Price 13,000 EGP monthly." };
let c3 = S.check(S.readAd(VAGUE, g), g);
ok(!c3.out && c3.unknown.some((u) => u.k === "notGround") && c3.unknown.some((u) => u.k === "pets"), "what the ad doesn't say is 'not stated' — never assumed");
ok(c3.score < c.score, "…and it ranks below the ad that says everything");
const TOO_DEAR = { url: "https://www.propertyfinder.eg/en/plp/rent/apartment-123.html", title: "Maadi apartment", text: "Apartment in Maadi 3 bedrooms floor 2 price 22,000 EGP monthly" };
ok(S.check(S.readAd(TOO_DEAR, g), g).out, "over budget → out");
// cars
const CAR = { url: "https://eg.hatla2ee.com/en/car/details/12345", title: "Hyundai Tucson 2020", text: "Hyundai Tucson model 2020, 65,000 km, automatic, first owner, no accidents. Price: 880,000 EGP." };
const ca = S.readAd(CAR, gc), cc = S.check(ca, gc);
ok(ca.facts.year === 2020 && ca.facts.km === 65000 && ca.facts.price === 880000 && cc.bad.length === 0 && cc.ok.length >= 5, "a car ad: 2020 · 65,000 km · 880,000 · one owner · no accidents · automatic, all ✓");
const CAR2 = { url: "https://www.dubizzle.com.eg/en/ad/tucson-2018-ID1.html", title: "Tucson 2018", text: "Tucson 2018 for sale, 120,000 km, manual, price 750,000 EGP, second owner" };
ok(S.check(S.readAd(CAR2, gc), gc).out, "a 2018 Tucson is out (the goal is 2019–2021)");
// search / category pages are not ads
ok(!S.isAdPage("https://www.aqarmap.com.eg/en/for-rent/apartment/cairo/maadi/", "a 14,000 EGP b 15,000 EGP c 9,000 EGP d 11,000 EGP"), "a search page with many prices is not one ad");
// ---- twins, fairness, taste, one run
const twin = { ...FLAT, url: "https://www.propertyfinder.eg/en/plp/rent/apartment-for-rent-cairo-maadi-999.html" };
const merged = S.mergeTwins([S.readAd(FLAT, g), S.readAd(twin, g)]);
ok(merged.length === 1 && merged[0].also && merged[0].also[0].site === "propertyfinder.eg", "the same flat on two sites is one result with both links");
const seen = [10000, 11000, 12000, 13000, 14000].map((p, i) => ({ id: "x" + i, facts: { price: p * 1.2, area: 120, beds: 3, cur: "EGP" } }));
const fair = S.fairness({ id: "me", facts: { price: 14000, area: 180, beds: 3, cur: "EGP" } }, seen);
ok(fair && fair.basis === "m2" && fair.pct < 0, "fair price per m²: 14,000 for 180 m² is below similar flats (" + fair.pct + "%)");
const taste = S.learn({}, { title: "Sarayat Maadi villa garden", site: "x", facts: {} }, true);
ok(S.tasteNudge({ title: "flat in Sarayat", site: "y", facts: {} }, taste) > 0, "👍 teaches what you like (Sarayat)");
const goal = { id: "s1", g, seen: [], votes: {}, taste: {} };
const run = S.runGoal(goal, [FLAT, twin, GROUND, VAGUE, TOO_DEAR, { url: "https://www.aqarmap.com.eg/en/for-rent/apartment/cairo/maadi/", text: "a 14,000 EGP b 15,000 EGP c 9,000 EGP d 11,000 EGP" }], { now: 1e12 });
ok(run.found.length === 2 && run.found[0].url === FLAT.url && run.found[0].also, "one run: the good flat first (with its twin), the vague one second, the ground floor, the dear one and the search page gone");
ok(S.worthTelling(run).length === 1 && S.worthTelling(run)[0].url === FLAT.url, "only the strong new one is worth a notification");
const run2 = S.runGoal({ ...goal, seen: run.seen }, [FLAT, VAGUE], { now: 1e12 + 86400000 });
ok(run2.fresh.length === 0 && S.worthTelling(run2).length === 0, "the next day, nothing new → no notification");
const cheaper = { ...FLAT, text: FLAT.text.replace("14,000", "13,000") };
const run3 = S.runGoal({ ...goal, seen: run2.seen }, [cheaper], { now: 1e12 + 2 * 86400000 });
ok(run3.found[0].dropped === 1000 && S.worthTelling(run3).length === 1, "a price drop on a good ad IS worth telling (−1,000)");
const msg = S.sellerMessage(run.found[0], g, { ar: true });
ok(/متاح/.test(msg) && /14,000/.test(msg), "a ready message to the seller, in Arabic");
const AR = S.readAd({ url: "https://www.dubizzle.com.eg/en/ad/x-ID1.html", title: "y", text: "شقة للايجار بالمعادي دور ارضي ٣ غرف ١٦٠ متر السعر ١٢٠٠٠ جنيه شهريا مفروشة ومكيفة واسانسير" }, S.parseGoal("flat"));
ok(AR.facts.auto === undefined && AR.facts.furnished === true && AR.facts.elevator === true, "whole words: «بالمعادي» is not «عادي» (manual); «مفروشة», «واسانسير» are read");
ok(ad.quotes.metro === "…walk to Maadi metro station" && ad.quotes.pets === "Pets allowed", "quotes are the ad's own words, cut at whole words: «" + ad.quotes.metro + "»");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
