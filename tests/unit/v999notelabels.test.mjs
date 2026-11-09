// v9.9.11 (Ali picked A1 A2 A4 L: "ask me, I tell it what it is and it understands, so next time it knows" + "make sure it's smart
// and understands anything I type"): the brain behind the questions.
import * as L from "../../web-src/notelabels.js";
import { readNotification, codeSure, fromMoneySource } from "../../web-src/paylog.js";
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const wa = { id: "w1", pkg: "com.whatsapp", app: "WhatsApp", title: "ما يخص المرتبات: Mahmoud 3ashour (Alex Accountant)", text: "غفره بليل ٤٥٠ جنيه+١٠٠جنيه اعاشه", ts: Date.now() };
const wa2 = { ...wa, id: "w2", title: "ما يخص المرتبات (3 messages)", text: "Mahmoud: ابراهيم ٣٠٠" };
const s = L.sourceOf(wa);
ok(s.kind === "chat" && s.name === "ما يخص المرتبات" && L.sourceOf(wa2).key === s.key, "the group is the source (the sender and '(3 messages)' don't split it): " + s.name);
ok(L.sourceOf({ pkg: "com.google.android.apps.messaging", app: "Messages", title: "CIB" }).key === "sms:cib", "an SMS's source is its sender");
const A = (t) => L.readAnswer(t, s);
const want = [
  ["this is the work wages group, it's never my money", "work"], ["ده جروب الشغل بتاع المرتبات مش فلوسي", "work"], ["da group el sho3l", "work"],
  ["not my money", "notmoney"], ["مش فلوسي دول بيتكلموا بس", "notmoney"], ["they're just talking", "notmoney"],
  ["yes it's mine, count it", "mymoney"], ["دي فلوسي سجلها", "mymoney"], ["that's my salary from work", "mymoney"],
  ["CIB is my bank", "bank"], ["ده بنكي", "bank"], ["laptop installment", "bill"], ["ده قسط الموبايل", "bill"],
  ["ignore it", "ignore"], ["مش مهم متعرضهوش", "ignore"], ["just ads", "ads"], ["عروض بس", "ads"], ["it's my talabat orders", "delivery"],
  ["important, always tell me", "important"], ["ignore this group it's not my money", "ignore"],
];
for (const [t, m] of want) { const r = A(t); ok(r && r.kind === "label" && r.meaning === m, `“${t}” → ${m} (${r && (r.meaning || r.kind)})`); }
const who = L.readAnswer("Nada is my wife", L.sourceOf({ pkg: "com.life360.android.safetymapd", app: "Life360", title: "Nada", text: "Nada arrived at Home" }));
ok(who && who.kind === "who" && who.role === "wife", "“Nada is my wife” → her People card (the teaching from v9.9.3)");
const br = L.readAnswer("ده اخويا بيحولي فلوس كل شهر", L.sourceOf({ pkg: "com.whatsapp", app: "WhatsApp", title: "Ahmed Brother" }));
ok(br.kind === "label" && br.meaning === "mymoney" && br.also && br.also.role === "brother", "«ده اخويا بيحولي فلوس كل شهر» → both: his money counts AND Ahmed = your brother");
const unclear = A("hmm the thing from yesterday");
ok(unclear.kind === "ask" && unclear.choices.includes("work"), "not clear → it asks back with choices (never a guess)");
ok(L.readAi('{"meaning": "work"}', s, "x").meaning === "work" && L.readAi('{"meaning": "banana"}', s, "x") === null && L.readAi("no json", s) === null, "the AI's answer must be one of the meanings, else nothing");
ok(/ما يخص المرتبات/.test(L.aiPrompt("whatever", s, wa.text)), "the AI sees the source and an example");
const x = A("this is the work wages group, it's never my money");
ok(/never counted as money/.test(L.understoodLabel(x)) && /المرتبات/.test(L.understoodLabel(x)), "I understood: " + L.understoodLabel(x));
ok(/مش فلوسي|كلام شغل/.test(L.understoodLabel(x, { ar: true })), "…in Egyptian Arabic: " + L.understoodLabel(x, { ar: true }));
let t = L.applyLabel(x, { rules: [], asked: [], skip: [] }, 1000);
ok(L.labelOf(wa2, t).meaning === "work" && L.notMoney(L.labelOf(wa2, t)), "saved: the next message in that group knows it is work talk");
ok(L.asksFrom([wa, wa2], t).length === 0, "…and it is never asked about again");
const fresh = { rules: [], asked: [], skip: [] };
const asks = L.asksFrom([wa, wa2, { id: "c", pkg: "com.cib.mobile", app: "CIB", title: "CIB", text: "credited EGP 450", ts: Date.now() }], fresh, { bankish: (n) => /cib/i.test(n.app) });
ok(asks.length === 1 && asks[0].src.key === s.key, "asks once for the group (two messages = one question); a bank's money is not asked here");
t = L.applyLabel(L.readAnswer("mine", s), t, 2000);
ok(t.rules.filter((r) => r.kind === "label").length === 1 && L.labelOf(wa, t).meaning === "mymoney", "a new answer replaces the old one for the same source");
const list = L.learned(t, { items: [{ id: "p1", kind: "person", name: "Nada", role: "wife", created: 5 }] });
ok(list.length === 2 && list.some((i) => i.type === "who") && list.some((i) => i.type === "label"), "What Attune learned: the label and Nada = wife");
const tu = L.undoLabel(t, L.labelOf(wa, t).id); ok(L.labelOf(wa, tu) === null && L.asksFrom([wa], tu).length === 1, "Undo removes it — and Attune may ask about that group again");
// what a label does in Money
const fam = { id: "f1", pkg: "com.whatsapp", app: "WhatsApp", title: "Ahmed brother", text: "تم تحويل 2000 جنيه ليك على انستاباي", ts: Date.now() };
ok(readNotification(fam, { teach: { rules: [] } }) === null, "a chat is not money by default");
const tm = L.applyLabel(L.readAnswer("yes that's my money", L.sourceOf(fam)), { rules: [] });
const e = readNotification(fam, { teach: tm });
ok(e && e.amount === 2000 && e.trusted && fromMoneySource(e), "…taught “that's my money” → it is read and counts as a money source (still needs a sure reading, ‘the money moved’ and the AI's yes)");
const shop = { id: "s1", pkg: "com.mybusiness.pos", app: "MyPOS", title: "Sale", text: "Payment received 350 EGP from customer", ts: Date.now() };
const e0 = readNotification(shop, { teach: { rules: [] } });
ok(e0 && !codeSure(e0), "an unknown app's money waits for a tap");
const tb = L.applyLabel(L.readAnswer("this is my business wallet", L.sourceOf(shop)), { rules: [] });
const e1 = readNotification(shop, { teach: tb }); ok(e1 && e1.trusted && fromMoneySource(e1) && !fromMoneySource(e0), "…taught “my business wallet” → it is a money source next time");
const tw = L.applyLabel(L.readAnswer("work talk", L.sourceOf(fam)), { rules: [] });
ok(readNotification({ ...fam, text: "credited EGP 450" }, { teach: tw }) === null, "taught “work talk” → never money, whatever it says");
if (fails) { console.log("FAILED " + fails); process.exit(1); } else console.log("ALL PASSED");
