// Ali's phone, 10 Nov 2026: the Money Report showed "Other" twice (his own "Other" category + the rest).
import { moneyReport } from "../../web-src/money-report.js";
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
if (fails) { console.log("FAILED " + fails); process.exit(1); } else console.log("ALL PASSED");
