// v7.6: Money's bottom bar (Ali, layout A) — the Accounts, Bills and Zakāt pages' numbers by code, and the + sheet's check.
import { accountsPage, billsPage, zakatPage, perMonth, sheetCats, sheetTxn } from "../../web-src/money-pages.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const now = new Date("2026-10-24T12:00:00").getTime();
const L = { currency: "EGP",
  accounts: [{ id: "c", name: "Cash", currency: "EGP", start: 4000 }, { id: "b", name: "CIB", currency: "EGP", start: 6000 }, { id: "u", name: "USD", currency: "USD", start: 100 }, { id: "g", name: "Gold", kind: "gold", karat: 21, start: 25 }],
  txns: [{ id: 1, type: "income", amount: 18000, account: "b", date: "2026-10-05", cat: "salary" }, { id: 2, type: "expense", amount: 520, account: "b", date: "2026-10-03", cat: "bills" },
    { id: 3, type: "expense", amount: 85, account: "c", date: "2026-10-24", cat: "food" }, { id: 4, type: "transfer", amount: 1000, account: "b", toAccount: "c", date: "2026-10-10" },
    { id: 5, type: "expense", amount: 980, account: "b", date: "2026-09-20", cat: "other", recurring: true, note: "Electricity ↻" }, { id: 6, type: "income", amount: 16000, account: "b", date: "2026-09-15", cat: "salary" }],
  recurring: [{ id: "r1", type: "expense", amount: 980, account: "b", freq: "monthly", nextDate: "2026-10-27", note: "Electricity", active: true },
    { id: "r2", type: "expense", amount: 100, account: "c", freq: "weekly", nextDate: "2026-10-22", note: "Cleaner", active: true },
    { id: "r3", type: "income", amount: 18000, account: "b", freq: "monthly", nextDate: "2026-11-05", active: true },
    { id: "r4", type: "expense", amount: 1200, account: "b", freq: "yearly", nextDate: "2027-03-01", note: "Car licence", active: true },
    { id: "r5", type: "expense", amount: 50, account: "c", freq: "monthly", nextDate: "2026-10-25", note: "Old", active: false }],
  zakatPayments: [{ id: "z1", amount: 2500, date: "2026-04-07", to: "Masr El Kheir" }, { id: "z2", amount: 1200, date: "2026-09-24", to: "Uncle Hassan" }, { id: "z3", amount: 900, date: "2025-03-01" }] };
const a = accountsPage(L, { now });
ok(a.money.length === 3 && a.other.length === 1 && a.other[0].unit.includes("21"), "money accounts apart from the gold (grams, 21k)");
ok(a.money.find((x) => x.id === "c").balance === 4000 - 85 + 1000 && a.money.find((x) => x.id === "b").balance === 6000 + 18000 - 520 - 1000 - 980 + 16000, "balances with the transfer");
ok(a.balance === 4915 + 37500 && a.totals.find((x) => x.currency === "USD").balance === 100, "EGP total; USD kept apart: " + a.balance);
ok(a.monthIn === 18000 && a.monthOut === 605, "this month in / out (transfers are not spending)");
ok(a.trend.length === 6 && a.trend[5].balance === a.balance && a.trend[4].balance === 10000 + 16000 - 980, "the month-end balance trend ends at today's balance: " + JSON.stringify(a.trend.slice(-2)));
ok(perMonth({ amount: 100, freq: "weekly" }) === 435 && perMonth({ amount: 1200, freq: "yearly" }) === 100 && perMonth({ amount: 10, freq: "daily", fromDay: 1, toDay: 5 }) === 50, "a month of a weekly, a yearly and a daily-on-5-days bill");
const b = billsPage(L, { now });
ok(b.list.length === 3 && b.list[0].name === "Cleaner" && b.list[0].late && b.list[1].daysTo === 3, "active bills (income and paused left out), the late one first, then in 3 days");
ok(b.monthly === 980 + 435 + 100, "what bills cost a month: " + b.monthly);
ok(b.due7.length === 2 && b.dueTotal === 1080 && b.late === 1, "due in 7 days (and late)");
ok(b.months.length === 6 && b.months[4].out === 980 && b.months[5].out === 520, "bills by month: September's posted bill, October's Bills entry");
ok(b.paidThisMonth === 520 && b.paid[0].amount === 520, "paid this month");
const snap = { zakat: { due: true, amount: 1312.5, nisab: 300000, base: 52500 * 10, hawlEndsISO: "2026-11-03", madhhab: "Hanafi", basis: "2.5% of …", sources: ["Abu Dawud 1573"] } };
const z = zakatPage(L, snap, { now });
ok(z.status.due && z.status.amount === 1312.5 && z.hawlDays === 10 && z.madhhab === "Hanafi", "Zakāt as the ledger's engine sent it, and the days left in the ḥawl");
ok(z.payments[0].to === "Uncle Hassan" && z.paidYear === 3700 && z.years.map((y) => y.year).join() === "2025,2026", "payments, the last 12 months, by year");
ok(zakatPage(L, null, { now }).status === null, "no snapshot → nothing computed here");
ok(sheetCats(L, "income").map((c) => c.id).join() === "salary,gifts,other" && sheetCats(L, "expense")[0].id === "food", "the sheet's categories");
ok(!sheetTxn({ type: "expense", amount: "", account: "c" }).ok && !sheetTxn({ type: "expense", amount: "5" }).ok, "no amount or no account → asked");
const s1 = sheetTxn({ type: "expense", amount: "1,250.5", cat: "food", account: "c", date: "2026-10-24", note: "x" });
ok(s1.ok && s1.txn.amount === 1250.5 && s1.txn.byUser === true && s1.txn.cat === "food", "an expense, the account picked by the person");
ok(!sheetTxn({ type: "transfer", amount: 5, account: "c", toAccount: "c" }).ok && sheetTxn({ type: "transfer", amount: 5, account: "c", toAccount: "b" }).txn.toAccount === "b", "a transfer needs another account");
ok(!sheetTxn({ type: "zakat", amount: 5, account: "c" }).ok, "never a Zakāt entry from outside");
console.log(fail ? "FAIL " + fail : "PASS all");
