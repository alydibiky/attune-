// Unit tests for v5.30: fast (Gemini-like) research helpers.
import { expandQueries, topicOf, confirmedFigures, wantsDeep, FAST_REPORT_ADD } from "../../web-src/research.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }
const y = new Date().getFullYear();

eq(expandQueries("Lynk & Co 900 all trims with hp, torque and price", 4), ["Lynk & Co 900 all trims with hp, torque and price", "Lynk & Co 900 specifications", "Lynk & Co 900 price " + y, "Lynk & Co 900 trims versions"], "a detailed question becomes several searches, one per angle — no model needed");
eq(expandQueries("مواصفات وأسعار لينك اند كو 900 كل الفئات", 4).slice(1), ["لينك اند كو 900 مواصفات", "لينك اند كو 900 سعر " + y, "لينك اند كو 900 الفئات"], "…in Arabic too, with Arabic search words");
eq(expandQueries("BYD Seal vs Tesla Model 3", 3).slice(1), ["BYD Seal specifications price", "Tesla Model 3 specifications price"], "a comparison searches each side");
eq(expandQueries("Liebherr LTM 1100-5.2 full specifications", 2)[1], "Liebherr LTM 1100-5.2 specifications", "version numbers like 1100-5.2 are kept");
eq(expandQueries("who won yesterday", 1), ["who won yesterday"], "a simple question stays one search");
eq(topicOf("What is the price of the Lynk & Co 900?"), "price Lynk & Co 900", "filler words are removed from the subject");

const f = confirmedFigures([{ text: "Ultra: 845 hp, 1,200 Nm, CNY 369,900" }, { text: "Power 845 hp; price CNY 369900" }, { text: "Range 1,400 km; 845 hp" }]);
eq(f.list.map((x) => x.fig + " " + x.sources.join(",")), ["845 hp 1,2,3", "CNY 369,900 1,2"], "figures given by 2+ sites are found (commas and spacing ignored), shown as the page wrote them");
eq(/FIGURES CONFIRMED BY 2\+ SOURCES/.test(f.block) && /845 hp \[1\]\[2\]\[3\]/.test(f.block), true, "…and handed to the model as a confirmed list");
eq(confirmedFigures([{ text: "845 hp" }, { text: "598 hp" }]).list.length, 0, "a figure on one site only is not 'confirmed'");
eq([wantsDeep("deep research: Lynk 900 trims"), wantsDeep("ابحث بعمق عن لينك 900"), wantsDeep("Lynk 900 trims")], [true, true, false], "deep page-by-page research only when asked");
eq(/every item the passages name/.test(FAST_REPORT_ADD) && /Cite the source number/.test(FAST_REPORT_ADD), true, "the fast report asks for every item, cited");

console.log(fails.length ? fails.length + " FAILED" : "ALL PASSED");
if (fails.length) process.exit(1);
