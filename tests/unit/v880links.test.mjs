// v8.8 the connected memory, part 2 (Ali: "chat should be very smart and connect everything together — for everything")
import * as E from "../../web-src/entities.js";
import * as K from "../../web-src/links.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const now = Date.parse("2026-10-30T12:00:00");
let d = E.emptyDir(), plumber, work, osama;
({ dir: d, id: plumber } = E.addCard(d, { name: "Ahmed the plumber", role: "plumber" }, now));
({ dir: d, id: work } = E.addCard(d, { name: "Ahmed", role: "work" }, now));
({ dir: d, id: osama } = E.addCard(d, { name: "Osama", role: "barber", aliases: ["الحلاق"] }, now));
const tx = (id, date, type, amount, note, cat = "other") => ({ id, date, type, amount, note, cat });
const stores = {
  ledger: { currency: "EGP", txns: [tx("1", "2026-10-02", "expense", 250, "Osama haircut"), tx("2", "2026-10-23", "expense", 250, "الحلاق"), tx("3", "2026-10-10", "expense", 300, "Ahmed the plumber — sink"),
    tx("4", "2026-09-01", "expense", 12000, "wedding hall deposit"), tx("5", "2026-10-15", "expense", 3500, "زفاف — الفستان"), tx("6", "2026-10-20", "income", 9000, "Ahmed — project invoice", "salary")] },
  life: { items: [{ id: "L1", kind: "debt", person: "Osama", dir: "in", amount: 500, total: 500, count: 1, start: "2026-10-01", title: "lent" }] },
  memory: [{ id: "m1", kind: "note", title: "Wedding", text: "Hall booked for 12 Dec, DJ still to confirm", ts: Date.parse("2026-10-05"), meta: { book: "mybook" } }],
  notes: [{ id: "n1", app: "WhatsApp", title: "Osama", text: "Can you come Saturday at 6?", ts: Date.parse("2026-10-28") }],
  pots: { pots: [{ id: "u", name: "Umrah", target: 60000, saved: 5000 }] },
};
const a = K.connect("How much did I pay Osama?", stores, d, { now });
ok(a.people[0].id === osama && a.money.out === 500 && a.money.count === 2, "Osama: both haircuts (one written «الحلاق») = 500, by code");
ok(a.items.some((x) => x.src === "messages") && a.items.some((x) => x.src === "followups"), "…and his message and the debt are linked too");
ok(/you paid 500 EGP/.test(a.answer.en) && /دفعت 500/.test(a.answer.ar), "the sum is answered by code: " + a.answer.en);
const o = K.connect("does Osama owe me anything?", stores, d, { now });
ok(/owes you 500/.test(o.answer.en), "who owes what, from Follow-ups: " + o.answer.en);
const w = K.connect("how much has the wedding cost so far?", stores, d, { now });
ok(w.money.out === 15500 && w.items.some((x) => x.src === "notes"), "a topic: the hall + «زفاف» dress = 15,500, and the note about the hall");
const amb = K.connect("what did Ahmed say?", stores, d, { now });
ok(amb.ask && amb.ask.choices.length === 2 && amb.ask.choices.some((c) => /plumber/.test(c.label)), "two Ahmeds → «Which Ahmed?» with how to tell them apart");
const picked = K.connect("what did Ahmed say?", stores, d, { now, pick: work });
ok(picked.people[0].id === work && picked.items.some((x) => x.id === "tx:6") && !picked.items.some((x) => x.id === "tx:3"), "picked work-Ahmed → his invoice, not the plumber's sink");
ok(K.connect("what is the capital of France?", stores, d, { now }) === null, "a general question → null (Chat answers as usual)");
const g = K.connect("is my Umrah plan on track?", stores, d, { now });
ok(g.items.some((x) => x.src === "goals") && /Umrah/.test(g.block), "a goal by its own name → the goal and what is linked");
const last = K.connect("when was the last time I went to the barber?", stores, d, { now });
ok(/Last time: 28 Oct/.test(last.answer.en) || /Last time: 23 Oct/.test(last.answer.en), "the last time, by code: " + (last.answer && last.answer.en));
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
