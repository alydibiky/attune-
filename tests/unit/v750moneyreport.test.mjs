// v7.2: Money in two levels (Gemini's Area 1 mock-up) — the calm view's and the Money Report's numbers, by code from the ledger.
import { moneyReport, accountBalance, accountsOf, donutArcs, zakatFromSnapshot, ledgerCsv } from "../../web-src/money-report.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const now = new Date("2026-10-23T12:00:00").getTime();
const L = { currency: "EGP",
  accounts: [{ id: "c", name: "Cash", currency: "EGP", start: 1000 }, { id: "b", name: "CIB", currency: "EGP", start: 10000 },
    { id: "u", name: "USD", currency: "USD", start: 100 }, { id: "g", name: "Gold", kind: "gold", karat: 21, start: 28 }],
  txns: [
    { id: "1", type: "income", amount: 18000, cat: "salary", account: "b", date: "2026-10-18", note: "October salary" },
    { id: "2", type: "expense", amount: 520, cat: "bills", account: "b", date: "2026-10-20", note: "WE internet" },
    { id: "3", type: "expense", amount: 640, cat: "groceries", account: "b", date: "2026-10-22", note: "Seoudi" },
    { id: "4", type: "expense", amount: 85, cat: "food", account: "c", date: "2026-10-23", note: "Koshari" },
    { id: "5", type: "expense", amount: 300, cat: "transport", account: "c", date: "2026-10-05", note: "Uber" },
    { id: "6", type: "expense", amount: 200, cat: "fun", account: "c", date: "2026-10-06", note: "Cinema" },
    { id: "7", type: "expense", amount: 50, cat: "coffee", account: "c", date: "2026-10-07", note: "" },
    { id: "8", type: "expense", amount: 1000, cat: "rent", account: "b", date: "2026-09-10", note: "September" },
    { id: "9", type: "income", amount: 16000, cat: "salary", account: "b", date: "2026-09-18", note: "" },
    { id: "10", type: "expense", amount: 20, cat: "food", account: "u", date: "2026-10-10", note: "Lunch abroad" },
    { id: "11", type: "transfer", amount: 500, account: "b", toAccount: "c", date: "2026-10-02" },
    { id: "12", type: "debt", flow: "lend", amount: 1000, account: "c", date: "2026-10-03" },
  ],
  budgets: { overall: 6450, cats: {} },
  recurring: [{ id: "r1", type: "expense", amount: 400, cat: "bills", account: "b", nextDate: "2026-10-26", note: "Electricity", active: true },
    { id: "r2", type: "expense", amount: 650, cat: "other", account: "c", nextDate: "2026-10-24", note: "Maid", active: true },
    { id: "r3", type: "expense", amount: 900, cat: "bills", account: "b", nextDate: "2026-11-15", note: "Gym", active: true }],
  customCats: [], debts: [] };

ok(accountBalance(L, "c") === 1000 + 500 - 1000 - 85 - 300 - 200 - 50, "Cash: start + transfer in − money lent − its expenses (Yusr's own rule): " + accountBalance(L, "c"));
ok(accountBalance(L, "b") === 10000 + 18000 + 16000 - 520 - 640 - 1000 - 500, "CIB: " + accountBalance(L, "b"));
ok(accountsOf(L).map((a) => a.id).join() === "c,b,u", "gold (grams) is not a money account");
const r = moneyReport(L, { now });
ok(r.cur === "EGP" && r.balance === accountBalance(L, "c") + accountBalance(L, "b"), "balance = all EGP accounts, USD apart: " + r.balance);
ok(r.others.length === 1 && r.others[0].currency === "USD" && r.others[0].balance === 80, "USD listed apart: " + JSON.stringify(r.others));
ok(r.month.in === 18000 && r.month.out === 520 + 640 + 85 + 300 + 200 + 50, "this month in / out (USD lunch not added): " + r.month.in + " / " + r.month.out);
ok(r.month.count === 7, "7 EGP entries this month: " + r.month.count);
ok(r.month.daysLeft === 8, "8 days left in October: " + r.month.daysLeft);
ok(r.month.cats.length === 4 && r.month.cats[0].id === "groceries" && r.month.cats[3].id === "_rest", "4 slices, biggest first, the rest as Other: " + r.month.cats.map((c) => c.id));
ok(r.month.cats.reduce((a, c) => a + c.pct, 0) === 100, "the percentages add up to 100: " + r.month.cats.map((c) => c.pct));
ok(r.month.cats.reduce((a, c) => a + c.amount, 0) === r.month.out, "the slices add up to what was spent");
ok(r.month.pace === Math.round(((1795 - 1000) / 1000) * 100), "pace vs the same days of September: " + r.month.pace);
ok(r.weeks.length === 4 && r.weeks[3].to === "2026-10-23" && r.weeks[3].out === 520 + 640 + 85, "this week (17–23 Oct): " + JSON.stringify(r.weeks[3]));
ok(r.weekTarget === 1500, "weekly target = budget / 4.3: " + r.weekTarget);
ok(r.months.length === 6 && r.months[5].key === "2026-10" && r.months[4].in === 16000 && r.months[4].out === 1000, "6 months, September in/out: " + JSON.stringify(r.months[4]));
ok(r.recent.length === 3 && r.recent[0].note === "Koshari" && r.recent[0].account === "Cash", "3 latest, newest first, with the account name");
ok(r.rows.length === 7 && r.rows.every((t) => t.date >= "2026-10-01"), "the month's ledger");
ok(r.due.length === 2 && r.due[0].note === "Maid" && r.dueTotal === 1050, "bills due in 7 days: " + r.dueTotal);
const rc = moneyReport(L, { now, account: "c" });
ok(rc.balance === accountBalance(L, "c") && rc.month.in === 0 && rc.month.out === 635 && rc.due.length === 1, "one account: its balance, its month, its bills");
ok(moneyReport(L, { now, ar: true }).month.cats[0].name === "بقالة", "category names in Arabic");
const arcs = donutArcs(r.month.cats, 276.5);
ok(arcs[0].offset === 0 && Math.abs(arcs.reduce((a, s) => a + s.dash, 0) - 276.5) < 0.1, "donut arcs fill the circle");
ok(zakatFromSnapshot(null) === null && zakatFromSnapshot({ zakat: { noPrice: true } }).noPrice, "zakāt: nothing from Yusr → nothing; no price → said so");
const z = zakatFromSnapshot({ zakat: { due: false, base: 131105, nisab: 348500, amount: null } });
ok(z.pct === 38 && z.base === 131105, "zakāt: Yusr's base against Yusr's niṣāb = 38%");
const csv = ledgerCsv(r);
ok(csv.startsWith("﻿Date,") && csv.includes("Koshari") && csv.includes("-85"), "the month as a CSV for Excel");
const E = moneyReport({ currency: "EGP", accounts: [], txns: [] }, { now });
ok(E.balance === 0 && E.month.cats.length === 0 && E.recent.length === 0, "an empty ledger does not break");
console.log(fail ? "FAIL " + fail : "PASS all");
{ // v8.7 (Ali: "I want earned to have a pie chart to see where it's earned from")
  const M = await import("../../web-src/money-report.js");
  const d = new Date(), iso = (k) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(k).padStart(2, "0")}`;
  const L = { currency: "EGP", accounts: [{ id: "a", name: "Bank", currency: "EGP", start: 0 }], txns: [
    { id: "1", type: "income", amount: 60000, date: iso(1), account: "a", cat: "salary", note: "Salary" },
    { id: "2", type: "income", amount: 20000, date: iso(1), account: "a", cat: "other", note: "Flat rent" },
    { id: "3", type: "income", amount: 2000, date: iso(1), account: "a", cat: "other", note: "" },
    { id: "4", type: "expense", amount: 500, date: iso(1), account: "a", cat: "food" }] };
  const r = M.moneyReport(L, { now: new Date(d.getFullYear(), d.getMonth(), 2, 12).getTime() });
  const s = r.month.sources.map((x) => [x.name, x.amount, x.pct]);
  if (JSON.stringify(s) !== JSON.stringify([["Salary", 60000, 73], ["Flat rent", 20000, 24], ["Other", 2000, 3]])) throw new Error("income sources: " + JSON.stringify(s));
  console.log("v750moneyreport (+ income sources): Salary 73% · Flat rent 24% · Other 3%");
}
