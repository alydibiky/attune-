// v8.7 the family space (persona 4, idea 13)
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;
import * as F from "../../web-src/family.js";
let n = 0; const t = async (name, f) => { await f(); n++; };
const now = new Date(2026, 9, 28, 12).getTime();

await t("members: one id per name, on every phone", () => {
  let f = F.setMe(F.emptyFamily(), "Ali", now); f = F.addMember(f, "Mama", now).f; f = F.addMember(f, "mama", now).f;
  assert.equal(f.members.length, 2); assert.equal(f.me, "m:ali"); assert.equal(F.addMember(F.emptyFamily(), "Mama", now + 99).m.id, "m:mama");
});
await t("the shopping list: words split, no twins, ticked and cleared (hidden)", () => {
  let f = F.setMe(F.emptyFamily(), "Ali", now);
  const r = F.addItems(f, "milk, bread and eggs", "", now); f = r.f; assert.deepEqual(r.added, ["milk", "bread", "eggs"]);
  assert.deepEqual(F.addItems(f, "Milk", "", now).added, []);
  assert.deepEqual(F.addItems(f, "لبن وعيش", "", now).added, ["لبن", "عيش"]);
  f = F.tickItem(f, f.list[0].id, "", now + 1); f = F.clearDone(f, now + 2);
  assert.equal(F.listNow(f).length, 2); assert.equal(f.list.length, 3);
});
await t("expenses: who owes whom, in the fewest transfers", () => {
  let f = F.setMe(F.emptyFamily(), "Ali", now); for (const x of ["Mona", "Omar"]) f = F.addMember(f, x, now).f;
  f = F.addExpense(f, { amount: 900, what: "groceries", by: "m:ali" }, now);   // 300 each
  f = F.addExpense(f, { amount: 300, what: "gas", by: "m:mona" }, now);        // 100 each
  const { bal, moves } = F.balances(f);
  assert.deepEqual(bal, { "m:ali": 500, "m:mona": -100, "m:omar": -400 });
  assert.deepEqual(moves.map((m) => [m.fromName, m.toName, m.amount]), [["Omar", "Ali", 400], ["Mona", "Ali", 100]]);
  f = F.settlePayment(f, "m:omar", "m:ali", 400, now);
  assert.deepEqual(F.balances(f).moves.map((m) => [m.fromName, m.amount]), [["Mona", 100]]);
  // shared by two only
  let g = F.setMe(F.emptyFamily(), "Ali", now); g = F.addMember(g, "Mona", now).f; g = F.addMember(g, "Omar", now).f;
  g = F.addExpense(g, { amount: 200, by: "m:ali", among: ["m:ali", "m:mona"] }, now);
  assert.deepEqual(F.balances(g).bal, { "m:ali": 100, "m:mona": -100, "m:omar": 0 });
});
await t("the Home box understands the family words", () => {
  assert.deepEqual(F.familyIntent("add milk and bread to the family list"), { kind: "items", text: "milk and bread" });
  assert.deepEqual(F.familyIntent("ضيف لبن وعيش لقايمة البيت"), { kind: "items", text: "لبن وعيش" });
  assert.deepEqual(F.familyIntent("I paid 450 for the family groceries"), { kind: "expense", amount: 450, what: "groceries" });
  assert.deepEqual(F.familyIntent("دفعت ٤٥٠ للبيت خضار"), { kind: "expense", amount: 450, what: "خضار" });
  assert.equal(F.familyIntent("who owes whom?").kind, "show"); assert.equal(F.familyIntent("مين عليه كام؟").kind, "show");
  assert.equal(F.familyIntent("add milk to my list"), null); assert.equal(F.familyIntent("I paid 450 for lunch"), null);
});
await t("a reminder for a parent travels with the family", () => {
  const f = F.addFamilyReminder(F.setMe(F.emptyFamily(), "Ali", now), { who: "Dad", title: "Take the pills", at: now + 3600e3, repeat: "daily" }, now);
  assert.equal(f.reminders[0].for, "m:dad"); assert.equal(f.reminders[0].by, "m:ali"); assert.ok(f.members.some((m) => m.name === "Dad"));
});
await t("the family file: locked with the family code, merged item by item on the other phone", async () => {
  let a = F.setMe(F.emptyFamily(), "Ali", now); a = F.addItems(a, "milk", "", now).f;
  let b = F.setMe(F.emptyFamily(), "Mona", now); b = F.addItems(b, "rice", "", now).f; b = F.addExpense(b, { amount: 100, by: "m:mona" }, now);
  const file = await F.packFamily(a, "family-code-1", { iterations: 1000 });
  await assert.rejects(F.takeFamily(b, file, "wrong"), /Wrong family code/);
  const m = await F.takeFamily(b, file, "family-code-1");
  assert.equal(m.me, "m:mona"); assert.deepEqual(F.listNow(m).map((x) => x.what).sort(), ["milk", "rice"]); assert.equal(m.members.length, 2); assert.equal(m.expenses.length, 1);
  // a tick on one phone wins over the older unticked copy
  const a2 = F.tickItem(a, a.list[0].id, "", now + 5000), m2 = await F.takeFamily(m, await F.packFamily(a2, "family-code-1", { iterations: 1000 }), "family-code-1");
  assert.equal(m2.list.find((x) => x.what === "milk").done, true);
});
import * as D from "../../web-src/doit.js";
await t("the Home box: family words become family actions", () => {
  const fam = F.setMe(F.emptyFamily(), "Ali", now);
  let u = D.understand("add milk and bread to the family list", { now, stores: { family: fam } });
  assert.equal(u.actions[0].kind, "family");
  let r = D.apply(u.actions[0], { family: fam }, { now }); assert.match(r.done.en, /On the family list: milk, bread/); assert.equal(r.open, "family");
  const f2 = r.stores["attune:family:v1"];
  r = D.apply(D.understand("I paid 450 for the family groceries", { now, stores: { family: f2 } }).actions[0], { family: f2 }, { now });
  assert.equal(r.stores["attune:family:v1"].expenses[0].amount, 450);
  assert.match(D.understand("who owes whom?", { now, stores: { family: f2 } }).ask.en, /List: milk, bread/);
  assert.match(D.apply(u.actions[0], {}, { now }).done.en, /Start the family space first/);
});
console.log(`v870family: ${n} checks passed`);
