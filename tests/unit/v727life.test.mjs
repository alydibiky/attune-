// v6.27: the Life layer — sentences in English, formal Arabic and Egyptian Arabic read by code into commitments.
// The roadmap asks for ~500 real sentences per language over time; this is the starting set — add every sentence that fails.
import { parseLife, amountsIn, scheduleOf, progressOf, tickEntry } from "../../web-src/life.js";
let fail = 0, n = 0; const ok = (c, w) => { n++; if (!c) { console.log("FAIL " + w); fail++; } };
const now = new Date("2026-10-13T12:00:00").getTime();
const P = (s) => parseLife(s, { now, currency: "EGP" });   // Ali's own currency (the default is now the person's region)
const want = (s, exp) => { const r = P(s); const bad = r ? Object.entries(exp).filter(([k, v]) => JSON.stringify(r[k]) !== JSON.stringify(v)) : [["null", "null"]];
  ok(!bad.length, `«${s}» → ${JSON.stringify(r && { kind: r.kind, person: r.person, dir: r.dir, amount: r.amount, count: r.count, total: r.total, every: r.every, start: r.start, myTurn: r.myTurn, currency: r.currency })}  wanted ${JSON.stringify(exp)}`); };

// amounts
ok(JSON.stringify(amountsIn("12 ألف").map((a) => a.value)) === "[12000]", "12 ألف"); ok(amountsIn("١٢٠٠٠")[0].value === 12000, "Arabic digits");
ok(amountsIn("1.5k")[0].value === 1500, "1.5k"); ok(amountsIn("ألفين في الشهر")[0].value === 2000, "ألفين"); ok(amountsIn("12,000 and 1,000").map((a) => a.value).join() === "12000,1000", "commas");

// ---- Ali's example, every way it is said ----
const AHMED = { kind: "installment", person: "Ahmed", dir: "in", amount: 1000, count: 12, total: 12000, every: "month" };
want("Ahmed owes me 12,000, 1,000 a month for a year", AHMED);
want("Ahmed will pay me 12000 in 12 monthly installments", AHMED);
want("Ahmed owes me 12k, paying 1k every month", AHMED);
want("Ahmed owes me 12000 over 12 months", AHMED);
want("أحمد عليه 12 ألف، ألف كل شهر لمدة سنة", { ...AHMED, person: "أحمد" });
want("احمد هيدفعلي ١٢٠٠٠ على ١٢ قسط", { ...AHMED, person: "احمد" });
want("أحمد عليه ١٢ الف يدفعهم ألف كل شهر", { ...AHMED, person: "أحمد" });
want("احمد سيدفع 12000 على 12 دفعة شهرية", { ...AHMED, person: "احمد" });
want("Ahmed owes me 12,000, 1,000 a month starting November", { ...AHMED, start: "2026-11-01" });
want("Ahmed pays me 1,000 a month for a year", AHMED);
want("احمد هيدفعلي الف كل شهر لمدة سنة", { ...AHMED, person: "احمد" });
want("Mona will pay me 600 a month for 6 months", { kind: "installment", person: "Mona", dir: "in", amount: 600, count: 6, total: 3600 });
want("احمد عليه 12 الف، الف كل شهر من اول نوفمبر", { ...AHMED, person: "احمد", start: "2026-11-01" });
// ---- one sum between people ----
want("I lent Sara 500", { kind: "debt", person: "Sara", dir: "in", amount: 500 });
want("Omar owes me 2000", { kind: "debt", person: "Omar", dir: "in", amount: 2000 });
want("I owe Omar 300", { kind: "debt", person: "Omar", dir: "out", amount: 300 });
want("I borrowed 2000 from Omar", { kind: "debt", person: "Omar", dir: "out", amount: 2000 });
want("سلفت سارة ٥٠٠", { kind: "debt", person: "سارة", dir: "in", amount: 500 });
want("عليا لعمر 300", { kind: "debt", person: "عمر", dir: "out", amount: 300 });
want("استلفت من عمر 2000", { kind: "debt", person: "عمر", dir: "out", amount: 2000 });
want("محمد عليه 750 جنيه", { kind: "debt", person: "محمد", dir: "in", amount: 750 });
want("اقرضت خالد 5000", { kind: "debt", person: "خالد", dir: "in", amount: 5000 });
want("Lent Karim $200", { kind: "debt", person: "Karim", dir: "in", amount: 200, currency: "USD" });
// ---- savings circles, by their local names ----
want("جمعية ٢٠٠٠ في الشهر لمدة ١٠ شهور ودوري الرابع", { kind: "circle", amount: 2000, count: 10, total: 20000, every: "month", myTurn: 4 });
want("جمعيه 1000 كل شهر 12 شهر وبقبض الشهر التالت", { kind: "circle", amount: 1000, count: 12, myTurn: 3 });
want("Savings circle: 2000 a month for 10 months, my turn is month 4", { kind: "circle", amount: 2000, count: 10, myTurn: 4 });
want("Tanda of 500 weekly, 8 payments, my turn is 2", { kind: "circle", amount: 500, count: 8, every: "week", myTurn: 2 });
want("Chit fund 5000 monthly for 20 months", { kind: "circle", amount: 5000, count: 20 });
// ---- bills, rent, subscriptions ----
want("Netflix 200 every month", { kind: "subscription", amount: 200, every: "month" });
want("اشتراك نتفليكس ٢٠٠ كل شهر", { kind: "subscription", amount: 200, every: "month" });
want("Gym 900 monthly", { kind: "subscription", amount: 900, every: "month" });
want("Rent 8000 monthly on the 5th", { kind: "rent", dir: "out", amount: 8000, every: "month", start: "2026-11-05" });
want("الإيجار ٨٠٠٠ شهريا يوم ٥", { kind: "rent", amount: 8000, every: "month", start: "2026-11-05" });
want("Electricity bill 640 due Thursday", { kind: "bill", amount: 640, every: null, start: "2026-10-15" });
want("فاتورة الكهربا ٦٤٠ يوم الخميس", { kind: "bill", amount: 640, start: "2026-10-15", title: "فاتورة الكهربا" });
want("Electricity bill 640 due Thursday", { title: "Electricity bill" });
want("اشتراك نتفليكس ٢٠٠ كل شهر", { title: "اشتراك نتفليكس" });
want("Internet 450 every month on the 1st", { kind: "bill", amount: 450, every: "month", start: "2026-11-01" });
want("فاتورة النت ٤٥٠ كل شهر", { kind: "bill", amount: 450, every: "month" });
// ---- my own installments ----
want("Car installment 6500 a month for 36 months", { kind: "installment", dir: "out", amount: 6500, count: 36, every: "month" });
want("قسط العربية ٦٥٠٠ كل شهر لمدة ٣٦ شهر", { kind: "installment", dir: "out", amount: 6500, count: 36 });
want("Phone 24000 in 12 installments", { kind: "installment", dir: "out", amount: 2000, count: 12 });
// ---- not a commitment: left to the model / the rest of the app ----
for (const s of ["What is the weather tomorrow?", "ازيك عامل ايه", "remind me to call mom", "Ahmed is my friend"]) ok(P(s) === null, `«${s}» is not a commitment`);

// ---- schedule, ticks, Money ----
const c = { ...P("Ahmed owes me 12,000, 1,000 a month starting November"), paid: [0, 1, 2] };
const s = scheduleOf(c, now);
ok(s.length === 12 && s[0].date === "2026-11-01" && s[11].date === "2027-10-01", "12 monthly checkboxes from 1 Nov: " + s[0].date + " … " + s[11].date);
const pr = progressOf(c, now);
ok(pr.paidCount === 3 && pr.left === 9000 && pr.next.i === 3, "3 paid → 9,000 left, the 4th is next");
const e = tickEntry(c, 3, now);
ok(e.direction === "in" && e.amount === 1000 && e.party === "Ahmed" && /installment 4 of 12/.test(e.note), "a tick = +1,000 in Money: " + JSON.stringify(e));
const cc = P("جمعية ٢٠٠٠ في الشهر لمدة ١٠ شهور ودوري الرابع");
ok(tickEntry(cc, 0, now).direction === "out", "paying into a savings circle is money out");

// ---- the store, ticks → Money, due soon, the model fallback ----
const L = await import("../../web-src/life.js");
let d = L.addCommitment({ v: 1, items: [] }, P("Ahmed owes me 12,000, 1,000 a month starting November"), now);
const id = d.items[0].id;
d = L.togglePaid(d, id, 0); d = L.togglePaid(d, id, 1); d = L.togglePaid(d, id, 1);
ok(JSON.stringify(d.items[0].paid) === "[0]", "a tick, and a tick undone");
ok(L.tickText(d.items[0], 1, now) === "Received 1,000 EGP from Ahmed — installment 2 of 12", "the sentence Money reads: " + L.tickText(d.items[0], 1, now));
const soon = L.dueSoon(L.addCommitment({ v: 1, items: [] }, P("فاتورة الكهربا ٦٤٠ يوم الخميس"), now), now, 7);
ok(soon.length === 1 && soon[0].date === "2026-10-15" && !soon[0].late, "due this week: the electricity bill on Thursday");
const mem = {}; const store = { getItem: (k) => mem[k] || null, setItem: (k, v) => { mem[k] = v; } };
L.saveLife(d, store); ok(L.loadLife(store).items.length === 1, "saved and read back");
const r = L.readLifeModel('ok {"kind":"installment","person":"Hana","dir":"in","amount":250,"count":8,"every":"week","start":"2026-10-20"}');
ok(r && r.kind === "installment" && r.total === 2000 && r.every === "week" && r.model, "the model's JSON → the same fields");
ok(L.readLifeModel('{"kind":"lottery","amount":5}') === null, "anything outside the fixed kinds is dropped");
// ---- reminders: one per commitment, for its next unpaid payment ----
{ const c0 = { ...P("Ahmed owes me 12,000, 1,000 a month starting November"), id: "z", paid: [0] };
  const r = L.nextReminder(c0, now);
  ok(r && r.id === "life-z" && new Date(r.at).toISOString().slice(0, 10) === "2026-12-01" && /installment 2 of 12/.test(r.title) && /1,000 EGP/.test(r.body), "the reminder is for the next unpaid one (2 of 12, 1 Dec): " + JSON.stringify(r));
  ok(L.nextReminder({ ...c0, paid: [...Array(12).keys()] }, now) === null, "all paid → no reminder"); }
// ---- Chat: statements are saved, questions stay in Chat ----
for (const q of ["Ahmed owes me 12,000, 1,000 a month for a year", "جمعية ٢٠٠٠ في الشهر لمدة ١٠ شهور ودوري الرابع", "Netflix 200 every month", "I lent Sara 500"]) ok(L.chatLifeIntent(q, { now }), `Chat «${q}» → People & plans`);
for (const q of ["Crane hire 25000 each day, the 1st to the 5th both included. Give me the rent and the rent with the 14 tax added.", "The rent here is 8000", "احسب قسط ١٢٠٠٠ على ١٢ شهر", "How much does Ahmed owe me?", "كام عليه احمد؟", "What is 12000 / 12", "should I lend Omar 2000", "Write a poem about rent"]) ok(!L.chatLifeIntent(q, { now }), `Chat «${q}» stays in Chat`);
console.log(fail ? `${fail} of ${n} FAILED` : `v727life ok (${n} checks)`);
process.exit(fail ? 1 : 0);
