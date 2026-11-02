// v9.0 (Ali, 2 Nov: "Most went on cmuu3u3sb2q4sd — what is that?"): the month card names the category, never its id.
import { monthReview, reviewLines } from "../../web-src/monthreview.js";
import { catName, looksLikeId } from "../../web-src/money-report.js";
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log("FAIL " + m); } };
const now = Date.parse("2026-11-01T20:00:00");
const tx = (cat, amount, note = "") => ({ type: "expense", cat, amount, note, date: "2026-10-12" });
const L1 = { customCats: [{ id: "cmuu3u3sb2q4sd", en: "Car loan", ar: "قسط العربية" }], txns: [tx("cmuu3u3sb2q4sd", 9000), tx("food", 2000), { type: "income", amount: 20000, date: "2026-10-01" }] };
ok(reviewLines(monthReview({ ledger: L1 }, now), "en").some((l) => l === "Most went on Car loan (82%)"), "a custom category → its own name");
ok(reviewLines(monthReview({ ledger: L1 }, now), "ar").some((l) => l.includes("قسط العربية")), "Arabic name");
const L2 = { customCats: [], txns: [tx("cmuu3u3sb2q4sd", 6000, "Rent · flat"), tx("cmuu3u3sb2q4sd", 6000, "Rent · flat"), tx("food", 1000)] };
const l2 = reviewLines(monthReview({ ledger: L2 }, now), "en").join("\n");
ok(/Most went on Rent · flat/.test(l2) && !/cmuu3/.test(l2), "a category with no name left → what was written on those payments");
const L3 = { customCats: [], txns: [tx("cmuu3u3sb2q4sd", 6000), tx("food", 1000)] };
ok(/Most went on uncategorised/.test(reviewLines(monthReview({ ledger: L3 }, now), "en").join("\n")), "nothing written → uncategorised");
ok(/Most went on food/.test(reviewLines(monthReview({ ledger: { txns: [tx("food", 1000)] } }, now), "en").join("\n")), "a base category is unchanged");
ok(looksLikeId("cmuu3u3sb2q4sd") && !looksLikeId("groceries") && !looksLikeId("maid") && catName(null, "cmuu3u3sb2q4sd") === "Uncategorised", "ids are never shown as names");
console.log(bad ? bad + " FAILED" : "PASS v901monthcat: the month card names the category");
