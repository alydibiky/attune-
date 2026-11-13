// v9.8 I1 Autopilot (Ali: "I1 ok"): each notification becomes one suggestion; nothing twice; asks after 3; "Not this" teaches it
globalThis.localStorage = { _: {}, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = String(v); }, removeItem(k) { delete this._[k]; } };
import assert from "node:assert/strict";
const AP = await import("../../web-src/autopilot.js");
const now = Date.parse("2026-11-07T10:00:00"), H = 3600e3;   // a Saturday
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const notes = [
  { id: 1, pkg: "com.cib.mobile", app: "CIB", title: "Card transaction", text: "Your card ending 4421 was debited EGP 1,250.00 at CARREFOUR MAADI", ts: now - H },
  { id: 2, pkg: "com.google.android.apps.messaging", app: "Messages", title: "CIB", text: "Your card ending 4421 was debited EGP 1,250.00 at CARREFOUR MAADI", ts: now - H + 20000 },
  { id: 3, pkg: "com.amazon.mShop.android.shopping", app: "Amazon Shopping", title: "Shipped", text: "Arriving Thursday · your Anker charger", ts: now - 2 * H },
  { id: 4, pkg: "com.whatsapp", app: "WhatsApp", title: "Ahmed Salah 012 (Dayı)", text: "ابعتلي الورق بكرة", ts: now - 3 * H },
  { id: 5, pkg: "com.google.android.dialer", app: "Phone", title: "Missed call", text: "Mona", ts: now - 4 * H },
  { id: 6, pkg: "com.google.android.dialer", app: "Phone", title: "Missed call", text: "Mona", ts: now - 5 * H },
  { id: 7, pkg: "com.vodafone.selfservis", app: "Ana Vodafone", title: "Bill due", text: "Your bill of EGP 450 is due on 15th", ts: now - 6 * H },
  { id: 8, pkg: "com.jumia.android", app: "Jumia", title: "50% off", text: "Mega sale today only", ts: now - 7 * H },
  { id: 9, pkg: "com.whatsapp", app: "WhatsApp", title: "Mama", text: "ربنا يحفظك", ts: now - 8 * H },
];
const s0 = AP.emptyState(), list = AP.suggestions(notes, { now, s: s0 });
const by = (k) => list.filter((x) => x.kind === k);
ok(by("expense").length === 0, "v9.9.30: the CIB debit (card ending 4421 debited) is sure — Money adds it by itself, no card on Home asking for a tap");
const ex = { kind: "expense", app: "Wallet X", amount: 1250, cat: "groceries", note: "CARREFOUR MAADI", date: "2026-11-07", key: "x:125000:2026-11-07" };
ok(!AP.isAuto(s0, ex), "a money card Attune is NOT sure of still waits for a tap");
ok(by("followup").length === 1 && new Date(by("followup")[0].at).getDay() === 4, "Amazon 'Arriving Thursday' → a follow-up on Thursday");
ok(by("todo").length === 1 && new Date(by("todo")[0].at).getDate() === 8 && /^Ahmed Salah: /.test(by("todo")[0].title), "Ahmed «ابعتلي الورق بكرة» → a to-do tomorrow");
ok(by("callback").length === 1 && by("callback")[0].who === "Mona", "two missed calls from Mona → call back");
ok(by("bill").length === 1 && by("bill")[0].amount === 450 && new Date(by("bill")[0].at).getDate() === 15, "Vodafone bill due on the 15th → a bill");
ok(list.length === 4, "the offer and «ربنا يحفظك» are nothing to do");
ok(["followup", "todo", "callback", "bill"].every((k) => AP.isAuto(s0, by(k)[0])), "v9.9.30 (Ali: \"not keep asking\"): a delivery's day, a request, two missed calls, a bill due — done by itself from the start");
{ let u = AP.accept(s0, by("followup")[0], { auto: true }); u = AP.undoDone(u, by("followup")[0].key);
  ok(!AP.isAuto(u, by("followup")[0]) && u.manual.includes("followup:Amazon Shopping"), "Undo on one → that kind from that app waits for a tap from now on"); }
ok(AP.suggestions(notes, { now, s: s0, ledger: { txns: [{ type: "expense", amount: 1250, date: "2026-11-07" }] } }).filter((x) => x.kind === "expense").length === 0, "typed by hand already → not suggested again");
// accept 3 CIB expenses → asks once
let s = s0; for (let i = 0; i < 3; i++) s = AP.accept(s, { kind: "expense", app: "CIB", key: "x:" + i, amount: 10 });
ok(s.ask === "expense:CIB", "after 3 CIB expenses it asks 'do these by yourself?'");
s = AP.allow(s, "expense:CIB", true); ok(s.always.includes("expense:CIB") && !s.ask, "yes → done by itself from now on");
s = AP.accept(s, { kind: "expense", app: "CIB", key: "x:9", amount: 5, title: "x" }, { auto: true });
ok(s.done[0].key === "x:9", "a thing done by itself is listed with Undo"); s = AP.undoDone(s, "x:9"); ok(!s.ok["x:9"] && s.no["x:9"] && !s.done.length, "Undo takes it back and never suggests it again");
// Not this — for that app
const s2 = AP.refuse(s0, by("followup")[0], { app: true });
ok(AP.suggestions(notes, { now, s: s2 }).every((x) => x.kind !== "followup"), "'Not this' for Amazon deliveries → never again");
// delivered closes the follow-up
const s3 = AP.accept(s0, { ...by("followup")[0] }, { rid: "rem-77" });
ok(AP.deliveredDone([{ id: 20, pkg: "com.amazon.mShop.android.shopping", app: "Amazon Shopping", title: "Delivered", text: "Your package was delivered", ts: now }], s3).join() === "rem-77", "'Delivered' closes the delivery follow-up");
ok(AP.actionsFor(ex)[0].kind === "money" && AP.actionsFor(by("todo")[0])[0].kind === "reminder" && AP.actionsFor(by("bill")[0])[0].c.kind === "bill", "each becomes what the Home box would save");
ok(AP.weekCount(s, now) >= 3, "the week's count");
console.log(`ALL PASSED v980autopilot (${n} checks)`);
