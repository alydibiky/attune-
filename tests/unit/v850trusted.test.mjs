// v8.5 — Ali: "from reputable sites that hold the whole information, or YouTube — quality, not quantity" (trusted.js)
import assert from "node:assert/strict";
import { trustedOf, trustedQueries, specCard, specCards, egyptPrices, videoPages, CARDS_NOTE } from "../../web-src/trusted.js";
import { mergeHits, subjectOf } from "../../web-src/research.js";

assert.equal(trustedOf("https://www.auto-data.net/en/lynk-co-900-2.0t-884hp-48765").role, "specs");
assert.equal(trustedOf("https://eg.hatla2ee.com/en/new-car/lynk-co/900").role, "price");
assert.equal(trustedOf("https://randomblog.com/x"), null);
assert.equal(subjectOf("Lynk & Co 900 specs and prices in Egypt"), "Lynk & Co 900");
const qs = trustedQueries("Lynk & Co 900", "vehicle");
assert.ok(qs[0] === "site:auto-data.net Lynk & Co 900" && qs.some((q) => /hatla2ee/.test(q)) && qs.some((q) => /review$/.test(q)), qs.join(" / "));

// an auto-data-like spec sheet: one version per page, "Spec | Value" rows
const page = (hp, acc, top) => ({ title: `Lynk & Co 900 2.0T EM-P (${hp} Hp) Plug-in Hybrid AWD | Technical specs, data, fuel consumption`, url: "https://www.auto-data.net/en/lynk-co-900-" + hp,
  text: `## General information\nBrand | Lynk & Co\nModel | 900\nPowertrain Architecture | Plug-in hybrid\n## Performance\nAcceleration 0 - 100 km/h | ${acc} sec\nMaximum speed | ${top} km/h\nPower per litre | 120 Hp/l\nWeight-to-power ratio | 3.1 kg/Hp\n## Engine\nSystem power | ${hp} Hp\nSystem torque | 1000 Nm\nGross battery capacity | 52.3 kWh\nAll-electric range (WLTP) | 200 km\n## Dimensions\nLength | 5240 mm\nWidth | 1999 mm\nHeight | 1810 mm\nWheelbase | 3160 mm\nSeats | 6\nDrive wheel | All wheel drive (4x4)` });
const c = specCard(page(884, 4.3, 240));
assert.ok(c && c.values.get("power") === "884 Hp" && c.values.get("accel") === "4.3 sec" && c.values.get("torque") === "1000 Nm", JSON.stringify(c && [...c.values]));
assert.ok(!/Hp\/l|kg\/Hp/.test([...c.values.values()].join(" ")), "power per litre / weight-to-power are not the power");
assert.match(c.name, /^Lynk & Co 900 2\.0T EM-P \(884 Hp\)/);
const sc = specCards([{ title: "news", url: "https://x.com/a", text: "Lynk & Co launched the 900." }, page(884, 4.3, 240), page(734, 4.6, 240)]);
assert.equal(sc.cards.length, 2);
assert.match(sc.md, /\| Spec \| Lynk & Co 900 2\.0T EM-P \(884 Hp\)[^|]*\[2\] \| Lynk & Co 900 2\.0T EM-P \(734 Hp\)[^|]*\[3\] \|/);
assert.match(sc.md, /\| Power \| 884 Hp \| 734 Hp \|/);
assert.match(sc.md, /\| 0–100 km\/h \| 4\.3 sec \| 4\.6 sec \|/);
assert.equal(specCards([{ title: "blog", url: "https://b.com", text: "Power | 500 hp" }]).cards.length, 0, "one figure is not a spec sheet");

// Egyptian prices, copied from the price sites only
const eg = egyptPrices([{ title: "Lynk & Co 900 prices", url: "https://eg.hatla2ee.com/en/new-car/lynk-co/900", text: "Trim | Price\nLynk & Co 900 Halo | EGP 3,250,000\nLynk & Co 900 Ultra | 3,650,000 EGP" },
  { title: "blog", url: "https://blog.com", text: "Something | EGP 1,000,000" }]);
assert.equal(eg.rows.length, 2); assert.match(eg.md, /Halo \| EGP 3,250,000 \| eg\.hatla2ee\.com \[1\]/);

// trusted spec pages are read first, and a spec site may give one page per version
const lists = [[{ title: "Lynk & Co 900 blog", url: "https://blog1.com/lynk-co-900", text: "Lynk & Co 900 x" }, { title: "Lynk & Co 900 b2", url: "https://blog2.com/lynk-co-900", text: "Lynk & Co 900" }],
  [1, 2, 3].map((k) => ({ title: "Lynk & Co 900 v" + k, url: "https://www.auto-data.net/en/lynk-co-900-" + k, text: "Lynk & Co 900" }))];
const m = mergeHits(lists, 6, "Lynk & Co 900");
assert.ok(/auto-data/.test(m[0].url), m.map((h) => h.url).join(" "));
assert.equal(m.filter((h) => /auto-data/.test(h.url)).length, 3);

// YouTube transcripts become pages
const v = videoPages([{ title: "Lynk & Co 900 review - YouTube", url: "https://www.youtube.com/watch?v=abcdefghijk", text: "x".repeat(300) }, { title: "short", url: "u", text: "hi" }]);
assert.equal(v.length, 1); assert.equal(v[0].title, "YouTube review — Lynk & Co 900 review");
assert.match(CARDS_NOTE, /do NOT write spec or price tables/);
console.log("v850trusted ok");
