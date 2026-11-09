// Ali's phone, 10 Nov 2026: the Money Report showed "Other" twice (his own "Other" category + the rest).
import { moneyReport, shiftMonth, usedCats } from "../../web-src/money-report.js";
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const now = Date.parse("2026-11-10T12:00:00");
const T = (cat, amount, i, type = "expense", note = "") => ({ id: "t" + i, type, account: "a1", cat, amount, date: "2026-11-0" + (1 + (i % 8)), note, ts: i });
const L = { currency: "EGP", accounts: [{ id: "a1", name: "Cash", currency: "EGP", start: 1000 }],
  txns: [T("groceries", 10785, 1), T("other", 3800, 2), T("food", 3700, 3), T("transport", 2500, 4), T("bills", 2000, 5), T("health", 1300, 6)] };
const r = moneyReport(L, { now });
const names = r.month.cats.map((c) => c.name);
ok(names.filter((n) => /other/i.test(n)).length === 1, "one “Other” only: " + names.join(", "));
const oth = r.month.cats.find((c) => /other/i.test(c.name));
ok(oth && oth.amount === 3800 + 2000 + 1300 && oth.id === "_rest", "…and it holds your own Other (3,800) + the small ones (7,100)");
ok(r.month.cats.reduce((a, c) => a + c.amount, 0) === r.month.out && r.month.cats.reduce((a, c) => a + c.pct, 0) === 100, "the slices still add up to the total and to 100%");
ok(names.slice(0, 3).join() === "Groceries,Food,Transport" || names.length === 4, "the top 3 are real categories");
// v9.9.8 P1 + "a specific date and category at the same time"
const L2 = { currency: "EGP", accounts: [{ id: "a1", name: "Cash", currency: "EGP", start: 50000 }], txns: [
  { id: "o1", type: "expense", account: "a1", cat: "groceries", amount: 1000, date: "2026-10-03" },
  { id: "o2", type: "expense", account: "a1", cat: "food", amount: 400, date: "2026-10-20" },
  { id: "o3", type: "income", account: "a1", cat: "salary", amount: 9000, date: "2026-10-25", note: "Salary" },
  { id: "n1", type: "expense", account: "a1", cat: "groceries", amount: 700, date: "2026-11-05" },
  { id: "n2", type: "expense", account: "a1", cat: "groceries", amount: 300, date: "2026-11-20" } ] };
const now2 = Date.parse("2026-11-10T12:00:00");
let q = moneyReport(L2, { now: now2 });
ok(q.month.out === 700 && q.period.current && q.period.whole, "no dates → this month so far (700), as before");
q = moneyReport(L2, { now: now2, ...shiftMonth("2026-11-01", -1) });
ok(q.month.out === 1400 && q.month.in === 9000 && q.period.whole && !q.period.current && q.rows.length === 3 && q.month.pace === null, "‹ → October: 1,400 spent, 9,000 earned, its 3 entries");
q = moneyReport(L2, { now: now2, from: "2026-10-01", to: "2026-11-15", cat: "groceries" });
ok(q.month.out === 1700 && q.month.in === 0 && q.rows.every((r) => r.cat === "groceries") && q.period.catName === "Groceries", "Groceries from 1 Oct to 15 Nov = 1,700 (the 20 Nov one is later, food is left out)");
q = moneyReport(L2, { now: now2, from: "2026-11-15", to: "2026-10-01" });
ok(q.period.from === "2026-10-01" && q.month.out === 2100, "From after To → swapped, never empty by mistake");
q = moneyReport(L2, { now: now2, from: "2026-11-01", to: "2026-11-30" });
ok(q.month.out === 700, "nothing after today is counted (the 20 Nov entry is in the future)");
ok(shiftMonth("2026-01-01", -1).from === "2025-12-01" && shiftMonth("2026-01-01", -1).to === "2025-12-31", "‹ from January goes to December of the year before");
ok(usedCats(L2).map((c) => c.id)[0] === "groceries", "the category list: the ones you use most first");
if (fails) { console.log("FAILED " + fails); process.exit(1); } else console.log("ALL PASSED");
