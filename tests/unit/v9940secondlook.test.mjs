// v9.9.40 K6 (Ali OK'd): the computer's bigger AI re-reads the phone's Autopilot decisions — the batch it sees, what its answer may
// change (never the phone's hard rules: noise stays kept, a group message is never a to-do), the fixes shown with their messages.
const S = await import("../../web-src/secondlook.js"), P = await import("../../web-src/chatpilot.js");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const now = Date.parse("2026-11-14T20:00:00");
const f = (chatKey, chat, who, text) => ({ chatKey, chat, who, text, ts: now - 3600e3, app: "whatsapp" });
const st = { done: [{ id: "d1", kind: "alert", at: now - 3600e3, from: f("whatsapp|g:ae", "Address East", "Dr Hazem", "the garage gate is closed till Saturday"), why: { t: "x", v: {} } },
                    { id: "d2", kind: "items", at: now - 3600e3, from: f("whatsapp|g:talabat", "Talabat", "Noudy", "tortilla"), why: {} },
                    { id: "d3", kind: "todo", at: now - 99 * 864e5, from: f("whatsapp|p:mama", "Mama", "Mama", "call me"), why: {} }],
             kept: [{ id: "k1", at: now - 3000e3, from: f("whatsapp|g:talabat", "Talabat", "Noudy", "milk"), quiet: "", why: {} },
                    { id: "k2", at: now - 3000e3, from: f("whatsapp|g:fam", "Family", "Ahmed", "😂😂"), quiet: "emoji", why: {} },
                    { id: "k3", at: now - 3000e3, from: f("whatsapp|g:cranes", "صيانة الاوناش", "Ahmed", "Ali check the crane today"), quiet: "", why: {} }] };
const batch = S.toReview(st, now - 7 * 864e5);
ok(batch.map((x) => x.id).join() === "d1,d2,k1,k3", "this week's decisions (an old one and pure noise are not re-asked): " + batch.map((x) => x.id).join());
const roles = { "whatsapp|g:talabat": { role: "shopping", ok: true }, "whatsapp|g:ae": { role: "building", ok: true, care: ["garage"] } };
const pr = S.reviewPrompt(batch, roles);
ok(pr.length === 2 && /a shared shopping list/.test(pr[1].content) && /cares about: garage/.test(pr[1].content), "the model sees each message with its chat's role and topics");
// a model answer: k1 should be items (right fix); k3 says todo from a GROUP (the phone's rule: never) ; d2 ok; d1 ok
const out = JSON.stringify({ r: [{ n: 1, ok: true }, { n: 2, ok: true }, { n: 3, ok: false, should: "items", why: "milk is a shopping item" }, { n: 4, ok: false, should: "todo", why: "Ali is asked" }] });
const res = S.readReview(out, batch);
ok(res.filter((r) => !r.ok).length === 1 && res.find((r) => r.id === "k1").should === "items", "the fix kept: “milk” in Talabat should have been an item");
ok(res.find((r) => r.id === "k3").ok === true, "a to-do from a group is refused (the phone's rule wins over the bigger AI)");
const memeBatch = [{ id: "m", kind: "keep", from: f("whatsapp|g:fam", "Family", "Ahmed", "😂😂") }];
ok(S.readReview(JSON.stringify({ r: [{ n: 1, ok: false, should: "alert" }] }), memeBatch)[0].ok === true, "noise stays kept, whatever the AI says");
ok(S.readReview("not json", batch) === null, "a broken answer changes nothing");
const rec = S.reviewRecord([batch], [res], now);
ok(rec.total === 4 && rec.right === 3 && rec.fixes.length === 1 && rec.fixes[0].from.text === "milk" && rec.fixes[0].was === "keep", "Computer checked: 4 · 3 right · 1 fixed, with its message");
// the phone keeps the kept messages (for the computer)
const w = { id: "z", app: "WhatsApp", pkg: "com.whatsapp", title: "Address East", text: "anyone selling a car?", ts: now - 1000, group: true, convo: "Address East", who: "Rowan" };
const r1 = P.step([w], P.emptyCP(), { roles: { "whatsapp|g:address east": { role: "building", ok: true } }, now });
ok((r1.st.kept || []).length === 1 && r1.st.kept[0].from.text === "anyone selling a car?", "the phone keeps the kept message (text + why) for the computer");
console.log(fail ? `FAIL ${fail} of ${n}` : `ALL PASSED (${n} checks)`);
process.exit(fail ? 1 : 0);
