// v6.32 web comparisons as side-by-side tables: each figure under the side it belongs to, cited; "Better" by the number.
import { headToHead, sideWords, factSheet } from "../../web-src/factsheet.js";
import { compareParts, onTopic } from "../../web-src/research.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const q = "Geely Galaxy M9 vs Lynk & Co 900", parts = compareParts(q);
ok(parts && parts[1] === "Lynk & Co 900", "the two sides");
ok(sideWords("Lynk & Co 900", "Geely Galaxy M9").length === 1 && sideWords("iPhone 15", "iPhone 16").length === 1, "the words that name a side (not «Co», and the number when that's all that differs)");
const sources = [
  { title: "Geely Galaxy M9 review", url: "https://carnewschina.com/galaxy-m9", text: "The Galaxy M9 is a large PHEV SUV.\nPower: 422 hp\nTorque: 535 Nm\nThe price starts at 193,800 yuan.\n0-100 km/h in 4.8 s." },
  { title: "Lynk & Co 900 launched", url: "https://carnewschina.com/lynk-900", text: "Lynk & Co 900 gets a 1.5T PHEV.\nPower: 653 hp\nTorque: 828 Nm\nPrice starts at 265,900 yuan.\nAccelerates 0-100 km/h in 4.3 s." },
  { title: "Galaxy M9 vs Lynk 900: which to buy", url: "https://x.com/compare", text: "Spec | Geely Galaxy M9 | Lynk & Co 900\nPower | 422 hp | 653 hp\nBattery | 41.5 kWh | 39.6 kWh\nRange | 1,400 km | 1,350 km\nThe Lynk 900 is bigger. Its wheelbase is 3,160 mm. The Galaxy M9 has a wheelbase of 3,005 mm." },
];
const h = headToHead(sources, parts);
const row = (id) => h.rows.find((r) => r.id === id) || {};
ok(/422 hp ✓/.test(row("power").a) && /653 hp ✓/.test(row("power").b), "power under each car, confirmed by two sites (" + row("power").a + " | " + row("power").b + ")");
ok(row("power").better === "Lynk & Co 900" && row("accel").better === "Geely Galaxy M9" === false && row("accel").better === "Lynk & Co 900", "Better: more power wins; a quicker 0–100 wins");
ok(row("price").better === "Geely Galaxy M9", "Better: the lower price");
ok(/41.5 kWh/.test(row("battery").a) && /39.6 kWh/.test(row("battery").b) && row("battery").better === "Geely Galaxy M9", "a 'Spec | A | B' table goes to the right columns");
ok(/3,005 mm/.test(row("wheelbase").a) && /3,160 mm/.test(row("wheelbase").b), "a sentence about one car sets the side for its figures (" + row("wheelbase").a + " | " + row("wheelbase").b + ")");
ok(/^### Head to head/.test(h.md) && h.md.includes("| Spec | Geely Galaxy M9 | Lynk & Co 900 | Better |"), "a markdown table A | B | Better");
const fs = factSheet(q, sources, false, parts);
ok(fs.compare && /Head to head/.test(fs.md) && !/Key figures/.test(fs.md), "the answer's sheet is the head-to-head when it is a comparison");
ok(!factSheet("Lynk & Co 900 specs", sources).compare, "not a comparison → the usual sheet");
ok(headToHead([{ title: "x", url: "", text: "nothing here" }], parts).md === "", "too little → no table");
// (bug found on the way: a page about only ONE of the two was dropped as off-topic, so a comparison read only pages naming both)
ok(onTopic({ title: "Lynk & Co 900 launched", url: "https://a.com/x", text: "Lynk & Co 900 gets a PHEV" }, q) && !onTopic({ title: "Weather", url: "https://w.com", text: "sunny in Cairo" }, q), "a page about one side is on topic; an unrelated page is not");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
