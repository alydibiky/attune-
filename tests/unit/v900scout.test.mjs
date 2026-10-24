// v7.9 (Ali, screenshot: "fix the scout part, what are all these ads" — bartleby.com essays and a dubizzle mobile-phone ad
// for a home in 6th of October): only real ads, and only ads ABOUT what was asked.
import * as S from "../../web-src/scout.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const now = 2e12;
const flat = S.parseGoal("a 2 bedroom flat for rent in 6th of october under 15000");
const hit = (url, title, text) => ({ url, title, text });
const hits = [
  hit("https://www.bartleby.com/essay/Differences-Between-Beatrice-And-Hero-In-Much-Ado", "Differences between Beatrice and Hero in Much Ado about Nothing", "Price 1,619 EGP for the essay. Beatrice and Hero are two women in Much Ado about Nothing…"),
  hit("https://www.dubizzle.com.eg/en/ad/mobile-phones-209254006", "Mobile Phones - توكيا الدمعه 209254006", "Nokia phone for sale 6th of October price 4,500 EGP"),
  hit("https://www.dubizzle.com.eg/en/ad/apartment-2-bedrooms-6th-october-ID300", "Apartment 2 bedrooms for rent in 6th of October", "Apartment for rent 2 bedrooms 120 m2, 6th of October, 12,000 EGP per month"),
  hit("https://www.aqarmap.com.eg/en/listing/400-shqa", "شقة للإيجار في 6 أكتوبر", "شقة غرفتين 11000 جنيه في الشهر اكتوبر"),
];
const r = S.runGoal({ id: "g1", g: flat, seen: [], votes: {}, taste: {} }, hits, { now });
const sites = r.found.map((a) => a.title);
ok(!r.found.some((a) => /bartleby/.test(a.url)), "an essay site is never an ad");
ok(!r.found.some((a) => /Mobile Phones/.test(a.title)), "a phone ad is not a flat");
ok(r.found.length === 2 && r.found.every((a) => /apartment|شقة/i.test(a.title)), "the two flats stay: " + JSON.stringify(sites));
// a car goal: an ad must name the make or the model
const car = S.parseGoal("Hyundai Tucson 2022 used");
ok(S.aboutIt({ title: "Hyundai Tuscon 2022 for sale", item: "" }, car) && S.aboutIt({ title: "هيونداي توسان 2022", item: "" }, car), "a Tucson ad (even spelt Tuscon, or in Arabic) is about it");
ok(!S.aboutIt({ title: "Mobile Phones - Samsung A15", item: "samsung a15" }, car), "a phone ad is not about a Tucson");
// a product: its own words
const tv = S.parseGoal("Samsung 55 inch TV under 20000");
ok(S.aboutIt({ title: "Samsung 55\" Crystal UHD Smart TV", item: "" }, tv) && !S.aboutIt({ title: "Office chair, black", item: "" }, tv), "a product ad must name the product");
ok(S.samePlace("اكتوبر", "6th of october") && S.samePlace("التجمع الخامس", "new cairo") && !S.samePlace("maadi", "zamalek"), "the same place in Arabic and English is the same place");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
