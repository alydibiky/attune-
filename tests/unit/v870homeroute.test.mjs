// v8.7 the Home router (persona 8 M-C): a tiny naive-Bayes model, measured on sentences it never saw
import assert from "node:assert/strict";
import { train, route, grams, KINDS } from "../../web-src/homeroute.js";
let n = 0; const t = (name, f) => { f(); n++; };
const M = train();
const HELD = [
  ["spent 350 on dinner", "money"], ["paid the electricity 600", "money"], ["صرفت 120 على البنزين", "money"], ["talabat 230", "money"],
  ["ate a chicken sandwich", "food"], ["كلت سندوتش فول", "food"], ["lunch was pasta with salad", "food"],
  ["remind me to call the bank at 3", "reminder"], ["فكرني اشتري عيش", "reminder"], ["wake me up at 6", "reminder"],
  ["blood pressure 135/90", "health"], ["السكر 180 بعد الاكل", "health"], ["slept 5 hours", "health"],
  ["translate how are you to italian", "translate"], ["ترجم شكرا بالفرنساوي", "translate"],
  ["open the map", "open"], ["افتح المترو", "open"],
  ["what is the tallest building in the world", "question"], ["اكتبلي رسالة اعتذار", "question"], ["how do i learn python fast", "question"],
  ["i need to renew my license", "todo"],
];
t("it routes sentences it never saw (≥ 85 %)", () => {
  const miss = HELD.filter(([s, k]) => route(M, s).kind !== k);
  const acc = 1 - miss.length / HELD.length;
  console.log(`  held-out accuracy ${(acc * 100).toFixed(0)}% (${HELD.length - miss.length}/${HELD.length})${miss.length ? " — missed: " + miss.map(([s, k]) => `${s} → ${route(M, s).kind} (want ${k})`).join("; ") : ""}`);
  assert.ok(acc >= 0.85);
});
t("it learns from the person's choice", () => {
  const s = "zawed el gym 3 marat", before = route(M, s).kind;
  const M2 = train(undefined, [{ text: "zawed el gym 3 marat", kind: "todo" }, { text: "zawed el reading", kind: "todo" }]);
  assert.equal(route(M2, s).kind, "todo", `before: ${before}`);
});
t("fast: 1,000 sentences in well under a second", () => {
  const t0 = Date.now(); for (let i = 0; i < 1000; i++) route(M, HELD[i % HELD.length][0]); assert.ok(Date.now() - t0 < 800, `${Date.now() - t0} ms`);
});
t("numbers and Arabic forms are folded", () => { assert.ok(grams("صرفت ٢٠٠").includes("w:0")); assert.ok(grams("أكلت").includes("w:اكلت")); assert.equal(KINDS.length, 8); });
console.log(`v870homeroute: ${n} checks passed`);
