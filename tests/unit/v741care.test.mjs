// v6.41 F3: a lab test over the years, and the cheapest price of a medicine from the pages found.
import * as H from "../../web-src/care.js";
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
const L = [{ test: "HbA1c", value: 6.1, unit: "%", low: 4, high: 5.6, date: "2023-03-01" }, { test: "HbA1c", value: 6.8, unit: "%", low: 4, high: 5.6, date: "2024-09-10" }, { test: "HbA1c", value: 5.5, unit: "%", low: 4, high: 5.6, date: "2026-10-01" }];
const h = H.labHistory(L);
ok(h.n === 3 && h.change === -0.6 && h.pct === -10 && h.years === 3.6, "3 results over 3.6 years, −0.6 (−10%): " + JSON.stringify({ c: h.change, p: h.pct, y: h.years }));
ok(h.above === 2 && h.inRange === 1 && h.below === 0, "2 above the range, 1 in it");
ok(H.labHistory(L.slice(0, 1)) === null, "one result is not a history");
const hits = [
  { title: "سعر جلوكوفاج 500 مجم 50 قرص", url: "https://www.vezeeta.com/x", text: "جلوكوفاج 500 مجم سعره 52 جنيه" },
  { title: "Glucophage 500mg price in Egypt", url: "https://chefaa.com/y", text: "Glucophage 500 mg 50 tablets EGP 48.50" },
  { title: "Glucophage", url: "https://www.chefaa.com/z", text: "Glucophage 1000 mg – 95 جنيه" },
  { title: "Metformin side effects", url: "https://a.com", text: "Glucophage may cause nausea in 500 mg dose" },
  { title: "Other drug", url: "https://b.com", text: "Panadol 30 جنيه" },
];
const p = H.medPrices(hits, { name: "Glucophage" });
ok(p.length === 1 && p[0].site === "chefaa.com" && p[0].price === 48.5, "Latin name: one price per site, the cheapest, 500 mg is not a price: " + JSON.stringify(p));
const pa = H.medPrices(hits, { name: "جلوكوفاج" });
ok(pa.length === 1 && pa[0].price === 52 && pa[0].site === "vezeeta.com", "Arabic name: 52 جنيه");
ok(H.medPrices([{ title: "Glucophage table 20", url: "https://c.com", text: "Glucophage table 20 tablets" }], { name: "Glucophage" }).length === 0, "'table 20' is not 'LE 20'");
ok(H.medPrices(hits, { name: "" }).length === 0, "no name → nothing");
console.log(bad ? bad + " FAILED" : "v741care ok");
