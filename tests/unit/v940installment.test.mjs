// v9.4 (Ali, 5 Nov 2026, a screenshot: "I told it Sheikh pays me 19,500 in installments of 2,500 on the first day of each month —
// why did it turn it to 20,000?"): a total with a payment size keeps the TOTAL; the last payment is the rest.
import { parseLife, scheduleOf, progressOf } from "../../web-src/life.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const now = Date.parse("2026-11-05T12:00:00");
for (const s of ["sheikh pays me 19500 in installments of 2500 on first day of each month", "Sheikh owes me 19500, 2500 a month",
  "الشيخ هيدفعلي 19500 على أقساط 2500 أول كل شهر", "I owe Sheikh 19,500, paying 2,500 a month", "phone installments 19500, 2500 a month"]) {
  const c = parseLife(s, { now }) || {}, sc = c.kind ? scheduleOf(c, now) : [];
  ok(c.kind === "installment" && c.total === 19500 && c.count === 8 && c.amount === 2500, "«" + s + "» → 19,500 in all, 8 payments of 2,500: " + JSON.stringify({ t: c.total, n: c.count, a: c.amount }));
  ok(sc.length === 8 && sc.slice(0, 7).every((x) => x.amount === 2500) && sc[7].amount === 2000 && sc.reduce((a, x) => a + x.amount, 0) === 19500, "…7 × 2,500 and the last 2,000 — adds up to 19,500 exactly");
}
const c = parseLife("Sheikh owes me 19500, 2500 a month", { now });
ok(progressOf(c, now).left === 19500 && sc0(c)[0].date === "2026-12-01", "left to pay 19,500; the first payment on 1 December");
function sc0(c) { return scheduleOf(c, now); }
// the even cases are unchanged
const e = parseLife("Ahmed owes me 12000, 1000 a month", { now });
ok(e.total === 12000 && e.count === 12 && scheduleOf(e, now).every((x) => x.amount === 1000), "12,000 at 1,000 a month → 12 × 1,000");
const g = parseLife("Ahmed owes me 22000 over 9 months", { now });
ok(g.total === 22000 && g.count === 9 && Math.round(scheduleOf(g, now).reduce((a, x) => a + x.amount, 0) * 100) / 100 === 22000, "22,000 over 9 months still adds up to 22,000");
const h = parseLife("Mona pays me 1500 a month for 6 months", { now });
ok(h.total === 9000 && h.count === 6, "1,500 a month for 6 months → 9,000");
