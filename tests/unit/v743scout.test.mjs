// v6.43 (Ali: "Nissan Tuscon 2022 used" → only Dubizzle; "open more than one website, even unknown ones, compare, fast, accurate"):
// the model gives the maker, Arabic ads count, many sites + open searches, list pages and price guides feed the comparison.
import * as S from "../../web-src/scout.js";
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
const g = S.parseGoal("Nissan Tuscon 2022 used");
ok(g.kind === "car" && g.car && g.car.make === "hyundai" && g.car.model === "tucson", "the Tucson is a Hyundai (the misspelt name corrected)");
ok(/made by Hyundai, not Nissan/.test(g.car.note[0]) && g.what === "Hyundai Tucson 2022 used", "…and Scout says so: " + g.car.note[0]);
ok(g.model.must.join() === "tucson", "an ad must name the Tucson (not «Nissan»)");
const qs = S.searchesFor(g);
const sites = new Set(qs.map((q) => (/site:(\S+)/.exec(q) || [])[1]).filter(Boolean));
ok(sites.size >= 4 && qs.filter((q) => !/site:/.test(q)).length >= 3, "searches: " + sites.size + " sites + " + qs.filter((q) => !/site:/.test(q)).length + " open searches (they find the sites nobody listed)");
ok(qs.some((q) => /توسان/.test(q)) && qs.some((q) => /price/.test(q)), "in Arabic too, and the price guides");
const hits = [
  { url: "https://eg.hatla2ee.com/ar/car/details/123456", title: "هيونداي توسان 2022 للبيع", text: "هيونداي توسان 2022 فابريكه بالكامل 45 ألف كم السعر 1,450,000 جنيه" },
  { url: "https://www.dubizzle.com.eg/ad/hyundai-tucson-2022-ID111.html", title: "Hyundai Tucson 2022 GDI", text: "Hyundai Tucson 2022, 60,000 km, price 1,390,000 EGP, one owner" },
  { url: "https://www.contactcars.com/en/used-cars/hyundai-tucson/98765", title: "Hyundai Tucson 2022", text: "Used Hyundai Tucson model 2022 for sale. Price: EGP 1,520,000. 30,000 km" },
  { url: "https://smallcarshop.example.eg/tucson-2022-white", title: "توسان 2022 أبيض", text: "توسان موديل 2022 بحالة الزيرو 38 ألف كم بسعر 1,410,000 جنيه للبيع" },
  { url: "https://www.dubizzle.com.eg/ad/nissan-sunny-2022-ID9.html", title: "Nissan Sunny 2022", text: "Nissan Sunny 2022 price 650,000 EGP" },
  { url: "https://eg.hatla2ee.com/en/car/price/hyundai/tucson", title: "Hyundai Tucson used prices", text: "Hyundai Tucson 2021 used price 1,250,000 EGP. Hyundai Tucson 2022 used price from 1,380,000 EGP to 1,500,000 EGP. Tucson 2023 price 1,700,000 EGP." },
];
const run = S.runGoal({ g, seen: [] }, hits, { now: Date.now() });
const fs = new Set(run.found.map((a) => a.site));
ok(fs.size >= 4 && run.found.every((a) => !/sunny/i.test(a.title)), "found on " + fs.size + " sites (Arabic ads and an unknown shop included), the Sunny left out: " + [...fs].join(", "));
ok(run.listSeen.length >= 2 && run.listSeen.every((x) => x.v >= 1380000 && x.v <= 1500000), "the price guide's 2022 prices are kept (not the 2021 / 2023 ones): " + run.listSeen.map((x) => x.v).join(", "));
const c = run.compare;
ok(c.low >= 1380000 && c.high <= 1520000 && c.med >= 1400000 && c.med <= 1460000, `the usual price: ${c.low}–${c.high}, typical ${c.med}`);
ok(c.best && c.best.price <= c.med, "the best value is at or under the typical price: " + (c.best && c.best.title + " " + c.best.price));
ok(S.marketKey(g) === "car:hyundai tucson", "the market book key stays the same as before");
console.log(bad ? bad + " FAILED" : "ALL PASSED");
