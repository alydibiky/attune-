// v9.5 (Ali, 5 Nov phone test): the month plan never shows an id ("cmuu3u3sb2q4sd") — the category with its note; repeated bills grouped
import assert from "node:assert/strict";
const LS = {}; globalThis.localStorage = { getItem: (k) => LS[k] ?? null, setItem: (k, v) => { LS[k] = String(v); }, removeItem: (k) => delete LS[k] };
const P = await import("../../web-src/planner.js");
const now = Date.parse("2026-11-05T10:00:00");
const tx = [];
for (const m of ["08", "09", "10"]) tx.push(
  { type: "income", amount: 40000, date: `2026-${m}-01`, cat: "salary" },
  { type: "expense", amount: 4000, date: `2026-${m}-03`, cat: "cmuu3u3sb2q4sd", note: "Rent for mom" },
  { type: "expense", amount: 3000, date: `2026-${m}-04`, cat: "cmuwco6x7sl16y", note: "Car instalment" },
  { type: "expense", amount: 2700, date: `2026-${m}-05`, cat: "groceries", note: "Seoudi" },
  { type: "expense", amount: 300, date: `2026-${m}-06`, cat: "groceries", note: "Seoudi" },
  { type: "expense", amount: 900, date: `2026-${m}-07`, cat: "c1730000000" },
  { type: "expense", amount: 500, date: `2026-${m}-08`, cat: "x9", note: "" });
const ledger = { txns: tx, recurring: [], customCats: [{ id: "x9", en: "Gym", ar: "الجيم" }] };
const plan = P.planMonth({ ledger, life: null, pots: { v: 1, pots: [] }, now });
const labels = plan.flexible.map((f) => P.flexLabel(f, ledger, false));
for (const l of labels) assert.ok(!/cmu|c1730/.test(l), "no id shown: " + l);
assert.ok(labels.includes("Rent for mom"), labels.join("|"));
assert.ok(labels.includes("Car instalment"));
assert.ok(labels.includes("Groceries · Seoudi"));
assert.ok(labels.includes("Gym"));
assert.ok(labels.includes("Uncategorised"));
const ar = plan.flexible.map((f) => P.flexLabel(f, ledger, true));
assert.ok(ar.includes("الجيم"));
const g = P.groupFixed([{ what: "Maid", amount: 600 }, { what: "Maid", amount: 600 }, { what: "Maid", amount: 600 }, { what: "Rent", amount: 5000 }]);
assert.equal(g.length, 2); assert.equal(g[0].n, 3); assert.equal(g[1].n, 1);
console.log("ALL PASSED v950plan (7 checks)");
