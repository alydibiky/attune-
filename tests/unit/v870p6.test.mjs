// Ali's answers (28 Oct): persona 6's "still open" list.
import assert from "node:assert/strict";
const LS = {}; globalThis.localStorage = { getItem: (k) => LS[k] ?? null, setItem: (k, v) => { LS[k] = String(v); }, removeItem: (k) => delete LS[k] };
const A = await import("../../web-src/actions.js"), DL = await import("../../web-src/deadlines.js"), C = await import("../../web-src/calc.js");
let n = 0; const t = (name, fn) => { fn(); n++; };
const now = Date.parse("2026-10-28T10:00:00");
const day = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
t("every last Friday of the month is a monthly reminder", () => {
  const r = A.quickAction("remind me every last Friday of the month to pay the guard", now);
  assert.equal(r.repeat, "last:5"); assert.equal(r.title, "pay the guard"); assert.equal(day(r.at), "2026-10-30");
  assert.equal(day(A.nextOccurrence(r, r.at)), "2026-11-27");
  const a = A.quickAction("فكرني كل آخر جمعة في الشهر ادفع للبواب الساعة 8 بالليل", now);
  assert.equal(a.repeat, "last:5"); assert.equal(new Date(a.at).getHours(), 20);
  assert.equal(A.quickAction("remind me every month on the 10th to pay rent", now).repeat, "monthly");
});
t("next month / a year alone / a day of the month", () => {
  assert.equal(DL.readDeadlines("my car insurance expires next month", { now })[0].date, "2026-11-01");
  assert.equal(DL.readDeadlines("warranty ends 2028", { now })[0].date, "2028-01-01");
  assert.equal(DL.readDeadlines("netflix renews on the 5th", { now })[0].date, "2026-11-05");
  assert.equal(DL.readDeadlines("my bill was 2028 pounds", { now }).length, 0);
});
t("10 % 3 is the remainder, 10% 3 a percentage", () => {
  assert.equal(C.calculate("10 % 3").value, 1); assert.equal(C.calculate("10 mod 3").value, 1);
  assert.ok(Math.abs(C.calculate("10% 3").value - 0.3) < 1e-9);
});
console.log(`v870p6: ${n} checks passed`);
