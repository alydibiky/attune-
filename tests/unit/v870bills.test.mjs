// v8.7 bills autopilot (persona 4, idea 14): learned from Money by code
import assert from "node:assert/strict";
import { billsOf, billLine, billsAnswer, billsIntent } from "../../web-src/bills.js";
import { findings } from "../../web-src/guardian.js";
import { morningCard } from "../../web-src/morning.js";
import * as D from "../../web-src/doit.js";
let n = 0; const t = (name, f) => { f(); n++; };
const now = new Date(2026, 9, 28, 12).getTime();   // 28 Oct
const tx = (date, amount, note, cat = "bills") => ({ id: date + note, type: "expense", date, amount, note, cat });
const months = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
const ledger = { txns: [
  ...months.map((m, i) => tx(m + "-10", [800, 820, 790, 810, 805][i], "electricity")),
  tx("2026-10-11", 1150, "Electricity"),                                   // 43% higher
  ...months.map((m) => tx(m + "-05", 450, "WE internet")),                 // not paid in October (usually the 5th)
  ...months.slice(2).map((m) => tx(m + "-29", 120, "فاتورة المية")),       // water usually the 29th → tomorrow
  ...months.map((m) => tx(m + "-12", 300, "gas station fuel", "transport")), // petrol is not the gas bill
  tx("2026-09-20", 99, "gas bill"), tx("2026-08-20", 99, "gas bill"),      // only 2 months: not learned yet
] };

t("each home bill is learned: its usual day and its median amount", () => {
  const b = billsOf(ledger, now), by = Object.fromEntries(b.map((x) => [x.kind, x]));
  assert.equal(by.electricity.usualDay, 10); assert.equal(by.electricity.usual, 805); assert.equal(by.electricity.status, "high"); assert.equal(by.electricity.pct, 43);
  assert.equal(by.internet.status, "late"); assert.equal(by.internet.usualDay, 5);
  assert.equal(by.water.status, "coming"); assert.equal(by.water.inDays, 1);
  assert.ok(!by.gas, "petrol and a bill seen twice are not a learned gas bill");
  assert.equal(b[0].kind, "electricity");
});
t("the lines say it in English and Egyptian Arabic", () => {
  const e = billsOf(ledger, now)[0];
  assert.match(billLine(e, "en", "EGP"), /Electricity is 43% higher than usual \(1,150 vs 805 EGP\) — check the meter reading/);
  assert.match(billLine(e, "ar"), /الكهربا الشهر ده أعلى من العادي بـ43%/);
  const w = billsOf(ledger, now).find((x) => x.kind === "water");
  assert.match(billLine(w, "en", "EGP"), /Water comes tomorrow — about 120 EGP/);
});
t("Guardian shows high and late bills; the morning card names them", () => {
  const f = findings({ ledger, life: { items: [] }, now }).filter((x) => x.kind === "bill");
  assert.equal(f.length, 2); assert.ok(f.some((x) => /Electricity/.test(x.title)) && f.some((x) => x.bill.kind === "internet"));
  const c = morningCard({ ledger }, now + 864e5, "en");
  assert.ok(c.lines.some((l) => /Electricity is 43% higher/.test(l)), c.lines.join(" | "));
});
t("'my bills' / «فواتيري» in the Home box", () => {
  assert.ok(billsIntent("my bills") && billsIntent("فواتيري؟") && billsIntent("when does my electricity bill come") && !billsIntent("paid my bills 300"));
  const u = D.understand("my bills", { now, stores: { ledger } });
  assert.equal(u.ask.kind, "bills"); assert.match(u.ask.en, /Internet usually comes around the 5th/); assert.match(u.ask.ar, /النت/);
  assert.match(billsAnswer({ txns: [] }, now), /don't know your bills yet/);
});
console.log(`v870bills: ${n} checks passed`);
