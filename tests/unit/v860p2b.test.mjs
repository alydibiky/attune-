// Persona 2 redone hands-on (an Egyptian's week in Arabic on Home, 28 Oct 2026).
import assert from "node:assert/strict";
const LS = {}; globalThis.localStorage = { getItem: (k) => LS[k] ?? null, setItem: (k, v) => { LS[k] = String(v); }, removeItem: (k) => delete LS[k] };
const A = await import("../../web-src/actions.js"), M = await import("../../web-src/metro.js"), K = await import("../../web-src/commands.js"), T = await import("../../web-src/translate.js"), L = await import("../../web-src/life.js");
let n = 0; const t = (name, fn) => { fn(); n++; };
const now = Date.parse("2026-10-28T06:33:00");
t("a day of the month alone is a reminder date", () => {
  for (const [q, day, title] of [["فكرني ادفع الكهربا يوم ١٠", "2026-11-10", "ادفع الكهربا"], ["remind me to pay electricity on the 10th", "2026-11-10", "pay electricity"], ["فكرني يوم 31 ادفع الايجار", "2026-10-31", "ادفع الايجار"]]) {
    const r = A.quickAction(q, now); const d = new Date(r.at);
    assert.equal(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, day, q); assert.equal(r.title, title, q);
  }
  assert.equal(A.quickAction("فكرني الساعة ١٠ اكلم ماما", now).title, "اكلم ماما");
});
t("«من المعادي للتحرير» is a Metro route; «من البيت للشغل» is not", () => {
  assert.equal(M.metroAsk("من المعادي للتحرير").to.en, "Sadat");
  assert.equal(M.metroAsk("from maadi to tahrir").from.en, "Maadi");
  assert.equal(M.metroAsk("من البيت للشغل"), null);
});
t("«للإنجليزي» is taken off the text to translate; the phrasebook has it", () => {
  assert.equal(K.stripLang("صباح الخير للإنجليزي"), "صباح الخير");
  assert.equal(T.quickPhrase("صباح الخير", "en"), "Good morning");
});
t("a name keeps its hamza as typed", () => {
  assert.equal(L.parseLife("أحمد عليه ٥٠٠", { now }).person, "أحمد");
});
console.log(`v860p2b: ${n} checks passed`);
const PT = await import("../../web-src/yusr/paytext.js");
t("a bank SMS: the shop after «لدى», never «حسابك …»", () => {
  assert.equal(PT.parsePayment("تم خصم 250.00 جنيه من حسابك بطاقة رقم **1234 لدى كارفور في 28/10", { now }).party, "كارفور");
  assert.equal(PT.parsePayment("You paid EGP 120 at Starbucks on 28/10", { now }).party, "Starbucks");
});
console.log(`v860p2b (with the bank SMS): ${n} checks passed`);
