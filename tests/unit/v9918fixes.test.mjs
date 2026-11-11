// v9.9.18 (Ali, 11 Nov 2026: "lets do first 3 things now" — the sentences still read wrong after the 10,000 hard run). Each real
// miss found, fixed in the app's own reader, and kept here so it can't come back. (The full run: bash tests/scenarios/run.sh hard)
const mem = {}; globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
globalThis.window = globalThis.window || { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
const { classify, setCountry } = await import("../scenarios/brain.mjs");
const { understand, doSure } = await import("../../web-src/doit.js");
const { quickAction } = await import("../../web-src/actions.js");
const { francoToArabic } = await import("../../web-src/understand.js");
const { chatLifeIntent, parseLife } = await import("../../web-src/life.js");
const { tripDates, planTask } = await import("../../web-src/agent.js");
const { parseAgent } = await import("../../web-src/agents.js");
const { parseListCommand } = await import("../../web-src/lists.js");
const { pageOf } = await import("../../web-src/applinks.js");
const { typedPayment, numWords } = await import("../../web-src/sense.js");
const { payOpts } = await import("../../web-src/locale.js");
const { looksLikeCalc } = await import("../../web-src/calc.js");
setCountry("EG");
const NOW = Date.parse("2026-11-10T12:00:00");   // a Tuesday
let bad = 0; const ok = (c, t) => { console.log((c ? "PASS " : "FAIL ") + t); if (!c) bad++; };
const k = (s) => classify(s, { now: NOW, both: true }).k;
const amounts = (s) => (understand(s, { now: NOW, stores: {} }).actions || []).flatMap((a) => (a.items || []).map((i) => i.amount));
const pay = (s) => (typedPayment(s, { now: NOW, ...payOpts() }) || {});
const hm = (t) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`; };

// amounts
ok(JSON.stringify(amounts("دفعت 950 الفطار")) === "[950]", "«دفعت 950 الفطار» is 950 — «الفطار» does not start a «الف» (was 950,000)");
ok(pay("دفعت 12 الف").amount === 12000 && pay("دفعت 12 ألف جنيه").amount === 12000, "«دفعت 12 الف» is offered as 12,000 (was 12)");
ok(JSON.stringify(amounts("the laundry 720 + tolls 650").sort()) === "[650,720]" && !looksLikeCalc("the laundry 720 + tolls 650"), "\"the laundry 720 + tolls 650\" is two spendings, not a sum");
ok(looksLikeCalc("250 + 30") && looksLikeCalc("what is 5 + 3"), "a real sum is still a sum");
ok(k("250 squared") === "calc", "\"250 squared\" is a calculation, not 250 spent");
ok(k("the maid comes at 9") !== "money" && k("paid 20 at 9") === "money", "\"the maid comes at 9\" is not 9 spent; \"paid 20 at 9\" is 20");
ok(k("read 21 books before December 2027") !== "money" && k("I read 3 books") !== "money", "a year or a count of books is never money");
// Franco and number words
ok(francoToArabic("dawa b 950 geneh") === "دوا ب 950 جنيه" && k("rakna 110 geneh") === "money" && k("el 7ala2 kan b 3200") === "money", "Franco spending: \"rakna 110 geneh\", \"el 7ala2 kan b 3200\"");
ok(numWords("صرفت مية على تذاكر الاتوبيس") === "صرفت 100 على تذاكر الاتوبيس" && numWords("اشرب مية") === "اشرب مية", "«صرفت مية» is 100; «اشرب مية» stays water");
ok(pay("flowers cost me ten").amount === 10, "\"flowers cost me ten\" is 10");
// short spending lines
for (const s of ["school books (550)", "haircut 1750/-", "diapers - 350", "شاحن جديد 25ج", "تورتة 15ج", "sushi   150  ", "المغسلة 18000 والميكانيكي 2500", "today: lunch 480; the vet 150"]) ok(k(s) === "money", "spending line: «" + s + "»");
ok(JSON.stringify(amounts("فاتورة النت 25 والغدا 1100").sort((a, b) => a - b)) === "[25,1100]" && k("فاتورة النت 25 والغدا 1100") === "money", "«الغدا» (lunch) is not «غدا» (tomorrow): two spendings, not a bill due tomorrow");
// reminders
{ const a = quickAction("set a reminder on 25 December at 8 pm: send Maria the photos", NOW); ok(hm(a.at) === "12/25 20:00", "\"Maria\" is not March (" + hm(a.at) + ")"); }
{ const a = quickAction("wake me in 2 hours to buy bread", NOW); ok(hm(a.at) === "11/10 14:00", "\"wake me in 2 hours\" is in 2 hours, not 2 am (" + hm(a.at) + ")"); }
{ const a = quickAction(francoToArabic("fakarny kaman 20 de2e2a atfy el forn!"), NOW); ok(hm(a.at) === "11/10 12:20" && /الفرن/.test(a.title), "Franco \"fakarny kaman 20 de2e2a atfy el forn!\""); }
{ const a = quickAction(francoToArabic("fakarny enharda el sa3a 8 bel leil akalem Maria"), NOW); ok(hm(a.at) === "11/10 20:00" && !/leil|enharda/.test(a.title), "Franco \"enharda … bel leil\""); }
{ const a = quickAction("cancel my reminder to call the bank", NOW); ok(a.kind === "none" && /Follow-ups/.test(a.problems[0] || ""), "\"cancel my reminder…\" does not make a reminder"); }
// two orders
{ const r = classify("spent 85 on parking, also remind me in an hour and a half to water the plants", { now: NOW, both: true }); ok(r.k === "both" && r.parts.money.includes(85) && hm(r.parts.at) === "11/10 13:30", "English pay + remind: both done"); }
// people and plans
ok(parseLife("uncle Samir lent me 10000").person === "Uncle Samir" && parseLife("my friend Ali owes me 1200").person === "Ali", "\"uncle Samir\" / \"my friend Ali\" keep the name");
{ const c = chatLifeIntent("اديت صاحب البيت 25000 سلف"); ok(c && c.person === "صاحب البيت" && c.dir === "in", "«اديت صاحب البيت 25000 سلف» — the landlord owes me"); }
{ const c = chatLifeIntent("قسط الموبايل 1500 كل شهر على 12 شهر"); ok(c && c.amount === 1500 && c.count === 12, "«1500 كل شهر على 12 شهر» is 1500 each (was 125)"); }
{ const c = chatLifeIntent("Ahmed will pay me 12000 in 12 monthly installments"); ok(c && c.amount === 1000 && c.total === 12000, "\"12000 in 12 monthly installments\" still splits"); }
{ const c = chatLifeIntent("car insurance 200 every year"); ok(c && c.every === "year", "\"car insurance 200 every year\" is a yearly payment"); }
ok(k("بدفع 99 كل شهر للجيم") === "life" && k("anghami 200 every month") === "life", "«بدفع 99 كل شهر للجيم» / anghami monthly are plans, not money now");
ok(chatLifeIntent("change the netflix to 480") === null && chatLifeIntent("the netflix is 150 now, not 200") === null, "an edit never makes a new plan");
// agents
{ const d = tripDates("book me a hotel in Jeddah from 3 to 7 March", { now: NOW }); ok(d[0] === "2027-03-03" && d[1] === "2027-03-07", "\"from 3 to 7 March\" is check-in 3, check-out 7 (was in on the 7th, no out)"); }
ok(k("عايز فندق في جدة من 3 ل 7 مارس") === "agent" && !pay("عايز فندق في جدة من 3 ل 7 مارس").ok, "«عايز فندق في جدة من 3 ل 7 مارس» is a hotel task, not 3 received");
ok(k("I need a room in my house cleaned on Friday") !== "agent", "\"a room … cleaned\" is not a hotel");
ok(parseAgent("تابعلي سعر iPhone 16", { now: NOW, country: "EG", usual: {}, prefs: {} }).kind === "watch", "«تابعلي سعر iPhone 16» watches the price");
ok(k("where is my noon order") === "agent" && k("where is my passport?") === "where", "\"where is my noon order\" tracks the order; \"where is my passport?\" asks Mind");
// lists, to-dos, where, open
ok(JSON.stringify(parseListCommand("shopping list: chicken, milk, pasta")) === JSON.stringify({ op: "add", name: "shopping", items: ["chicken", "milk", "pasta"] }), "\"shopping list: …\" adds to it");
ok(parseListCommand("we're out of sugar and yoghurt").items.join() === "sugar,yoghurt" && parseListCommand("we're out of time") === null, "\"we're out of sugar and yoghurt\" → shopping; \"out of time\" is not");
ok(parseListCommand("خلص السكر والزيت").items.join() === "سكر,زيت", "«خلص السكر والزيت» → the shopping list");
ok(parseListCommand("show my shopping list").name === "shopping" && parseListCommand("what's on my to-do list?") === null, "\"show my shopping list\" finds its name (it found none before)");
for (const s of ["todo: order the cake", "new task: pay the maid", "don't forget: order the cake"]) ok(k(s) === "todo", "\"" + s + "\" is a to-do");
for (const s of ["where did I put the charger?", "النضارة فين؟", "the glasses is at my mum's house"]) ok(k(s) === "where", "where things are: «" + s + "»");
for (const [s, p] of [["open Documents", "booklib"], ["افتح الاعدادات", "settings"], ["go to Follow-ups", "timeline"], ["open People & plans", "life"], ["افتح المتابعات", "timeline"]]) ok(pageOf(s) === p, "\"" + s + "\" opens " + p);
ok(k("ليلى عليه كام؟") === "ask:owed-in" && k("how much went on restaurants this week?") === "ask:money", "«ليلى عليه كام؟» and \"how much went on…\" are answered from my data");
console.log(bad ? "FAIL " + bad + " failed" : "ALL PASSED");
if (bad) process.exitCode = 1;
