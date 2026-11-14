// v9.9.40 AP-5 (screens): the chat Autopilot's running state — each message looked at once, Talabat → list effects, a new chat asked
// about once, noise counted as kept quietly, messages older than 2 days never acted on, exports + notifications merged once.
const P = await import("../../web-src/chatpilot.js");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const now = Date.parse("2026-11-14T20:00:00");
const wa = (id, title, text, ts, extra = {}) => ({ id, app: "WhatsApp", pkg: "com.whatsapp", title, text, ts, ...extra });
const roles = { "whatsapp|g:talabat": { role: "shopping", ok: true } };
const notes = [wa("1", "Talabat", "Noudy: tortilla", now - 3600e3), wa("2", "Talabat", "Noudy: 😂😂", now - 3500e3), wa("3", "Gym buddies", "Karim: leg day tomorrow", now - 3400e3),
  wa("4", "Gym buddies", "Omar: ok", now - 3300e3), wa("5", "Talabat", "Noudy: chicken strips", now - 5 * 864e5)];
const r1 = P.step(notes, P.emptyCP(), { roles, now });
ok(r1.effects.length === 1 && r1.effects[0].type === "addItems" && r1.effects[0].items.join() === "tortilla" && r1.effects[0].rec.from.who === "Noudy", "Talabat · tortilla → one effect: add to the list, with Noudy's message");
ok(r1.st.ask.length === 1 && r1.st.ask[0].chat === "Gym buddies", "Gym buddies (not described) → asked once, nothing done");
ok(P.quietToday(r1.st, now).total === 2, "the 😂 and the ok → kept quietly (2 today)");
ok(!r1.effects.some((e) => (e.rec.items || []).includes("chicken strips")), "a message from 5 days ago is never acted on (kept for questions only)");
const r2 = P.step(notes, r1.st, { roles, now: now + 60000 });
ok(r2.effects.length === 0 && r2.st.ask.length === 1, "the same messages again → nothing new (each looked at once)");
const st3 = P.record(r1.st, r1.effects[0].rec, { listId: "l1", itemIds: ["i1"] });
ok(st3.done[0].from.text === "tortilla" && st3.done[0].undo.itemIds[0] === "i1" && P.markUndone(st3, st3.done[0].id).done[0].undone, "Done for you keeps the message and how to undo it");
const ex = "14/11/2026, 19:00 - Noudy: tortilla\n14/11/2026, 19:05 - Ali: ok\n10/11/2026, 10:00 - Noudy: milk";
const mb = P.messagesByChat([wa("1", "Talabat", "Noudy: tortilla", Date.parse("2026-11-14T19:00:20"))], [{ title: "Talabat", text: ex }], roles);
ok(mb.byKey["whatsapp|g:talabat"] && mb.byKey["whatsapp|g:talabat"].length === 3, "export + notification of the same message → kept once (3 messages): " + JSON.stringify((mb.byKey["whatsapp|g:talabat"] || []).map((m) => m.text)));
// the first Talabat messages arrived while it was asking "what is Talabat?" → acted on once Ali says Right
{ const t = [wa("t1", "Talabat", "Noudy: tortilla", now - 600e3), wa("t2", "Talabat", "Noudy: chicken strips", now - 500e3)];
  const a1 = P.step(t, P.emptyCP(), { roles: {}, now }); ok(a1.effects.length === 0 && a1.st.ask.length === 1, "before Right: asked, nothing done");
  const a2 = P.step(t, { ...a1.st, ask: [] }, { roles, now: now + 1000 });
  ok(a2.effects.length === 2 && a2.effects.map((e) => e.items[0]).join() === "tortilla,chicken strips", "after Right: both waiting items go on the list"); }
// EX-1: a shared export of a chat not described yet → asked at once, with a guess from its whole history
{ const exp = [{ title: "Talabat", text: "14/11/2026, 19:00 - Noudy: tortilla\n14/11/2026, 19:05 - Noudy: milk\n14/11/2026, 19:06 - Ali: eggs and bread\n13/11/2026, 10:00 - Noudy: اللبن خلص" }];
  const e1 = P.askForExports(P.emptyCP(), exp, {}, now);
  ok(e1.added === 1 && e1.st.ask[0].chat === "Talabat" && e1.st.ask[0].guess.role === "shopping", "EX-1: the Talabat export → asked at once, guess: a shopping list");
  ok(P.askForExports(P.emptyCP(), exp, roles, now).added === 0, "…not asked again once described");
  const withNote = P.askForExports(P.emptyCP(), exp, {}, now, [wa("z", "Talabat", "x", now - 1000, { group: true, convo: "Talabat", who: "Noudy" })]);
  ok(withNote.st.ask[0].key === "whatsapp|g:talabat" && withNote.st.ask[0].fromExport, "a group of two (Talabat): the notifications say group → asked as the group"); }
console.log(fail ? `FAIL ${fail} of ${n}` : `ALL PASSED (${n} checks)`);
process.exit(fail ? 1 : 0);
