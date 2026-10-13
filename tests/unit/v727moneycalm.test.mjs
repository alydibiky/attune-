// v6.27: Money on a computer (design A "Calm") — the Overview's numbers, computed by code from the ledger.
import { moneyOverview, fmt } from "../../web-src/money-calm.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const now = new Date("2026-10-13T12:00:00").getTime();
const L = { currency: "EGP",
  accounts: [{ id: "c", name: "Cash", currency: "EGP", start: 1000 }, { id: "b", name: "CIB", currency: "EGP", start: 40000 }, { id: "u", name: "USD", currency: "USD", start: 100 }],
  txns: [
    { type: "income", amount: 15000, cat: "salary", account: "b", date: "2026-10-01", note: "Salary" },
    { type: "expense", amount: 450, cat: "bills", account: "b", date: "2026-10-01", note: "Internet" },
    { type: "expense", amount: 600, cat: "transport", account: "c", date: "2026-10-12", note: "Fuel 92" },
    { type: "expense", amount: 350, cat: "groceries", account: "b", date: "2026-10-13", note: "Carrefour" },
    { type: "expense", amount: 2000, cat: "rent", account: "b", date: "2026-09-28", note: "September" },
    { type: "expense", amount: 20, cat: "food", account: "u", date: "2026-10-10", note: "Lunch abroad" },
    { type: "transfer", amount: 500, account: "b", toAccount: "c", date: "2026-10-05" },
  ],
  budgets: { overall: 12000, cats: {} },
  recurring: [{ id: "r1", type: "expense", amount: 640, cat: "bills", account: "b", freq: "monthly", nextDate: "2026-10-16", note: "Electricity", active: true },
    { id: "r2", type: "expense", amount: 300, cat: "bills", account: "b", freq: "monthly", nextDate: "2026-10-10", note: "Water", active: true },
    { id: "r3", type: "expense", amount: 900, cat: "bills", account: "b", freq: "monthly", nextDate: "2026-11-01", note: "Gym", active: true }],
  debts: [{ id: "d1", type: "owed_to_me", person: "Ahmed", amount: 12000, note: "installments", settled: false, payments: [{ amount: 1000 }, { amount: 1000 }, { amount: 1000 }] },
    { id: "d2", type: "i_owe", person: "Sara", amount: 500, settled: false, payments: [] },
    { id: "d3", type: "owed_to_me", person: "Omar", amount: 200, settled: true, payments: [] }] };
const o = moneyOverview(L, now);
ok(o.balance === 1000 + 40000 + 15000 - 450 - 600 - 350 - 2000, "the EGP balance: starts + income − expenses; a transfer between my accounts changes nothing (" + fmt(o.balance) + ")");
ok(o.others.length === 1 && o.others[0].currency === "USD" && o.others[0].balance === 80, "dollars are never added to pounds — listed apart: " + JSON.stringify(o.others));
ok(o.monthIn === 15000 && o.monthOut === 1400, "this month: in 15,000, out 1,400 (September's rent is last month): " + o.monthOut);
ok(o.weeks.length === 4 && o.weeks[3].out === 950 && o.weeks[3].to === "2026-10-13", "spending by week, this week last: " + o.weeks.map((w) => w.out).join(", "));
ok(o.latest[0].note === "Carrefour" && o.latest.every((t) => t.type !== "transfer"), "the latest entries, newest first");
ok(o.due.map((d) => d.note).join(",") === "Water,Electricity" && o.due[0].late && !o.due[1].late, "bills due within 7 days, the late one first and marked");
ok(o.owed.length === 1 && o.owed[0].person === "Ahmed" && o.owed[0].left === 9000 && o.owed[0].paid === 3, "Ahmed owes 9,000 more after 3 payments; a settled debt is gone");
ok(o.owe.length === 1 && o.owe[0].person === "Sara", "what I owe is kept apart");
ok(fmt(-350.5) === "−350.5" && fmt(15000, { sign: true }) === "+15,000" && fmt(0) === "0", "amounts read like people write them");
ok(moneyOverview(null, now).balance === 0, "no ledger yet → zeros, no crash");
console.log(fail ? fail + " FAILED" : "v727moneycalm ok");
process.exit(fail ? 1 : 0);
