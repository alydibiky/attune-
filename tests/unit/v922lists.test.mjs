// v9.2 (Ali, 4 Nov 2026, picked 1A + "a part where I add my list and choose whether it repeats"): lists that come back to Home when
// they are needed, and leave when every box is ticked.
import * as L from "../../web-src/lists.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const at = (iso, h = 10) => new Date(iso + "T" + String(h).padStart(2, "0") + ":00:00").getTime();
const WED = at("2026-11-04"), THU = at("2026-11-05"), SAT = at("2026-11-07"), SUN = at("2026-11-08");

// what was said
let c = L.parseListCommand("make my travel checklist: passport, charger, Umrah clothes, medicines", WED);
ok(c && c.op === "make" && c.name === "travel" && c.items.join("|") === "passport|charger|Umrah clothes|medicines" && c.repeat.every === "date", "“make my travel checklist: …” → a travel list (before a date): " + JSON.stringify(c));
c = L.parseListCommand("every Saturday: clean the flat, pay the maid, water the plants", WED);
ok(c && c.op === "make" && c.repeat.every === "week" && c.repeat.days.join() === "6" && c.items.length === 3, "“every Saturday: …” → a weekly list on Saturday");
c = L.parseListCommand("كل سبت: تنضيف الشقة، فلوس الدادة", WED);
ok(c && c.op === "make" && c.repeat.days.join() === "6" && c.items.length === 2, "«كل سبت: …» → the same in Egyptian Arabic");
c = L.parseListCommand("I'm travelling Thursday", WED);
ok(c && c.op === "trip" && c.date === "2026-11-05", "“I'm travelling Thursday” → a trip on Thu 5 Nov");
c = L.parseListCommand("انا مسافر الخميس", WED);
ok(c && c.op === "trip" && c.date === "2026-11-05", "«انا مسافر الخميس» → the same");
c = L.parseListCommand("what's my to-do list for travelling?", WED);
ok(c && c.op === "show" && /travel/.test(c.name), "“what's my to-do list for travelling?” → show the travel list: " + JSON.stringify(c));
ok(L.parseListCommand("remind me to call Hassan at 6", WED) === null && L.parseListCommand("spent 150 on lunch", WED) === null && L.parseListCommand("what's my to-do list?", WED) === null,
  "a reminder, an expense and the plain to-do list are not list commands");

// a trip list: on Home the day before, empty again for the next trip
let st = { lists: [] };
let r = L.applyListCommand(st, L.parseListCommand("make my travel checklist: passport, charger", WED), WED); st = r.st;
ok(st.lists.length === 1 && !L.onHome(st.lists[0], WED), "a travel list with no date is kept, not on Home");
r = L.applyListCommand(st, L.parseListCommand("I'm travelling Saturday", WED), WED); st = r.st;
ok(st.lists[0].repeat.date === "2026-11-07" && !L.onHome(st.lists[0], WED) && L.onHome(st.lists[0], at("2026-11-06")) && L.onHome(st.lists[0], SAT), "the trip on Saturday → on Home from Friday to Saturday");
st = L.tick(st, st.lists[0].id, st.lists[0].items[0].id, at("2026-11-06"));
st = L.tick(st, st.lists[0].id, st.lists[0].items[1].id, at("2026-11-06"));
ok(!L.onHome(st.lists[0], at("2026-11-06")), "every box ticked → it leaves Home");
ok(!L.onHome(st.lists[0], at("2026-11-09")), "after the trip it is not on Home");
r = L.applyListCommand(st, L.parseListCommand("I'm flying on 20/11", at("2026-11-09")), at("2026-11-09")); st = r.st;
const next = L.current(st.lists[0], at("2026-11-19"));
ok(L.onHome(st.lists[0], at("2026-11-19")) && next.items.every((x) => !x.done), "the next trip → back on Home the day before, every box empty again");

// weekly list
st = { lists: [] }; st = L.applyListCommand(st, L.parseListCommand("every Saturday: clean the flat, pay the maid", WED), WED).st;
const w = st.lists[0];
ok(!L.onHome(w, at("2026-11-02")) && L.onHome(w, SAT), "weekly (Saturday): not before its first Saturday, on Home on Saturday");
st = L.tick(st, w.id, w.items[0].id, SAT);
ok(L.onHome(st.lists[0], SUN) && L.homeLists(st, SUN)[0].items.filter((x) => x.done).length === 1, "unfinished → still on Home on Sunday (nothing due is hidden)");
const nextSat = L.current(st.lists[0], at("2026-11-14"));
ok(nextSat.items.every((x) => !x.done) && nextSat.cycle === "2026-11-14", "next Saturday it starts empty again");

// daily and monthly
let d = L.makeList({ name: "Morning", items: ["pills", "water"], repeat: { every: "day" }, now: WED });
ok(L.onHome(d, WED) && L.onHome(d, THU), "every day → on Home every day");
let mo = L.makeList({ name: "Bills", items: ["rent"], repeat: { every: "month", dom: 31 }, now: at("2026-10-01") });
ok(L.cycleOf(mo, at("2026-11-30")) === "2026-11-30" && L.cycleOf(mo, at("2026-11-29")) === "2026-10-31", "monthly on the 31st → the month's last day (30 Nov), until then October's round");

// once
let o = L.makeList({ name: "Flat move", items: ["boxes"], repeat: { every: "once" }, now: WED });
ok(L.onHome(o, WED), "a one-time list is on Home until it is done");
o = L.makeList({ name: "Eid", items: ["gifts"], repeat: { every: "once", date: "2026-11-20" }, now: WED });
ok(!L.onHome(o, WED) && L.onHome(o, at("2026-11-21")), "a one-time list from a date → on Home from that date");

// editing
st = { lists: [L.makeList({ name: "Shopping", items: ["milk"], now: WED })] };
st = L.addItem(st, st.lists[0].id, "eggs, bread");
ok(st.lists[0].items.map((x) => x.text).join() === "milk,eggs,bread", "add items (comma-separated)");
st = L.editList(st, st.lists[0].id, { repeat: { every: "week", days: [5] } });
ok(st.lists[0].repeat.every === "week" && st.lists[0].repeat.days.join() === "5", "change it to repeat every Friday");
ok(L.findList({ lists: [L.makeList({ name: "Travel", items: ["x"] })] }, "travelling") && L.findList({ lists: [L.makeList({ name: "السفر", items: ["x"] })] }, "سفر"), "find a list by how it is said");
ok(L.emojiFor("travel") === "🧳" && L.emojiFor("تنضيف البيت") === "🧹", "an emoji from the name");
