// v6.46 (Ali, 21 Oct: "scouting is absolutely useless"): his "Hyundai Tuscon 2022 used price" goal compared a dubizzle category
// page ("151 EGP", 100/100), nfl.com, calculator.io and a Malaysian forum. Now: an old goal is read again, only real ads count,
// an ad's price must be a price such a car can have, and what older runs kept is checked again.
import * as S from "../../web-src/scout.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const now = 2e12;
// the goal as an older Scout saved it: only "used" understood
const old = { id: "s1", text: "Hyundai Tuscon 2022 used price", g: { raw: "Hyundai Tuscon 2022 used price", kind: "car", wish: [{ k: "used", say: ["used", "مستعمل"] }], what: "Hyundai Tuscon 2022 used price" }, votes: {}, taste: {},
  seen: [
    { id: "dubizzle.com.eg/en/vehicles/cars-for-sale/hyundai/tucson", url: "https://www.dubizzle.com.eg/en/vehicles/cars-for-sale/hyundai/tucson/", site: "dubizzle.com.eg", title: "Hyundai Tuscon - Vehicles for sale in Egypt | dubizzle Egypt (OLX)", facts: { price: 151, cur: "EGP" }, lastSeen: now - 3600e3, firstSeen: now - 3600e3 },
    { id: "nfl.com/x", url: "https://www.nfl.com/news/tucson", site: "nfl.com", title: "Tucson", facts: { price: 14201, cur: "EGP" }, lastSeen: now - 3600e3, firstSeen: now - 3600e3 },
    { id: "calculator.io/car-loan", url: "https://www.calculator.io/car-loan-calculator/", site: "calculator.io", title: "Car loan calculator Hyundai Tucson", facts: { price: 9000, cur: "EGP" }, lastSeen: now - 3600e3, firstSeen: now - 3600e3 },
  ], listSeen: [{ site: "forum.lowyat.net", v: 14201, t: now - 3600e3 }, { site: "dubizzle.com.eg", v: 151, t: now - 3600e3 }] };
const g = S.freshGoal(old);
ok(g.gv === S.PARSE_V && g.g.car && g.g.car.model === "tucson" && g.g.wish.some((w) => w.k === "year" && w.min === 2022), "an old goal is read again: Hyundai Tucson, model 2022, used");
ok(S.loadScout({ getItem: () => JSON.stringify({ goals: [old] }) }).goals[0].gv === S.PARSE_V, "…every saved goal, when Scout opens");
const hits = [
  { url: "https://www.dubizzle.com.eg/en/vehicles/cars-for-sale/hyundai/tucson/", title: "Hyundai Tucson - Vehicles for sale in Egypt | dubizzle", text: "207 results. Hyundai Tucson 2022 EGP 1,850 Monthly rent. Hyundai Tucson 2022 automatic EGP 1,450,000. Tucson 2022 EGP 1,380,000. Tucson 2021 EGP 1,200,000" },
  { url: "https://www.nfl.com/news/arizona-tucson", title: "Cardinals training camp in Tucson", text: "Tickets from $151. Tucson stadium 2022 price 14,201" },
  { url: "https://forum.lowyat.net/topic/123", title: "Hyundai Tucson 2022 price?", text: "Tucson 2022 price RM 151,000 in Malaysia" },
  { url: "https://www.calculator.io/car-loan-calculator/", title: "Car loan calculator", text: "Hyundai Tucson 2022 price 1,400,000 monthly 25,000" },
  { url: "https://eg.hatla2ee.com/en/car/used/hyundai/tucson/5123456", title: "Hyundai Tucson 2022 used", text: "Hyundai Tucson 2022, automatic, 38,000 km, one owner, price 1,420,000 EGP. Call 01001234567" },
  { url: "https://www.carsplus-eg.com/ad/tucson-2022", title: "Tucson 2022 for sale", text: "Hyundai Tucson 2022 Highline 1,395,000 EGP, 41,000 km" },
];
ok(!S.isAdPage(hits[1].url, hits[1].text, hits[1].title) && !S.isAdPage(hits[2].url, hits[2].text, hits[2].title) && !S.isAdPage(hits[3].url, hits[3].text, hits[3].title), "nfl.com, a forum, a calculator are never ads");
ok(S.isAdPage(hits[5].url, hits[5].text, hits[5].title), "an unknown dealer site with a price in EGP is an ad");
const run = S.runGoal(g, hits, { now });
ok(run.found.length === 2 && run.found.every((a) => /hatla2ee|carsplus/.test(a.site)), "found: the two real Tucson 2022 ads only: " + run.found.map((a) => a.site));
ok(run.found.every((a) => a.facts.price >= 1e6), "with real prices (1.42 M, 1.395 M)");
ok(!run.seen.some((s) => /nfl|calculator|cars-for-sale/.test(s.url)), "what older runs kept (the list page, nfl.com, the calculator) is gone");
ok(run.compare.low >= 1e6 && !Object.keys(run.compare.sites).some((s) => /nfl|calculator|lowyat/.test(s)), "compared: real prices only (" + run.compare.low + " – " + run.compare.high + "), real sites only");
ok(!run.listSeen.some((x) => x.v < 100000), "the 1,850 a month rental and the 151 are not car prices");
const ad = S.readAd({ url: "https://www.dubizzle.com.eg/en/ad/tucson-ID9.html", title: "Hyundai Tucson 2022", text: "Hyundai Tucson 2022 for rent EGP 1,850 Monthly" }, g.g);
ok(ad.facts.price == null, "a car ad whose only number is a monthly rental has no sale price");
