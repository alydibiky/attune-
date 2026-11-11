// v9.9.15 (Ali, 10 Nov 2026: "test 10000 scenarios of everything you can write in chat" + his four phone problems). Every mistake the
// run found — and the Follow-ups crash — with the sentence that showed it, so none can come back.
const mem = {}; globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const { understand, doSure } = await import("../../web-src/doit.js");
const { parseLife } = await import("../../web-src/life.js");
const { parsePayment } = await import("../../web-src/yusr/paytext.js");
const { quickAction, looksLikeAction } = await import("../../web-src/actions.js");
const { looksLikeCalc, calculate } = await import("../../web-src/calc.js");
const { parseAgent, withAnswer } = await import("../../web-src/agents.js");
const { parseListCommand, applyListCommand } = await import("../../web-src/lists.js");
const { chatDeadlineIntent } = await import("../../web-src/deadlines.js");
const K = await import("../../web-src/commands.js");
const NT = await import("../../web-src/noteteach.js");
const NL = await import("../../web-src/notelabels.js");
const B = await import("../../web-src/billing.js");
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const now = Date.parse("2026-11-10T12:00:00"), U = (s) => understand(s, { now, stores: {} }), kinds = (s) => (U(s).actions || []).map((a) => a.kind).join(",");
const PA = (s) => parseAgent(s, { now, country: "EG", usual: {}, prefs: {} });
const tr = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (v || {})[k]);

// 1 · the Follow-ups crash ("Cannot read properties of null (reading '1')"): a People card whose role is not one of the known ones
ok(NT.understood({ kind: "who", name: "Reda", role: "sheikh" }, { tr }) === "Reda = sheikh" && NT.understood({ kind: "who", name: "رضا", role: "الشيخ" }, { ar: true, tr }) === "رضا = الشيخ", "What Attune learned: a person with any role is shown, never a crash");
ok(NT.understood({ kind: "who", name: "Nada", role: "wife" }, { tr }) === "Nada = your wife", "…a known role still reads “your wife”");
ok(NL.understoodLabel({ kind: "label", src: { kind: "app", name: "X", app: "X" }, meaning: "old-meaning" }, { tr }).includes("old-meaning"), "…a label with a meaning this version doesn't know shows its word");
ok(NL.learned({ rules: [] }, { items: [{ id: "p1", kind: "person", name: "Reda", role: "driver" }] }).length === 1, "…and that person is still on the list");

// 4 · Plans & billing says only what today's app has
const billing = JSON.stringify([B.PRO_BENEFITS, B.BILLING_GROUPS, B.COMPARE_ROWS]);
ok(!/Studio|Fit & Food|photo meals|Business systems|records a table/i.test(billing), "Plans & billing: no Studio, Fit & Food or Business");
ok(B.COMPARE_ROWS.every((r) => r.length === 3), "…the comparison is Free and Pro only");

// the 10,000-sentence run — amounts
for (const [s, a] of [["spent 2k on rent", 2000], ["received 3k from Sara", 3000], ["paid 1.5k for the gym", 1500], ["spent 2 thousand on rent", 2000], ["دفعت 3 الاف ايجار", 3000]]) { const p = parsePayment(s, { now }); ok(p.ok && p.amount === a, "«" + s + "» → " + a + ": " + p.amount); }
ok(!parsePayment("ارخص طيارة من القاهرة لجدة يوم 20 ديسمبر", { now }).ok, "«… يوم 20 ديسمبر» — a date is not a payment of 20");
// borrowed / lent in Egyptian Arabic
for (const [s, dir, who, a] of [["استلفت 700 من كريم", "out", "كريم", 700], ["صاحبي علي استلف مني 450", "in", "علي", 450], ["ماما استلفت مني 850", "in", "ماما", 850], ["استلفت ٧٠٠ جنيه من احمد", "out", "احمد", 700]]) {
  const c = parseLife(s, { now }) || {}; ok(c.kind === "debt" && c.dir === dir && c.person === who && c.amount === a, "«" + s + "» → a debt, " + dir + ", " + who + ", " + a + ": " + [c.kind, c.dir, c.person, c.amount]); }
// reminders
for (const [s, title] of [["reminder to book the dentist in 20 minutes", "book the dentist"], ["set a reminder tomorrow at 9: send the report", "send the report"], ["نبهني كمان 20 دقيقة اسقي الزرع", "اسقي الزرع"], ["نبهني الاثنين الجاي الساعة 10 اخد الدوا", "اخد الدوا"], ["don't let me forget to buy bread tonight at 8", "buy bread"]]) {
  const a = quickAction(s, now) || {}; ok(looksLikeAction(s) && a.kind === "reminder" && a.title === title, "«" + s + "» → a reminder “" + title + "”: " + a.kind + " “" + a.title + "”"); }
ok(looksLikeAction("set an alarm for 6 am") && looksLikeAction("wake me at 7") && looksLikeAction("start a timer for 10 minutes"), "alarms, wake-ups and timers are still read");
// never money: a time, a count, a code, a request, a search
for (const s of ["reminder to book the dentist in 20 minutes", "the code is 4821", "we are 4 people", "give me 5 ideas for a birthday gift", "watch the price of iphone 16", "page 120 of the book is missing", "I ran 5 km this morning", "he is 25 years old", "عمري 21 سنة", "الدور 5 شقة 12"])
  ok(!kinds(s).includes("money"), "«" + s + "» is not money: " + (kinds(s) || "chat"));
// C3 / C2 (Ali's picks, 11 Nov): a payment for a later day is a one-time payment due that day — asked about on the day, never an expense now
{ const a = (U("I will pay Ahmed 4500 next week").actions || [])[0] || {}, c = a.c || {};
  ok(a.kind === "life" && c.kind === "bill" && c.dir === "out" && c.amount === 4500 && c.count === 1 && c.title === "Pay Ahmed" && c.start > "2026-11-10", "“I will pay Ahmed 4500 next week” → a payment due next week (Pay Ahmed · 4,500): " + JSON.stringify([a.kind, c.kind, c.title, c.start]));
  const b = ((U("pay the electricity bill 320 on Friday").actions || [])[0] || {}).c || {};
  ok(b.kind === "bill" && b.amount === 320 && b.start === "2026-11-13" && /^Electricity bill$/i.test(b.title), "“pay the electricity bill 320 on Friday” → Electricity bill · 320 · due Friday: " + JSON.stringify([b.kind, b.title, b.start]));
  const d = ((U("I should pay 1500 for the course by Sunday").actions || [])[0] || {}).c || {};
  ok(d.kind === "bill" && d.amount === 1500 && d.title === "Course" && d.start === "2026-11-15", "“I should pay 1500 for the course by Sunday” → Course · 1,500 · Sunday");
  ok(kinds("paid the electricity bill 320") === "money" && kinds("I owe Ahmed 4500, I will pay next week") === "life", "paid already stays money; a debt stays a debt"); }
{ const WT = await import("../../web-src/webtask.js");
  ok(!WT.readWebTask("pay the electricity bill 320 on Friday", now) && !!WT.readWebTask("renew my car licence", now) && !!WT.readWebTask("buy tickets for the concert on Friday", now), "the web task keeps “renew my car licence” and tickets, not a bill with an amount and a day");
  // C1: "buy milk" is a to-do
  ok(!WT.readWebTask("buy milk", now) && PA("buy milk") == null && PA("اشتري لبن") == null && (PA("buy me milk") || {}).kind === "buy" && (PA("buy a PS5 under 20000") || {}).kind === "buy", "“buy milk” is not an agent or a web task; “buy me …” and “buy … under …” are");
  ok(K.guess("buy milk")[0].kind === "todoAdd" && K.todoText("buy milk") === "buy milk" && K.guess("اشتري لبن")[0].kind === "todoAdd", "…it is a to-do: “buy milk”"); }
// U2: dates in words
{ const D = await import("../../web-src/doit.js"); const u = U("my passport expires on 3 March 2027"); const r = D.apply(u.actions[0], {}, { now });
  ok(/3 Mar 2027/.test(r.done.en) && !/2027-03-03/.test(r.done.en + r.done.ar) && /مارس/.test(r.done.ar), "a date reads “3 Mar 2027”, not 2027-03-03: " + r.done.en); }
// still money
for (const [s, a] of [["320 dinner", 320], ["7500 غدا", 7500], ["breakfast 300 cash", 300], ["spent 250 on lunch", 250], ["غدا 150", 150], ["paid 300 for 3 nights at the hotel", 300], ["lunch was 150", 150], ["taxi 85", 85]]) {
  const m = (U(s).actions || []).find((x) => x.kind === "money"); ok(m && m.items.some((x) => x.amount === a), "«" + s + "» → money " + a + ": " + JSON.stringify(m && m.items.map((x) => x.amount))); }
// v9.9.18: a haircut is a known spending now (PAID_FOR) — saved without asking, like "the barber 85"
ok(doSure("lunch 60 and a haircut 85", { now }) === true && kinds("lunch 60 and a haircut 85") === "money", "“lunch 60 and a haircut 85” is read and saved (a haircut is a known spending since v9.9.18)");
// questions for the AI, not answered from Money
for (const s of ["how do I make koshary?", "should I pay 850 for Samsung S24?", "is 120 too much for medicine?", "what did Apple earn in 2023?", "اعمل كشري ازاي؟", "how do I renew my passport?"]) { const u = U(s); ok(u.chat === true && !u.ask, "«" + s + "» goes to the AI: " + JSON.stringify(u).slice(0, 80)); }
for (const s of ["how much did I spend this week?", "who owes me money?", "what are my bills this month?", "صرفت كام الاسبوع ده؟"]) ok(!!U(s).ask, "«" + s + "» is still answered from your own data");
// sums
for (const [s, v] of [["250 - 7", 243], ["what is 2400 times 4?", 9600], ["12 plus 30", 42], ["100 divided by 4", 25], ["50 minus 8", 42]]) ok(looksLikeCalc(s) && calculate(s).value === v, "«" + s + "» = " + v);
ok(!looksLikeCalc("10-12 days") && !looksLikeCalc("12-11-2026"), "a range and a date are not sums");
// agents
ok(PA("اشتري عربية ولا احوش؟") == null && PA("احسن موبايل تحت 20000 ايه؟") == null, "a choice / “best …?” question is not an agent");
ok((PA("اشتريت هدوم ب 650") || {}).kind !== "buy" && (PA("اشتريلي iPhone 16 بأقل من 45000") || {}).kind === "buy", "«اشتريت» (I bought) is not «اشتريلي» (buy for me)");
{ const w = PA("watch the price of a PS5") || {}; ok(w.kind === "watch" && /At what price/.test(w.ask || "") && withAnswer("watch the price of a PS5", w.ask, "20000") === "tell me when a PS5 is under 20000" && (PA("tell me when a PS5 is under 20000") || {}).below === 20000, "“watch the price of a PS5” asks for the price, and the answer makes the watch"); }
// lists and to-dos
{ const c = parseListCommand("add milk and eggs to my shopping list"); ok(c && c.op === "add" && c.name === "shopping" && c.items.join() === "milk,eggs", "“add milk and eggs to my shopping list” → add to Shopping");
  const r1 = applyListCommand({ lists: [] }, c, now), r2 = applyListCommand(r1.st, parseListCommand("add bread to the shopping list"), now);
  ok(r1.list.items.length === 2 && r2.list.items.length === 3 && r2.st.lists.length === 1, "…the list is made the first time and added to after");
  ok(parseListCommand("add buy milk to my to-do list") == null && parseListCommand("ضيف لبن لقايمة السوبر ماركت").op === "add", "…the to-do list stays Mind's; Arabic works"); }
ok(K.guess("show my to-dos")[0].kind === "todoList", "“show my to-dos” shows the list");
// dates
for (const s of ["exam on 12 January", "الامتحان يوم 12 يناير", "الباسبور هيخلص يوم 3 مارس 2027"]) ok(!!chatDeadlineIntent(s, { now, home: "EGP", order: "dmy" }), "«" + s + "» is a date to watch");
