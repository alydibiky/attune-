// Ali, 10 Nov 2026: "a WhatsApp group related to work was talking about money and it was added to my income — what the hell?"
import { readNotification, inbox, isChatApp, fromChats, codeSure, fromMoneySource, judged, readJudge, judgePrompt, autoPick } from "../../web-src/paylog.js";
import { suggestFrom } from "../../web-src/autopilot.js";
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const ali = { id: "wa1", pkg: "com.whatsapp", app: "WhatsApp", title: "ما يخص المرتبات: Mahmoud 3ashour (Alex Accountant)",
  text: "ابراهيم حسن ايام الجراح ٣٠٠\nمن يوم ١٠/٦\nغفره بليل ٤٥٠ جنيه+١٠٠جنيه اعاشه", ts: Date.parse("2026-11-09T15:00:00") };
ok(readNotification(ali) === null, "Ali's WhatsApp wages group message is never read as a payment");
ok(inbox([ali]).length === 0, "…so it never reaches Money's list, nor 'by itself'");
for (const [pkg, app] of [["org.telegram.messenger", "Telegram"], ["com.facebook.orca", "Messenger"], ["org.thoughtcrime.securesms", "Signal"], ["com.whatsapp.w4b", "WhatsApp Business"], ["com.viber.voip", "Viber"]])
  ok(readNotification({ ...ali, id: pkg, pkg, app, text: "تم تحويل 450 جنيه" }) === null, app + ": a chat is never a payment, even «تم تحويل 450 جنيه»");
const bank = { id: "b1", pkg: "com.cib.mobile", app: "CIB", title: "CIB", text: "Your account was credited with EGP 450.00 from Ahmed via InstaPay", ts: ali.ts };
const e = readNotification(bank);
ok(e && e.amount === 450 && e.direction === "in", "a real bank credit is still read (450, money in)");
const sms = { id: "s1", pkg: "com.google.android.apps.messaging", app: "Messages", title: "CIB", text: "تم خصم 300.00 جنيه من حسابك لدى Carrefour", ts: ali.ts };
ok(!isChatApp(sms) && readNotification(sms) && readNotification(sms).direction === "out", "bank SMS (the Messages app) still counts");
const sug = suggestFrom({ ...ali, text: "Netflix 250 EGP paid for the team account" });
ok(!sug || (sug.kind !== "subscription" && sug.kind !== "bank" && sug.kind !== "pay"), "Autopilot: a chat mentioning Netflix 250 is no subscription payment (" + (sug && sug.kind) + ")");
const L = { txns: [{ id: "x1", type: "income", amount: 450, source: "notification", note: "يوم · WhatsApp", evidence: { app: "WhatsApp", from: "ما يخص المرتبات" } },
  { id: "x2", type: "expense", amount: 300, source: "notification", note: "Carrefour · CIB", evidence: { app: "CIB" } }, { id: "x3", type: "income", amount: 900, note: "typed" }] };
ok(fromChats(L).map((t) => t.id).join() === "x1", "the entry already added from WhatsApp is found to offer removing it (the bank one and typed ones are not)");
ok(fromChats(L, ["x1"]).length === 0, "…and once kept, it isn't asked again");
// v9.9.10 (Ali: "an AI model should assess the notifications … it should have asked me before it was added if it was not sure")
const cib = readNotification(bank);
ok(codeSure(cib) && fromMoneySource(cib), "CIB 'credited with EGP 450 … via InstaPay' is sure by code (a bank app + 'credited')");
const odd = readNotification({ id: "o1", pkg: "com.example.notes", app: "Notes", title: "Reminder", text: "received 450 EGP from Ahmed", ts: ali.ts });
ok(!odd || !codeSure(odd), "the same words from a notes app is not sure (not a money source) → waits for a tap");
const person = readNotification({ id: "p1", pkg: "com.google.android.apps.messaging", app: "Messages", title: "+201001234567", text: "حولت لك 450 جنيه", ts: ali.ts });
ok(!person || !codeSure(person), "an SMS from a person's number is not sure → waits (only a bank / wallet sender counts)");
ok(autoPick([cib, ...(odd ? [odd] : [])]).length === 1, "by itself: only the bank one");
const yes = async () => '{"payment": true, "direction": "in", "amount": 450}', no = async () => '{"payment": false, "direction": "", "amount": 0}',
  wrong = async () => '{"payment": true, "direction": "in", "amount": 4500}', junk = async () => "I think it might be";
(async () => {
  let r = await judged([cib], yes); ok(r.add.length === 1 && !r.wait.length, "the model agrees (in, 450) → added by itself");
  r = await judged([cib], no); ok(!r.add.length && r.wait[0].doubt === "no", "the model says it isn't a payment → waits, marked 'Attune thinks this isn't a payment'");
  r = await judged([cib], wrong); ok(!r.add.length && r.wait[0].doubt === "unsure", "the model reads another amount (4,500) → waits (never a guess)");
  r = await judged([cib], junk); ok(!r.add.length && r.wait[0].doubt === "unsure", "no clear answer → waits");
  r = await judged([cib], async () => { throw new Error("busy"); }); ok(!r.add.length, "the model fails → waits");
  r = await judged([cib], null); ok(r.add.length === 1, "no model loaded → the strict code rule alone (a bank message that says the money moved)");
  ok(/ALREADY moved/.test(judgePrompt(cib)) && judgePrompt(cib).includes("CIB"), "the model is told what a payment is and what isn't (chats about money, offers, reminders…)");
  if (fails) { console.log("FAILED " + fails); process.exit(1); } else console.log("ALL PASSED");
})();
