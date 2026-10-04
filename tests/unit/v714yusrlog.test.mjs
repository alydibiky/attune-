// v6.13 — Yusr: write it and it logs it (web-src/yusr/logtext.js).
import assert from "node:assert/strict";
import { readLocal, parseLog, amountsIn, clauses, dateIn, logPrompt } from "../../web-src/yusr/logtext.js";
const today = "2026-10-04", cats = ["food", "groceries", "transport", "bills", "rent", "shopping", "health", "fun", "coffee", "gifts", "salary", "other"];

assert.deepEqual(amountsIn("12 ألف").map((a) => a.value), [12000]);
assert.deepEqual(amountsIn("1.5k and 1,500").map((a) => a.value), [1500, 1500]);
assert.deepEqual(amountsIn("٨٠ جنيه").map((a) => a.value), [80]);
assert.equal(clauses("lunch 150, taxi 60 and got my salary 30000").length, 3);
assert.equal(clauses("rent 9,000").length, 1, "a thousands comma is not a separator");
assert.equal(dateIn("امبارح", today), "2026-10-03");
assert.equal(dateIn("2 days ago", today), "2026-10-02");

let r = readLocal("lunch 150, taxi 60 and got my salary 30000", { today, cats });
assert.deepEqual(r.items.map((i) => [i.type, i.amount, i.cat]), [["expense", 150, "food"], ["expense", 60, "transport"], ["income", 30000, "salary"]]);

r = readLocal("فطار ٨٠ وبنزين ٥٠٠ امبارح وقبضت ١٢ ألف", { today, cats });
assert.deepEqual(r.items.map((i) => [i.type, i.amount, i.cat, i.date]),
  [["expense", 80, "food", today], ["expense", 500, "transport", "2026-10-03"], ["income", 12000, "salary", today]]);

r = readLocal("yesterday: coffee 45, groceries 820 from Bank", { today, cats, accounts: ["Cash", "Bank"] });
assert.deepEqual(r.items.map((i) => [i.amount, i.cat, i.date, i.account]), [[45, "coffee", "2026-10-03", ""], [820, "groceries", "2026-10-03", "Bank"]]);

// the model is checked: an amount not in the text is dropped and named; an item it forgot is added back
const raw = JSON.stringify({ items: [
  { type: "expense", amount: 150, cat: "food", date: today, note: "lunch" },
  { type: "expense", amount: 65, cat: "transport", date: today, note: "taxi" },          // he wrote 60
  { type: "income", amount: 30000, cat: "salary", date: today, note: "salary" }] });
const p = parseLog("Here you go: " + raw, "lunch 150, taxi 60 and got my salary 30000", { today, cats });
assert.equal(p.ok, true);
assert.deepEqual(p.items.map((i) => i.amount).sort((a, b) => a - b), [60, 150, 30000]);
assert.match(p.warnings[0], /65/);
// no model / nonsense → the code reading
const q = parseLog("sorry", "Uber 120", { today, cats });
assert.equal(q.ok, true); assert.equal(q.items[0].cat, "transport"); assert.equal(q.via, "code");
assert.equal(parseLog("", "hello there", { today, cats }).ok, false);
// a date in the future from the model is today
assert.equal(parseLog(JSON.stringify({ items: [{ type: "expense", amount: 5, cat: "coffee", date: "2027-01-01", note: "tea" }] }), "tea 5", { today, cats }).items[0].date, today);
assert.match(logPrompt("tea 5", { today, cats }), /ONLY this JSON/);
console.log("v714yusrlog ok");
