// v9.4 (Ali, 5 Nov 2026, picked G1–G7: "schedule a message, like send this contact this message at 5 pm tomorrow"; visa slots; restock;
// price protection; clinic; trip day; how much the agent may do alone) — the pure parts in agents2.js.
import * as G from "../../web-src/agents2.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const now = Date.parse("2026-11-05T12:00:00"), DAY = 864e5;
const at5 = new Date(2026, 10, 6, 17, 0).getTime();
// G1 scheduled messages
const s = G.parseScheduled("send Ahmed \"I'm on my way\" tomorrow at 5 pm", { now }) || {};
ok(s.kind === "send" && s.who === "Ahmed" && s.text === "I'm on my way" && s.at === at5, "“send Ahmed 'I'm on my way' tomorrow at 5 pm” → Ahmed, the whole text (the apostrophe kept), 6 Nov 17:00");
const sa = G.parseScheduled("ابعت لأحمد «انا جاي» بكرة الساعة ٥ العصر", { now }) || {};
ok(sa.who === "أحمد" && sa.text === "انا جاي" && sa.at === at5, "«ابعت لأحمد «انا جاي» بكرة الساعة ٥ العصر» → أحمد, the text, tomorrow 5 pm: " + JSON.stringify(sa));
ok((G.parseMore("send Ahmed \"I'm on my way\" tomorrow at 5 pm", { now }) || {}).kind === "send", "parseMore sends it to the scheduled-message agent");
const items = [{ key: "a", who: "Ahmed", text: "are you coming?", ts: now - 4 * 36e5, app: "WhatsApp", canReply: true },
  { key: "b", who: "Mona", text: "ok", ts: now - 4 * 36e5, seen: true }, { key: "c", who: "Group", text: "hi", ts: now - 5 * 36e5, group: true },
  { key: "d", who: "Sara", text: "call me", ts: now - 600e3 }];
const w = G.waitingChats(items, { now });
ok(w.length === 1 && w[0].who === "Ahmed" && w[0].canReply, "waiting chats: only an unseen 1-to-1 chat older than 3 hours (not a seen one, a group, or a fresh one)");
ok(G.QUICK.length >= 4, "quick replies ready");
// G2 visa slots
const sl = G.parseMore("watch for a visa appointment for Spain", { now }) || {};
ok(sl.kind === "slot" && sl.dest === "ES" && /vfsglobal\.com\/egy\/en\/esp\//.test(sl.url), "a visa slot for Spain from Egypt → VFS Egypt → Spain: " + sl.url);
ok(G.slotState("No appointments available").state === "none" && G.slotState("Please sign in").state === "login", "the page says none / asks to sign in");
const op = G.slotState("Available dates: 12/12/2026");
ok(op.state === "open" && op.dates[0] === "2026-12-12", "…or shows a date → open, with the date");
// G3 restock
const tx = [28, 21, 14, 7].map((d) => ({ type: "expense", note: "Rice", amount: 50, date: new Date(now - d * DAY).toISOString().slice(0, 10) }));
const r = G.restockDue({ txns: tx }, { now, soon: 7 });
ok(r.length === 1 && r[0].item === "Rice" && r[0].every === 7 && r[0].price === 50, "rice bought every 7 days → due now, at its usual price: " + JSON.stringify(r));
ok(G.restockDue({ txns: tx.slice(0, 2) }, { now, soon: 7 }).length === 0, "two buys aren't a habit yet");
ok(G.isRestock("remind me before I run out of coffee") && G.isRestock("فكرني قبل ما يخلص البن"), "“before I run out” / «قبل ما يخلص»");
// G4 price protection
const p = G.parseProtect("protect the price of the iPhone I bought from Amazon for 45000", { now }) || {};
ok(p.what === "iPhone" && p.paid === 45000 && p.site === "Amazon" && p.days === 15, "“the iPhone I bought from Amazon for 45000” → iPhone, 45,000, Amazon, 15 days in Egypt: " + JSON.stringify(p));
const p2 = G.parseProtect("I bought AirPods Pro 2 for 9,450 on noon", { now }) || {};
ok(p2.what === "AirPods Pro 2" && p2.paid === 9450 && p2.site === "noon", "“I bought AirPods Pro 2 for 9,450 on noon”");
const ps = G.protectState({ what: "iPhone", currency: "EGP", paid: 45000, bought: now - 3 * DAY, days: 15 }, 41000, { now });
ok(ps.drop === true && ps.back === 4000 && ps.daysLeft === 12 && /iPhone .*EGP 45000.*EGP 41000.*EGP 4000/.test(ps.message), "the price fell 4,000 with 12 days left → a message to send the store: " + JSON.stringify(ps).slice(0, 120));
ok(G.protectState({ paid: 45000, bought: now }, 44900, { now }).drop === false, "a 100 drop on 45,000 is noise, not worth asking the store");
ok(G.returnDays("amazon", "US") === 30 && G.returnDays("amazon", "EG") === 15, "return windows differ by country");
// G5 clinic
const c = G.parseClinic("find me a dentist in Cairo") || {};
ok(c.kind === "clinic" && c.spec === "dentist" && c.city === "Cairo" && c.tries.some((t) => t.site === "Vezeeta"), "a dentist in Cairo → Vezeeta + Maps");
ok(G.clinicSites("dentist", "Paris", "FR").some((x) => /doctolib\.fr/.test(x.url)) && G.clinicSites("dentist", "Lima", "PE").some((x) => /google\.com\/maps/.test(x.url)), "France → Doctolib; any country → Google Maps");
// G6 trip day
const t = G.parseTrip("my flight MS777 to Paris on 20 November at 10:30", { now }) || {};
ok(t.kind === "trip" && t.flight === "MS 777" && t.to === "CDG" && t.at === new Date(2026, 10, 20, 10, 30).getTime() && t.intl, "a flight → MS 777 to Paris CDG, 20 Nov 10:30, international");
const plan = G.tripPlan(t, [{ text: "Gate changed to F4", app: "EgyptAir", ts: now }], { now: t.at - 5 * 36e5 });
ok(plan && JSON.stringify(plan).includes("F4"), "a ‘Gate changed to F4’ notification reaches the trip plan");
// G7 how much the agent may do alone
ok(G.autonomyIn("only tell me") === "notify" && G.autonomyIn("ask me first") === "ask" && G.autonomyIn("do it by itself under 500").auto === 500, "only tell me / ask me first / by itself under 500");
ok(G.autonomyIn("اشتري لوحدك لو أقل من 2 الف").auto === 2000, "«لوحدك لو أقل من 2 الف» → under 2,000");
const rules = { autonomy: { auto: 500 } };
ok(G.mayAct(rules, { price: 400, site: "noon" }, ["noon"]) && !G.mayAct(rules, { price: 600, site: "noon" }, ["noon"]) && !G.mayAct(rules, { price: 400, site: "x" }, ["noon"]),
  "acts alone only under the limit and with a store used before");
ok(!G.mayAct({ autonomy: "ask" }, { price: 1, site: "noon" }, ["noon"]), "“ask me first” never acts alone");
