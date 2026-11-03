// v9.0 (Ali: "99 percent accurate"): Safe to spend today against hand-worked numbers.
import { safeToSpend } from "../../web-src/safespend.js";
let bad = 0; const ok = (c, m, x) => { if (!c) { bad++; console.log("FAIL " + m + (x !== undefined ? "  " + JSON.stringify(x) : "")); } };
const now = Date.parse("2026-11-12T20:00:00");   // 12 Nov → 30 Nov = 19 days
const A = [{ id: "c", name: "Cash", currency: "EGP", start: 10000 }, { id: "u", name: "USD", currency: "USD", start: 5000 }];
// 1. 10,000, rent 3,000 on the 25th, no salary set → (10,000 − 3,000) ÷ 19 = 368
let r = safeToSpend({ ledger: { currency: "EGP", accounts: A, txns: [], recurring: [{ type: "expense", amount: 3000, note: "rent", freq: "monthly", nextDate: "2026-11-25", account: "c" }] }, now });
ok(r.perDay === 368 && r.today === 368 && r.dueTotal === 3000 && r.until === "2026-11-30" && r.days === 19, "10,000 − rent 3,000, 19 days → 368 a day", [r.perDay, r.today, r.dueTotal, r.until, r.days]);
ok(r.balance === 10000, "dollars never added to the pounds", r.balance);
// 2. spent 500 today → the day's share is used up: 0 left today, still 368 a day
r = safeToSpend({ ledger: { currency: "EGP", accounts: A, txns: [{ type: "expense", amount: 500, date: "2026-11-12", account: "c" }], recurring: [{ type: "expense", amount: 3000, note: "rent", freq: "monthly", nextDate: "2026-11-25", account: "c" }] }, now });
ok(r.perDay === 368 && r.today === 0 && r.spentToday === 500, "spent 500 today → 0 left today, 368 a day", [r.perDay, r.today]);
// 3. salary on the 25th → only until the 24th (13 days): (10,000 − nothing due before) ÷ 13 = 769
r = safeToSpend({ ledger: { currency: "EGP", accounts: A, txns: [], recurring: [{ type: "income", amount: 25000, note: "salary", freq: "monthly", nextDate: "2026-11-25", account: "c" }] }, now });
ok(r.until === "2026-11-24" && r.days === 13 && r.perDay === 769, "salary on the 25th → 10,000 ÷ 13 days = 769", [r.until, r.days, r.perDay]);
// 4. bills more than the money → 0, and says how much is short
r = safeToSpend({ ledger: { currency: "EGP", accounts: [{ id: "c", currency: "EGP", start: 1000 }], txns: [], recurring: [{ type: "expense", amount: 3000, freq: "monthly", nextDate: "2026-11-25", account: "c" }] }, now });
ok(r.today === 0 && r.short === 2000, "1,000 with 3,000 due → 0 today, 2,000 short", [r.today, r.short]);
// 5. a debt I owe due on the 20th counts; one owed TO me doesn't
r = safeToSpend({ ledger: { currency: "EGP", accounts: A, txns: [], recurring: [], debts: [{ person: "Ahmed", amount: 1900, dueDate: "2026-11-20", type: "i_owe", payments: [] }, { person: "Sara", amount: 5000, dueDate: "2026-11-20", type: "owed_to_me", payments: [] }] }, now });
ok(r.dueTotal === 1900 && r.perDay === Math.floor((10000 - 1900) / 19), "my debt counts, Sara's to me doesn't", [r.dueTotal, r.perDay]);
// 6. a cushion is kept untouched
r = safeToSpend({ ledger: { currency: "EGP", accounts: A, txns: [], recurring: [] }, now, cushion: 4300 });
ok(r.perDay === 300, "keep 4,300 aside → (10,000 − 4,300) ÷ 19 = 300", r.perDay);
console.log(bad ? bad + " FAILED" : "PASS v914safe: Safe to spend matches hand-worked numbers");
