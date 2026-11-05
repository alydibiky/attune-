// v9.3 (Ali picked D2 — "do all and make people choose"): the To-dos widget (+ next prayer, + safe to spend, each only when on) and the
// pinned list's widget; ticks made on the home screen are applied when Attune opens.
import * as W from "../../web-src/widgets.js";
import * as L from "../../web-src/lists.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const at = (h, d = 5) => new Date(2026, 10, d, h, 0).getTime();
const now = at(13);
const rem = [{ id: "a", at: at(11), title: "Call the insurance company" }, { id: "b", at: at(17), title: "Pay the maid" }, { id: "c", at: at(10), title: "Done one", done: true },
  { id: "d", at: at(9, 9), title: "Next week" }, { id: "e", at: at(8, 1), title: "Daily old", repeat: "daily" }];
const todos = [{ id: "t1", title: "Tiles quote", meta: { todo: true } }];
const w0 = W.todoWidgetData({ reminders: rem, todos, now });
ok(w0.rows.map((r) => r.id).join() === "a,b,t1" && w0.rows[0].sub === "late" && w0.title === "To-dos · 3 left", "To-dos: the late call first, then today's, then the open to-do — not done, not next week: " + w0.rows.map((r) => r.text).join(" / "));
ok(w0.side === "" && w0.foot === "", "no prayer and no money on it unless turned on");
const w1 = W.todoWidgetData({ reminders: rem, todos, now, prayers: { next: "asr", list: [{ k: "asr", at: "14:42" }] }, safe: { today: 640, cur: "EGP" }, names: { asr: "Asr" } });
ok(w1.side === "Asr 14:42" && w1.foot === "Safe to spend today: 640 EGP", "with prayers on: the next prayer; with safe to spend on: today's amount");
ok(W.todoWidgetData({ reminders: [...rem, ...Array.from({ length: 6 }, (_, i) => ({ id: "x" + i, at: at(18), title: "x" }))], now }).rows.length === 4, "at most 4 rows");
let st = { lists: [L.makeList({ name: "Travel checklist", items: ["Passport", "Charger", "Medicines"], repeat: { every: "once" }, now })] };
const id = st.lists[0].id;
const lw = W.listWidgetData(st, id, { now });
ok(/Travel checklist/.test(lw.title) && lw.side === "0 of 3" && lw.rows.length === 3 && lw.rows[0].id === id + "|" + st.lists[0].items[0].id, "A list: the pinned list, 0 of 3, each item with its own id");
ok(W.listWidgetData(st, "nope", { now }).rows.length === 0 && /Pin to the widget/.test(W.listWidgetData(st, "", { now }).empty), "no pinned list → how to pin one");
const r = W.applyTicks([{ kind: "rem", id: "a", at: now }, { kind: "list", id: lw.rows[1].id, at: now }, { kind: "list", id: lw.rows[1].id, at: now }, { kind: "todo", id: "t1" }], { reminders: rem, lists: st, now });
ok(r.reminders.find((x) => x.id === "a").done === true && r.reminders.find((x) => x.id === "b").done !== true, "a tick on the widget → that reminder is done");
ok(r.lists.lists[0].items[1].done === true && L.progress(r.lists.lists[0]).done === 1, "a list item ticked (twice on the widget = still ticked once, never un-ticked)");
ok(r.mind.join() === "t1", "a to-do from Mind is handed back for Mind to mark done");
ok(W.listWidgetData(r.lists, id, { now }).rows[2].done === true, "ticked items move to the end, ticked");
