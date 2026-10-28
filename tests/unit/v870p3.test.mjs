// Ali's picks from persona 3 (28 Oct): the business decisions that are code.
import assert from "node:assert/strict";
const LS = {}; globalThis.localStorage = { getItem: (k) => LS[k] ?? null, setItem: (k, v) => { LS[k] = String(v); }, removeItem: (k) => delete LS[k] };
const B = await import("../../web-src/billing.js"), U = await import("../../web-src/trialuse.js");
let n = 0; const t = (name, fn) => { fn(); n++; };
t("Free answers are unlimited; one free agent; outcomes first", () => {
  assert.equal(B.FREE_LIMITS.answersPerDay, Infinity); assert.equal(B.FREE_LIMITS.agents, 1);
  assert.equal(B.COMPARE_ROWS[0][1], "Unlimited"); assert.match(B.PRO_BENEFITS[0], /^Agents that find/);
});
t("Lifetime is a launch offer", () => {
  assert.equal(B.lifetimeOffer(Date.parse("2026-11-01")), true); assert.equal(B.lifetimeOffer(Date.parse("2027-03-01")), false);
});
t("a referral link carries this phone's code; the friend gets a month", () => {
  const link = B.referralLink("PRO-ABCD1234"); assert.match(link, /referrer=attune_ref%3DPRO-ABCD1234$/);
  assert.equal(B.referralFrom("utm_source=google-play&attune_ref=PRO-ABCD1234"), "PRO-ABCD1234"); assert.equal(B.referralFrom("utm_source=google-play"), "");
  assert.equal(B.trialDaysLeft(Date.now() - 10 * 864e5, Date.now(), B.REFERRAL_DAYS), 20);
});
t("what Pro was used for, and when Home says so", () => {
  U.noteProUse("photo"); U.noteProUse("photo"); U.noteProUse("agent"); U.noteProUse("deal");
  assert.equal(U.usedLine("en"), "2 meals by photo, 1 agent and 1 deal check");
  assert.equal(U.trialNote({ left: 2, started: true, pro: false }).kind, "ending");
  assert.equal(U.trialNote({ left: 5, started: true, pro: false }), null);
  assert.equal(U.trialNote({ left: 0, started: true, pro: false, seenEnd: false }).kind, "ended");
  assert.equal(U.trialNote({ left: 0, started: true, pro: false, seenEnd: true }), null);
});
console.log(`v870p3: ${n} checks passed`);
const AG = await import("../../web-src/agents.js");
t("agents learn taste after two alike 'Not this one'", () => {
  const t1 = AG.learnTaste([{ name: "iPhone 15 Renewed", site: "amazon.eg" }]); assert.equal(t1.used, false);
  const t2 = AG.learnTaste([{ name: "iPhone 15 Renewed", site: "amazon.eg" }, { name: "iPhone 15 (Refurbished)", site: "amazon.eg" }]);
  assert.equal(t2.used, true); assert.deepEqual(t2.sites, ["amazon.eg"]);
  assert.equal(AG.fitsTaste({ name: "iPhone 15 Refurbished", site: "noon" }, t2), false); assert.equal(AG.fitsTaste({ name: "iPhone 15", site: "noon" }, t2), true);
  assert.deepEqual(AG.tasteNews({}, t2).map((x) => x[0])[0], "You skip refurbished and used ones — I'll leave them out");
  assert.equal(AG.bestThree([{ name: "A Refurbished", price: 5 }, { name: "B new", price: 9 }], [], t2).length, 1);
});
console.log(`v870p3 (+ taste): ${n} checks passed`);
t("price history of an agent", () => {
  const D0 = Date.parse("2026-10-01T10:00:00"), checks = [];
  for (let i = 0; i < 20; i++) checks.push({ at: D0 + i * 864e5, price: 9400 - i * 20 - (new Date(D0 + i * 864e5).getDay() === 5 ? 300 : 0) });
  const h = AG.priceHistory({ checks }); assert.equal(h.trend, "down"); assert.equal(h.lowDay, 5); assert.ok(h.low.price < 9100);
  assert.equal(AG.priceHistory({ checks: [{ at: 1, price: 5 }] }), null);
});
console.log(`v870p3 (+ history): ${n} checks passed`);
const SC = await import("../../web-src/smartcam.js");
t("the smart camera sorts photos by code", () => {
  assert.equal(SC.photoKind({ text: "", lines: [] }).kind, "plate");
  assert.equal(SC.photoKind({ text: "Carrefour\nMilk 45.00\nBread 15.00\nTOTAL 60.00 EGP\nVAT 14%", lines: [{ text: "Carrefour" }, { text: "Milk 45.00" }, { text: "Bread 15.00" }, { text: "TOTAL 60.00 EGP" }] }).kind, "receipt");
  assert.equal(SC.photoKind({ text: "فاتورة الكهرباء\nالاستهلاك 320 kwh\nالمبلغ 650 جنيه\nتاريخ الاستحقاق 10/11/2026", lines: [{ text: "a" }, { text: "b" }, { text: "c" }, { text: "d" }] }).kind, "bill");
  assert.equal(SC.photoKind({}, ["6223001234567"]).kind, "barcode");
  assert.equal(SC.photoKind({ text: "出口\n入口\n東京駅", lines: [{ text: "出口" }, { text: "入口" }, { text: "東京駅" }] }, [], "en").kind, "sign");
});
console.log(`v870p3 (+ camera): ${n} checks passed`);
