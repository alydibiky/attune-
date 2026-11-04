// Unit tests for v5.19: web passages that answer the question; ERP tables connected.
import { passages, rankPassages, qWords } from "../../web-src/webrank.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

// a car page: 6,000 characters of menus and story, then the spec table
const filler = Array.from({ length: 40 }, (_, i) => `Our newsroom story number ${i} about the brand's heritage, design philosophy and the people behind it.`).join("\n");
const page = "Home | News | Cars | Contact\nAccept all cookies to continue\n" + filler + "\n## Trims and prices\nTrim | Power | Torque | Price\nLynk & Co 900 Pro | 598 hp | 1,000 Nm | CNY 309,900\nLynk & Co 900 Max | 598 hp | 1,000 Nm | CNY 339,900\nLynk & Co 900 Ultra | 845 hp | 1,200 Nm | CNY 369,900\n## Range\nCLTC range 1,400 km; electric range 280 km (CLTC)";
eq(page.indexOf("Ultra") > 2200, true, "(the table is past the first 2,200 characters — v5.18 never saw it)");
const ps = passages(page);
eq(ps.some((p) => p.table && p.text.includes("900 Ultra") && p.head === "Trims and prices"), true, "a table stays together as a passage, with its heading");
const r = rankPassages("Lynk & Co 900 all trims with hp, torque and price", [{ title: "Lynk & Co 900", url: "https://x/900", text: page }, { title: "Weather", url: "https://w", text: "Sunny in Cairo today with 31 degrees." }], { budget: 1500 });
eq(r[0].text.includes("845 hp") && r[0].text.includes("CNY 309,900"), true, "the spec table is picked for a trims/specs question");
eq(r[0].text.includes("newsroom story number 3"), false, "…and the filler is left out");
eq(r[0].text.length <= 1600, true, "…within the budget");
eq(rankPassages("x", []).length, 0, "no hits → nothing, no crash");
eq(qWords("What is the price of the LTM 1100?"), ["price", "ltm", "1100"], "question words: stop words dropped, names and numbers kept");

// (v9.1: the Business part of this test is archived in archive/business/tests/unit/v519.test.mjs)
console.log(fails.length ? fails.length + " FAILED" : "ALL PASSED");
if (fails.length) process.exit(1);
