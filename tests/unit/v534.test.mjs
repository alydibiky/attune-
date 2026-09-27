// Unit tests for v5.34: the facts sheet (figures copied from the web by code, not by the model).
import { factsIn, tablesIn, factSheet } from "../../web-src/factsheet.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }
const has = (list, id, value) => list.some((f) => f.id === id && f.value === value);

const article = "The Lynk & Co 900 is a six-seater plug-in hybrid. The range-topping version has a combined output of 845 hp and 1,200 Nm of torque. " +
  "It accelerates from 0-100 km/h in 4.6 seconds and has a top speed of 200 km/h. The cabin height reaches 1.293 metres. Prices start at CNY 309,900.";
const f1 = factsIn(article);
eq(has(f1, "power", "845 hp"), true, "power from a sentence (845 hp)");
eq(has(f1, "torque", "1,200 Nm"), true, "torque written before the word (1,200 Nm of torque)");
eq(has(f1, "accel", "4.6 seconds"), true, "0–100 in 4.6 seconds");
eq(has(f1, "top", "200 km/h"), true, "top speed 200 km/h");
eq(has(f1, "price", "CNY 309,900"), true, "price with its currency, exactly as written");
eq(has(f1, "height", "1.293 metres"), true, "1.293 metres copied exactly (no '1.2.93')");

const sheet = "## Specifications\nPower | 598 hp\nTorque | 1,000 Nm\nBattery | 43 kWh\nPure electric range (CLTC) | 280 km\nLength | 5,239 mm\nSeats | 6 seats";
const f2 = factsIn(sheet);
eq(["power", "torque", "battery", "range", "length", "seats"].every((id) => f2.some((f) => f.id === id)), true, "every row of a 'Spec | Value' sheet is read");
eq(has(f2, "range", "280 km"), true, "…range 280 km");

const trims = "Trim | Power | Torque | Price\nLynk & Co 900 Pro | 598 hp | 1,000 Nm | CNY 309,900\nLynk & Co 900 Max | 845 hp | 1,200 Nm | CNY 369,900\nLynk & Co 900 Ultra | 845 hp | 1,200 Nm | CNY 409,900";
const t = tablesIn(trims);
eq(t.length === 1 && t[0].length === 4 && t[0][2][3] === "CNY 369,900", true, "a trims table is kept row by row, as written");

const sources = [
  { title: "Lynk & Co 900 review", url: "https://www.autocar.co.uk/900", text: article },
  { title: "Lynk & Co 900 specs", url: "https://carnewschina.com/900", text: sheet + "\n" + trims },
  { title: "Lynk & Co 900 launched", url: "https://news.example.com/900", text: "The 900 produces 845 hp. It has a top speed of 210 km/h, according to the maker." },
];
const fs = factSheet("Lynk & Co 900 all trims with hp, torque and price", sources);
eq(fs.md.includes("### Key figures (copied exactly from the sources)"), true, "the facts sheet has its heading");
eq(/\| Power \| 845 hp ✓ \[1\]\[3\]/.test(fs.md), true, "a figure on 2 sites is marked ✓ with both sources");
eq(/\| Top speed \| 200 km\/h \[1\] · or 210 km\/h \[3\]/.test(fs.md), true, "when sites disagree, both values are shown with their sources");
eq(fs.rows[0].asked && ["power", "torque", "price"].includes(fs.rows[0].id), true, "what the question asked for comes first");
eq(fs.md.includes("#### Table from carnewschina.com [2]") && fs.md.includes("| Lynk & Co 900 Max | 845 hp | 1,200 Nm | CNY 369,900 |"), true, "the trims table from the page is copied under it");
eq(factSheet("who won the match yesterday", [{ title: "x", url: "https://x.com", text: "The team won 2-1 at home." }]).md, "", "no sheet when there are no specs");
const arSheet = factSheet("مواصفات لينك 900", sources, true);
eq(arSheet.md.includes("### الأرقام من المصادر") && arSheet.md.includes("| القوة |"), true, "Arabic labels for an Arabic question");

if (fails.length) { console.log(`\n${fails.length} FAILED`); process.exit(1); } else console.log("\nALL PASSED");
