// Ali's answers (28 Oct): persona 1's "still open" list.
import assert from "node:assert/strict";
const LS = {}; globalThis.localStorage = { getItem: (k) => LS[k] ?? null, setItem: (k, v) => { LS[k] = String(v); }, removeItem: (k) => delete LS[k] };
LS["attune:country"] = "eg";
const D = await import("../../web-src/doit.js"), L = await import("../../web-src/life.js"), Y = await import("../../web-src/yusr/logtext.js");
let n = 0; const t = (name, fn) => { fn(); n++; };
const now = Date.parse("2026-10-28T10:00:00");
const st = () => ({ ledger: null, life: { items: [] }, fit: { days: {} }, radar: { items: [] }, care: { members: [], meds: [], labs: [], taken: {} }, reminders: [], memory: [] });
const one = (q) => D.understand(q, { now, stores: st() }).actions[0] || {};
t("blood pressure", () => {
  assert.deepEqual([one("my blood pressure 120/80").sys, one("my blood pressure 120/80").dia], [120, 80]);
  assert.equal(one("ضغطي ١٤٥/٩٥").kind, "bp"); assert.equal(one("bp 135 over 85 pulse 72").pulse, 72);
  const r = D.apply(one("ضغطي 185/110"), st(), { now }); assert.match(r.done.en, /very high/); assert.equal(r.stores["attune:care:v1"].labs[0].value2, 110);
});
t("sleep", () => {
  assert.equal(one("slept 7 hours").minutes, 420); assert.equal(one("نمت ٦ ساعات ونص").minutes, 390);
  assert.notEqual(one("I need to sleep early").kind, "sleep");
  const r = D.apply(one("slept 7 hours"), st(), { now }); assert.equal(Object.values(r.stores["attune:fit:v1"].days)[0].sleep, 420);
});
t("bank loans", () => {
  const c = L.chatLifeIntent("I took a loan of 60000 from CIB for 24 months", { now });
  assert.deepEqual([c.person, c.dir, c.count, c.total], ["CIB", "out", 24, 60000]);
  assert.equal(L.chatLifeIntent("اخدت قرض ١٠٠ الف من البنك على ٣ سنين", { now }).count, 36);
});
t("typos, a negative amount, filler words", () => {
  const a = one("spnt 200 on lunh"); assert.equal(a.kind, "money"); assert.equal(a.items[0].cat, "food");
  assert.equal(Y.readLocal("spent -50 on taxi", { today: "2026-10-28" }).items[0].note, "taxi");
  assert.equal(Y.readLocal("last friday doctor 300", { today: "2026-10-28" }).items[0].note, "doctor");
  assert.equal(Y.readLocal("da3et 3ala el akl 120", { today: "2026-10-28" }).items[0].cat, "food");
});
console.log(`v870p1: ${n} checks passed`);
const AF = await import("../../web-src/answerfix.js");
t("P8 M-A stop-gap: formal → Egyptian words when the person wrote Egyptian", () => {
  assert.equal(AF.writesEgyptian("انا زهقان ومش عارف اعمل ايه"), true); assert.equal(AF.writesEgyptian("ما هي عاصمة اليابان؟"), false);
  assert.equal(AF.egyptianize("لماذا لا تجرب المشي الآن؟ وسوف يكون هذا جيد. قال «لماذا»"), "ليه لا تجرب المشي دلوقتي؟ وهيكون ده كويس. قال «لماذا»");
});
console.log(`v870p1 (+P8): ${n} checks passed`);
t("voice: what's left today, by code", () => {
  const s0 = st(); s0.fit = { days: { [new Date(now).toISOString().slice(0, 10)]: { meals: { lunch: [{ kcal: 700 }] } } }, goal: 2000 };
  const u = D.understand("what's left today?", { now, stores: s0 }); assert.equal(u.ask.kind, "today"); assert.match(u.ask.en, /700 of 2,000 kcal eaten — 1,300 left/);
  assert.equal(D.understand("ايه اللي فاضل النهارده؟", { now, stores: st() }).ask.kind, "today");
});
console.log(`v870p1 (+ voice day): ${n} checks passed`);
