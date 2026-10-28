// v8.6 persona 1 (the sceptical tester, two months of use): every bug the simulation found stays fixed.
const LS = { "attune:country": "eg" }; globalThis.localStorage = { getItem: (k) => (k in LS ? LS[k] : null), setItem: (k, v) => { LS[k] = String(v); }, removeItem: (k) => { delete LS[k]; } };
const D = await import("../../web-src/doit.js"), L = await import("../../web-src/life.js"), Y = await import("../../web-src/yusr/logtext.js");
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const now = Date.parse("2026-10-27T13:00:00");
let st = { ledger: null, life: { items: [] }, fit: { days: {} } };
const say = (t) => { const u = D.understand(t, { now, stores: st }); const out = []; for (const a of u.actions || []) { const r = D.apply(a, st, { now }); for (const [k, v] of Object.entries(r.stores || {})) st = { ...st, ...(k === "ledger.v3" ? { ledger: v } : k === "attune:life:v1" ? { life: v } : k === "attune:fit:v1" ? { fit: v } : {}) }; out.push(r.done && r.done.en); } return { u, out }; };
const spent = () => (st.ledger ? st.ledger.txns.filter((x) => x.type === "expense").reduce((a, x) => a + x.amount, 0) : 0);
say("fuel 500"); ok(spent() === 500 && !Object.keys(st.fit.days).length, "'fuel 500' is a 500 expense, not ful medames");
say("maid 400"); ok(spent() === 900, "'maid 400' is an expense (it went to Chat)");
say("spent 200 on lunch and 50 on coffee and 30 tip"); ok(spent() === 1180, "three amounts in one sentence → all three");
say("electricity bill 650 due on the 10th"); ok(spent() === 1180 && st.life.items.some((c) => c.amount === 650 && c.every === "month"), "a bill due on the 10th → 650 a month in People & plans, not a 10 EGP expense");
say("last friday paid 500 for the doctor"); ok(st.ledger.txns.some((x) => x.amount === 500 && x.date === "2026-10-23"), "'last friday paid 500' → an expense dated last Friday, not a reminder");
ok(say("meeting with Ali tuesday 3pm").u.actions[0].kind === "reminder", "an appointment with a day and time is still a reminder");
ok(say("I weigh 200 lbs").u.actions[0].kg === 90.7 && say("weight 920").u.ask, "200 lbs → 90.7 kg; 'weight 920' is questioned, not spent");
say("I lent mohamed 700"); say("I owe the grocer 120");
ok(st.life.items.some((c) => c.person === "Mohamed" && c.dir === "in") && st.life.items.some((c) => c.person === "Grocer" && c.dir === "out"), "'I lent mohamed 700' / 'I owe the grocer 120' are debts, not expenses");
say("Mohamed paid me back 300"); { const c = st.life.items.find((x) => x.person === "Mohamed"); ok(L.progressOf(c, now).left === 400, "'Mohamed paid me back 300' → he still owes 400 (and the 300 comes in)"); }
say("paid the grocer 120"); { const c = st.life.items.find((x) => x.person === "Grocer"); ok(L.progressOf(c, now).left === 0, "'paid the grocer 120' settles what I owed"); }
ok(Y.readLocal("spent 1.500 on shoes", { today: "2026-10-27" }).items[0].amount === 1500, "'1.500' is fifteen hundred");
ok(Y.readLocal("da3et 200 3ala el akl", { today: "2026-10-27" }).items[0].amount === 200, "Franco 'da3et 200' → 200 (the 3 in a word is a letter)");
ok(Y.readLocal("i got 500 from mom", { today: "2026-10-27" }).items[0].type === "income", "'i got 500 from mom' is money in");
const plan = { kind: "installment", dir: "in", amount: 2444.44, count: 9, total: 22000, every: "month", created: Date.parse("2026-09-01T10:00:00"), paid: [] };
ok(L.scheduleOf(plan, now)[0].date === "2026-10-01", "a plan without a start date counts from the day it was saved (not re-dated to today every day)");
const r = say("lunch chicken shawarma paid 140"); ok(!/paid/i.test((st.fit.days["2026-10-27"].meals.lunch || []).map((x) => x.name).join()), "a food is never named with money words ('Chicken shawarma paid')");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
