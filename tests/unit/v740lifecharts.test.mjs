// v6.38 (H3) — Ask your life with charts. node tests/unit/v740lifecharts.test.mjs
import assert from "node:assert/strict";
import { sinceOf, monthly, moneyTrend, chartOfRows, TREND } from "../../web-src/lifecharts.js";
const now = new Date(2026, 9, 18, 12).getTime();
assert.equal(sinceOf("How did my food spending change since Ramadan?", now).date, "2026-02-18");
assert.equal(sinceOf("مصاريف الأكل اتغيرت ازاي من رمضان؟", now).date, "2026-02-18");
assert.equal(sinceOf("since March", now).date, "2026-03-01");
assert.equal(sinceOf("since December", now).date, "2025-12-01");
assert.equal(sinceOf("من العيد الكبير", now).date, "2026-05-27");
assert.equal(sinceOf("food this month", now), null);
assert.ok(TREND.test("How did my food spending change since Ramadan?") && TREND.test("مصاريف الأكل كل شهر") && !TREND.test("How much did I spend on food this month?"));
// food: 3,000 a month before Ramadan, 4,500 a month after (each month the same)
const txns = [];
for (let m = 8; m <= 21; m++) {   // Sep 2025 … Oct 2026
  const y = 2025 + Math.floor(m / 12), mo = (m % 12) + 1, d = `${y}-${String(mo).padStart(2, "0")}-10`;
  const after = d >= "2026-02-18";
  txns.push({ type: "expense", cat: "food", amount: after ? 4500 : 3000, date: d, account: "a" }, { type: "expense", cat: "rent", amount: 8000, date: d, account: "a" });
}
const ledger = { currency: "EGP", accounts: [{ id: "a", currency: "EGP", start: 0 }], txns };
const m = monthly(ledger, { cat: "food", from: "2026-01-01", to: "2026-03-31" });
assert.deepEqual(m.points.map((p) => p.value), [3000, 3000, 4500]);
const r = moneyTrend("How did my food spending change since Ramadan?", ledger, now);
assert.equal(r.kind, "money-trend");
assert.equal(r.chart.mark, "2026-02");
assert.ok(Math.abs(r.before - 3000) < 400 && Math.abs(r.after - 4500) < 500, r.en);
assert.ok(r.pct > 30 && r.pct < 70, "about +50%: " + r.en);
assert.match(r.en, /^Food spending: about .* a month before Ramadan/);
assert.match(r.ar, /قبل رمضان/);
const r2 = moneyTrend("my spending by month", ledger, now);
assert.equal(r2.chart.points.length, 6);
assert.equal(r2.chart.points[5].value, 12500);
assert.equal(moneyTrend("How much did I spend on food this month?", ledger, now), null);
assert.deepEqual(chartOfRows([["2026-01-02", "7.8 %"], ["2026-04-02", "7.1 %"]]).points.map((p) => p.value), [7.8, 7.1]);
assert.equal(chartOfRows([["x", "none"]]), null);
console.log("v740lifecharts: all passed");
