// v9.9.39 (the 1,000,000-case test, A1 / A2 left-overs): five sentence kinds the code got wrong — each with what it must do now.
const B = await import("../scenarios/brain.mjs"), L = await import("../../web-src/life.js");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const now = Date.parse("2026-11-14T10:00:00"), k = (s) => B.classify(s, { now }).k;
// 1. cancelling a reminder never makes one (with filler words in front too)
for (const s of ["cancel my reminder to call the bank", "yo cancel my reminder to call the bank", "um, cancel my reminder to call Tom.", "ok so cancel my reminder to call the bank thx!"])
  ok(k(s) !== "reminder", `«${s}» does not make a reminder (${k(s)})`);
ok(k("remind me to call Tom at 5") === "reminder", "…a real reminder still is one");
// 2. "owe 500, paying 500 a month" keeps "a month"
ok(L.parseLife("I owe Omar 500, paying 500 a month", { now }).every === "month", "owe 500, paying 500 a month → every month");
ok(L.parseLife("I owe Omar 500", { now }).every === null, "…a plain debt has no every");
// 3. a loan to / from "my cousin" (no name after it)
const c = L.parseLife("اديت ابن عمي 15000 سلف", { now });
ok(c && c.person === "ابن عمي" && c.dir === "in" && c.amount === 15000, "«اديت ابن عمي 15000 سلف» → my cousin owes me 15,000");
const d = L.parseLife("خدت من ابن خالي 3000 سلف", { now });
ok(d && d.dir === "out" && d.amount === 3000, "«خدت من ابن خالي 3000 سلف» → I owe my cousin 3,000");
// 4. a meal with its price and a place
for (const s of ["lunch for 250 at the mall", "breakfast for 95 at Zooba", "long day, 2 meetings, then breakfast for 95 at Zooba", "long day, 6 meetings, then cat food for 1100 at City Stars"])
  ok(k(s) === "money", `«${s}» is money (${k(s)})`);
for (const s of ["lunch at 2 with Sara", "page 250 at the end"]) ok(k(s) !== "money", `«${s}» is not money`);
// 5. "is X worth N?" is a general question (for the AI), not the person's money
for (const s of ["is an Apple Watch worth 3500?", "attune is an Apple Watch worth 3500?", "pls is an Apple Watch worth 5500? ty"]) ok(k(s) === "chat", `«${s}» → chat (${k(s)})`);
ok(k("how much did I spend this month?") === "money-ask", "…“how much did I spend” is still the person's money");
console.log(fail ? `FAIL ${fail} of ${n}` : `ALL PASSED (${n} checks)`);
process.exit(fail ? 1 : 0);
