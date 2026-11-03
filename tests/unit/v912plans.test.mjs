// v9.0 (Ali: "99 percent accurate"): People & plans numbers — who owes what after partial payments, by hand-worked sums.
import { parseLife, chatLifeIntent, progressOf, scheduleOf, payAmount, togglePaid, addCommitment } from "../../web-src/life.js";
const now = Date.parse("2026-11-02T12:00:00");
let bad = 0; const ok = (c, m, x) => { if (!c) { bad++; console.log("FAIL " + m + (x ? "  " + JSON.stringify(x) : "")); } };
const mk = (t) => { const c = chatLifeIntent(t, { now }) || parseLife(t, { now }); return c ? { id: "x", ...c } : null; };
// 1. Ahmed owes 12,000, 1,000 a month for a year
let c = mk("Ahmed owes me 12,000, 1,000 a month for a year");
ok(c && c.dir === "in" && c.person === "Ahmed" && c.amount === 1000 && c.count === 12, "12,000 at 1,000 × 12, Ahmed owes me", c && [c.dir, c.person, c.amount, c.count, c.total]);
let pr = progressOf(c, now); ok(pr.left === 12000 && pr.paidCount === 0, "nothing paid: 12,000 left", pr.left);
// 2. he pays 500 on the first one → 11,500 left, spread over the 11 left
let d = payAmount({ items: [c] }, "x", 0, 500).items[0]; pr = progressOf(d, now);
ok(pr.left === 11500, "paid 500 of the first → 11,500 left", pr.left);
const rest = scheduleOf(d, now).filter((x) => !x.paid); ok(Math.round(rest.reduce((a, x) => a + x.amount, 0)) === 11500, "the 11 left add up to 11,500", rest.map((x) => x.amount));
// 3. he pays 3,000 on the second → 8,500 left
d = payAmount({ items: [d] }, "x", 1, 3000).items[0]; pr = progressOf(d, now); ok(pr.left === 8500, "then 3,000 → 8,500 left", pr.left);
ok(Math.round(scheduleOf(d, now).filter((x) => !x.paid).reduce((a, x) => a + x.amount, 0)) === 8500, "the rest add up to 8,500");
// 4. untick → back
d = togglePaid({ items: [d] }, "x", 1).items[0]; pr = progressOf(d, now); ok(pr.left === 11500, "untick the 3,000 → 11,500 again", pr.left);
// 5. overpay → nothing negative
d = payAmount({ items: [d] }, "x", 1, 20000).items[0]; pr = progressOf(d, now); ok(pr.left === 0, "pays more than owed → 0 left, never negative", pr.left);
// 6. a fridge on instalments: 1,500 × 12 = 18,000, I pay
c = mk("I bought a fridge on instalments, 1500 a month for 12 months"); ok(c && c.dir === "out" && c.amount === 1500 && c.count === 12 && progressOf(c, now).left === 18000, "fridge: 18,000 to pay", c && [c.dir, c.amount, c.count]);
// 7. gam'eya 2000 × 10, my turn 4th
c = mk("gam'eya 2000 a month for 10 months, my turn is 4th"); ok(c && c.kind === "circle" && c.amount === 2000 && c.count === 10 && c.myTurn === 4, "gam'eya 2000 × 10, my turn 4", c && [c.kind, c.amount, c.count, c.myTurn]);
// 8. Arabic
c = mk("أحمد عليه 12000 ألف كل شهر"); ok(c && c.dir === "in" && c.amount === 1000 && progressOf(c, now).left === 12000, "«أحمد عليه 12000 ألف كل شهر» → 12 × 1,000", c && [c.dir, c.amount, c.count, c.total]);
c = mk("استلفت من سارة 5000"); ok(c && c.dir === "out" && /سار/.test(c.person) && progressOf(c, now).left === 5000, "«استلفت من سارة 5000» → I owe Sara 5,000", c && [c.dir, c.person, c.amount]);
c = mk("I lent Omar 2000"); ok(c && c.dir === "in" && c.person === "Omar" && progressOf(c, now).left === 2000, "I lent Omar 2000 → he owes me 2,000", c && [c.dir, c.person]);
c = mk("I owe Ahmed 1500"); ok(c && c.dir === "out" && c.person === "Ahmed", "I owe Ahmed 1500 → I owe", c && [c.dir, c.person]);
c = mk("my sister will give me 2000 every month"); ok(c && c.dir === "in" && c.amount === 2000 && c.every === "month", "sister gives 2,000 a month → in", c && [c.dir, c.amount, c.every, c.kind]);
console.log(bad ? bad + " FAILED" : "PASS v912plans: People & plans — loans, instalments, gam'eya, partial payments re-spread, never negative, Arabic and English");
