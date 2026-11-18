// v10.5 — the interactive widgets (Ali OK'd OK-A1 OK-W1 OK-W2 OK-W3 OK-W5 OK-W6 OK-W7 OK-S, docs/mockups/widgets-combined.html),
// with his own examples: the Talabat list (13 items, 4 ticked → "9 left", ticked under), the maid at 10:00, electricity 600 due today,
// the CIB SMS waiting on the Money widget, the PS5 agent's exact listing, the smart stack's first page and why.
import fs from "fs";
import * as W from "../../web-src/widgets2.js";
import { run } from "../widgets/gen.mjs";
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const now = Date.parse("2026-11-21T09:05:00");   // a Saturday morning
// A1 the Talabat list
const names = ["Salsa", "Foul", "Lettuce", "Cucumber", "Tomatoes", "Bread", "Eggs", "Milk", "Cheese", "Tahina", "Pickles", "Rice", "Water"];
const lists = { lists: [{ id: "l1", name: "Talabat", emoji: "🛒", items: names.map((t, i) => ({ id: "i" + i, text: t, done: i < 4 })), repeat: { every: "once" }, created: now - 864e5 }] };
const LD = W.listsData(lists, { now });
ok(LD[0].left === 9 && LD[0].side === "9 left" && LD[0].items.length === 13, "Talabat: all 13 there, “9 left” (not “13 of 13”): " + LD[0].side);
ok(LD[0].items.slice(0, 9).every((x) => !x.done) && LD[0].items.slice(9).every((x) => x.done), "what is left first, the 4 ticked under it");
// W1 your day
const reminders = [{ id: "maid", title: "The maid comes · 600", at: Date.parse("2026-11-21T10:00:00") }, { id: "bank", title: "Call the bank", at: Date.parse("2026-11-21T13:00:00") }, { id: "old", title: "done", at: now - 3e5, done: true }];
const life = { items: [{ id: "el", kind: "bill", dir: "out", amount: 600, count: 1, total: 600, every: null, start: "2026-11-21", title: "Electricity", person: "", paid: [], currency: "" }] };
const D = W.dayCard({ reminders, life, todos: [], now });
ok(D.rows.map((r) => r.id).join() === "rem:maid,rem:bank,bill:el:0", "Your day: the maid 10:00, the bank 1:00, electricity due today: " + D.rows.map((r) => r.id));
ok(D.rows[0].btns.map((b) => b[0]).join() === "snooze,done" && D.rows[2].btns[0][0] === "paid", "…+1h / Done on reminders, Paid on the bill");
// W2 money with the CIB SMS
const M = W.moneyCard({ safe: { today: 640, cur: "EGP" }, pending: [{ id: "q1", amount: 350, direction: "out", party: "CARREFOUR MAADI", from: "CIB" }], salaryDay: 25 });
ok(M.big === "640 EGP" && M.side === "salary on the 25" && M.rows[0].id === "bank:q1" && M.rows[0].btns.map((b) => b[0]).join() === "dismiss,add", "Money: 640 EGP safe today, the CIB SMS with Add ✓ / ✕");
ok(M.btns.map((b) => b[0]).join() === "spend,got" && M.hideable, "…− I spent / + I got open the small box; 👁 hides the amounts");
// W5 agents: Open ↗ = the exact listing
const ag = { agents: [{ id: "ps5", kind: "watch", what: "PS5", on: true, currency: "EGP", checks: [{ at: now - 86400e3, price: 22000, href: "https://www.noon.com/egypt-en/ps5/N1/p", site: "noon.com" }, { at: now - 3600e3, price: 21499, href: "https://www.noon.com/egypt-en/ps5/N1/p", site: "noon.com" }] }, { id: "off", what: "Old", on: false, checks: [] }] };
const A = W.agentsCard(ag, { now });
ok(A.rows.length === 1 && /21,499/.test(A.rows[0].text) && A.rows[0].btns.some((b) => b[0] === "url:https://www.noon.com/egypt-en/ps5/N1/p"), "Agents: PS5 21,499 with Open ↗ the exact listing; a paused agent isn't shown: " + JSON.stringify(A.rows[0]));
// W7 the stack: why the first page is first
const cards = { day: D, money: M, agents: A, med: W.medCard({}, { now }), papers: W.papersCard({ items: [] }, { now }), trip: W.tripCard({}, { now }), next: W.nextCard([], { now }), lists: LD };
ok(W.stackData(cards, { bankWaiting: true }, { now }).pages[0].kind === "money", "a bank SMS waiting → Money first");
ok(W.stackData(cards, {}, { now }).pages[0].kind === "day" && /morning/i.test(W.stackData(cards, {}, { now }).pages[0].reason), "in the morning → Your day, saying why");
ok(W.stackData(cards, {}, { now: Date.parse("2026-11-21T22:40:00") }).pages[0].kind === "night", "at night → Close the day");
ok(W.stackData(cards, { placeList: "l1" }, { now }).pages[0].kind === "list", "near a shop on the list → that list");
// the taps: once each, even when the phone sends one twice
const tap = { w: "day", a: "done", id: "rem:maid", at: now + 1000 };
const R = W.applyActs([tap, { ...tap }, { w: "day", a: "paid", id: "bill:el:0", at: now + 2000 }, { w: "list", a: "untick", id: "list:l1:i0", at: now + 3000 }], { reminders, lists, life });
ok(R.stores.reminders.find((r) => r.id === "maid").done && R.stores.life.items[0].paid.includes(0) && !R.stores.lists.lists[0].items[0].done && R.done.length === 3, "Done, Paid and an untick applied — the double tap once: " + R.done.length);
ok(W.applyActs([tap], { reminders }, { seen: [W.actKey(tap)] }).done.length === 0, "a tap already applied is never applied again");
const S = W.applyActs([{ w: "day", a: "snooze", id: "rem:bank", at: now }], { reminders });
ok(S.stores.reminders.find((r) => r.id === "bank").at === Date.parse("2026-11-21T14:00:00") && S.schedule.length === 1, "+1h moves the reminder an hour and sets it on the phone");
// the small box's words
ok(W.itemsOf("cheese, pickles and bread").join("|") === "cheese|pickles|bread", "“cheese, pickles and bread” → 3 items");
ok(W.itemsOf("جبنة و مخلل").join("|") === "جبنة|مخلل" && W.itemsOf("milk thanks 🙏").join() === "milk", "«جبنة و مخلل» → 2; “milk thanks 🙏” → milk");
ok(W.spendOf("200 koshary").amount === 200 && W.spendOf("٢٠٠ كشري").amount === 200 && W.spendOf("koshary 1,250").amount === 1250, "“200 koshary”, «٢٠٠ كشري», “koshary 1,250”");
// the phone side is all there
const root = new URL("../../app/src/main/", import.meta.url), rd = (p) => fs.readFileSync(new URL(p, root), "utf8");
const man = rd("AndroidManifest.xml");
for (const c of ["MoneyWidget", "AgentsWidget", "MedWidget", "PapersWidget", "TripWidget", "NextWidget", "StackWidget", "W5Act", "W5ListService", "W5StackService", "W5Tap", "QuickBoxActivity", "W5LookActivity"]) ok(man.includes('android:name=".' + c + '"'), "manifest: " + c);
ok(/W5ListService" android:exported="false" android:permission="android.permission.BIND_REMOTEVIEWS"/.test(man) && /APPWIDGET_CONFIGURE/.test(man), "the list / stack services and the look screen are declared right");
ok(/QuickBoxActivity"[^>]*taskAffinity="com.aldibiki.attune.quick"/.test(man), "the small box has its own task (it never clears the app's)");
for (const x of ["w5_money_info", "w5_agents_info", "w5_med_info", "w5_papers_info", "w5_trip_info", "w5_next_info", "w5_stack_info", "widget_todo_info", "widget_list_info"]) ok(/W5LookActivity/.test(rd("res/xml/" + x + ".xml")), "long-press → the widget's look: " + x);
const locs = ["values", "values-ar", "values-es", "values-fr", "values-de", "values-pt", "values-it", "values-ru", "values-tr", "values-in", "values-hi", "values-ur", "values-fa", "values-bn", "values-sw", "values-th", "values-vi", "values-zh", "values-ja", "values-ko"];
ok(locs.every((l) => (rd("res/" + l + "/strings_w5.xml").match(/<string /g) || []).length === 18), "the widget picker's names in all 20 languages");
const kt = rd("java/com/aldibiki/attune/AttuneWidgets.kt");
ok(/fun clearActs/.test(kt) && /evaluateJavascript\("try\{window.dispatchEvent\(new Event\('attune-widget-acts'\)\)/.test(kt), "the phone keeps the taps until the page applied them, and tells a running page at once");
// the 10,000 run, a 2,500 sample (HARD)
const r = run(2500, 5, { quiet: true });
ok(r.right / r.total >= 0.995 && r.share >= 0.6, `widgets 2,500 sample ${r.right}/${r.total}, shapes ${(100 * r.share).toFixed(1)} %`);
console.log(fail ? `FAIL ${fail}/${n}` : `PASS ${n}/${n}`);
