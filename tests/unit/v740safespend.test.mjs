// v6.37 M1: "Safe to spend today" — from the ledger, People & plans and the Radar, by code.
import { safeToSpend, occurrences } from "../../web-src/safespend.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const now = Date.parse("2026-10-18T10:00:00");   // a Sunday
ok(occurrences({ freq: "monthly", nextDate: "2026-01-31" }, "2026-02-01", "2026-04-30").join() === "2026-02-28,2026-03-31,2026-04-30", "monthly on the 31st → each month's last day");
ok(occurrences({ freq: "weekly", nextDate: "2026-10-24" }, "2026-10-18", "2026-11-07").join() === "2026-10-24,2026-10-31,2026-11-07", "weekly");
ok(occurrences({ freq: "daily", nextDate: "2026-10-18", fromDay: 18, toDay: 20 }, "2026-10-18", "2026-10-25").length === 3, "daily only between two days of the month");
ok(occurrences({ freq: "monthly", nextDate: "2026-10-01", active: false }, "2026-10-01", "2026-12-01").length === 0, "a stopped one never falls due");
const ledger = { currency: "EGP", accounts: [{ id: "a", currency: "EGP", start: 20000 }, { id: "u", currency: "USD", start: 900 }],
  txns: [{ type: "expense", account: "a", amount: 300, date: "2026-10-18" }, { type: "expense", account: "a", amount: 1000, date: "2026-10-10" }, { type: "expense", account: "u", amount: 50, date: "2026-10-18" }],
  recurring: [{ type: "income", account: "a", amount: 30000, freq: "monthly", nextDate: "2026-11-01", note: "Salary" },
    { type: "expense", account: "a", amount: 450, freq: "monthly", nextDate: "2026-10-25", note: "Internet ↻" },
    { type: "expense", account: "a", amount: 9000, freq: "monthly", nextDate: "2026-11-05", note: "Rent" }],
  debts: [{ person: "Omar", type: "i_owe", amount: 2000, payments: [{ amount: 500 }], dueDate: "2026-10-28" }, { person: "Sara", type: "owed_to_me", amount: 999, dueDate: "2026-10-20" }] };
const life = { items: [{ id: "m", kind: "regular", dir: "out", amount: 600, currency: "EGP", every: "week", start: "2026-10-03", title: "Maid", paid: [] }] };
const radar = { items: [{ kind: "trial", status: "active", amount: 180, currency: "EGP", date: "2026-10-22", title: "Shahid" }, { kind: "warranty", status: "active", amount: 15000, date: "2026-10-20", title: "TV" }] };
const s = safeToSpend({ ledger, life, radar, now });
ok(s.balance === 18700 && s.spentToday === 300, "balance and today's spending in the main currency only (" + s.balance + ", " + s.spentToday + ")");
ok(s.until === "2026-10-31" && s.days === 14, "counted until the day before the next salary (" + s.until + ", " + s.days + " days)");
ok(!s.due.some((d) => d.what === "Rent"), "the rent after payday is not counted now");
const maid = s.due.filter((d) => d.from === "plans").map((d) => d.date).join();
ok(maid === "2026-10-24,2026-10-31", "the maid every Saturday until payday (" + maid + ")");
ok(s.due.some((d) => d.what === "Internet" && d.amount === 450) && s.due.some((d) => d.what === "Shahid") && !s.due.some((d) => d.what === "TV"), "bills and a trial that will charge count; a warranty does not");
ok(s.due.some((d) => d.what === "Omar" && d.amount === 1500) && !s.due.some((d) => d.what === "Sara"), "what you still owe counts; what you are owed does not");
ok(s.dueTotal === 450 + 1200 + 180 + 1500, "due total " + s.dueTotal);
const per = Math.floor((18700 + 300 - 3330) / 14);
ok(s.perDay === per && s.today === per - 300, "per day " + s.perDay + ", today " + s.today);
const tight = safeToSpend({ ledger: { ...ledger, accounts: [{ id: "a", currency: "EGP", start: 2000 }] }, life, radar, now });
ok(tight.today === 0 && tight.short > 0, "when the bills are more than the money: 0 today and how much is missing (" + tight.short + ")");
const noIncome = safeToSpend({ ledger: { ...ledger, recurring: [] }, now });
ok(noIncome.until === "2026-10-31" && noIncome.income === null, "no salary set → until the month's end");
ok(safeToSpend({ ledger: ledger, now, cushion: 5000 }).perDay < s.perDay, "a cushion kept aside lowers it");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
