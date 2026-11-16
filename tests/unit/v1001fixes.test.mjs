// v10.0.1 — Ali's 8 phone screenshots of 16 Nov 2026, each kept as a test so it can't come back:
// "What are the talabat" answered only "11 messages kept"; "the last time I went to get groceries" answered with a bus company's
// WhatsApp message; "Checked: cheapest EGP 120" for earbuds under 8,000; "Who is this?" with nothing to recognise the person by;
// list items could not be reworded.
import * as Q from "../../web-src/chatask.js";
import * as K from "../../web-src/links.js";
import * as E from "../../web-src/entities.js";
import * as A from "../../web-src/agents.js";
import * as L from "../../web-src/lists.js";
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };

// 1. the chat's two names (the export's copy without a role, the notifications' one = shopping): the described one wins
const two = [{ key: "whatsapp|p:talabat", chat: "Talabat", role: "" }, { key: "whatsapp|g:talabat", chat: "Talabat", role: "shopping" }];
for (const q of ["What are the talabat", "what are all the talabat", "ايه الطلبات", "show me the talabat list"]) { const r = Q.askChat(q, two, {}); ok(r && r.kind === "list" && r.key === "whatsapp|g:talabat", q + " → the Talabat list: " + JSON.stringify(r)); }
// …and a chat not described yet answers with its latest real messages, never only a count
const msgs = Array.from({ length: 15 }, (_, i) => ({ id: "m" + i, ts: 1000 + i, who: "Noudy", text: "item " + i })).concat([{ id: "x", ts: 5000, who: "Noudy", text: "😂", noise: "emoji" }]);
const c1 = Q.askChat("What are the talabat", [{ key: "t", chat: "Talabat", role: "" }], { t: msgs });
ok(c1.kind === "chat" && c1.total === 15 && c1.ids.length === 12 && c1.ids[11] === "m14" && !c1.ids.includes("x") && c1.allIds.length === 15, "not described yet → the latest 12 of its 15 real messages (the 😂 is left out)");

// 2. "the last time I went to get groceries": what YOU did (Money), never a message that only has the word
const now = Date.parse("2026-11-16T12:00:00"), dir = E.emptyDir();
const notes = [{ id: "n1", app: "WhatsApp", title: "طرود السوبر جت", text: "طردك وصل مكتب السوبر جت", ts: Date.parse("2026-11-14") }, { id: "n2", app: "talabat", title: "50% off your top grocery faves 🎉", text: "Order groceries from the supermarket now", ts: Date.parse("2026-11-14") }];
const withMoney = { ledger: { currency: "EGP", txns: [{ id: "1", date: "2026-11-09", type: "expense", amount: 720, note: "Carrefour", cat: "groceries" }] }, notes };
const g1 = K.connect("When is the last time I went to get groceries", withMoney, dir, { now });
ok(g1 && g1.answer && /Carrefour/.test(g1.answer.en) && !g1.items.some((x) => x.src === "messages"), "groceries → the Carrefour payment, no messages: " + (g1 && g1.answer && g1.answer.en));
const g2 = K.connect("When is the last time I went to get groceries", { ledger: { currency: "EGP", txns: [] }, notes }, dir, { now });
ok(g2 && g2.answer && /no record/.test(g2.answer.en) && !g2.items.length, "only messages mention it → “I have no record”, not a message: " + (g2 && g2.answer && g2.answer.en));
const g3 = K.connect("امتى اخر مرة رحت السوبر ماركت", withMoney, dir, { now });
ok(g3 && g3.answer && /Carrefour/.test(g3.answer.ar), "Arabic: «امتى اخر مرة رحت السوبر ماركت» → the payment");
const g4 = K.connect("anything about groceries?", { notes: [notes[0]] }, dir, { now });
ok(!g4 || !g4.items.some((x) => /السوبر جت/.test(x.title + x.text)), "«السوبر جت» (the bus company) is not the supermarket");

// 3. a case's price is never the product: under a tenth of your own limit
const buy = { kind: "buy", what: "Huawei FreeClip 2", below: 8000, currency: "EGP", checks: [], created: 1 };
ok(!A.believable({ price: 700, currency: "EGP" }, buy) && A.believable({ price: 7400, currency: "EGP" }, buy), "under 8,000: 700 is not the earbuds, 7,400 is");
const r1 = A.takeBuyRound(buy, [{ name: "Huawei FreeClip 2", price: 120, currency: "EGP", site: "Amazon" }]);
ok(!r1.nearest && r1.checks[0].blocked, "a round that only saw “Huawei FreeClip 2 · EGP 120” keeps no price");
const chat = A.agentChat({ ...buy, checks: [{ at: 10, price: 120, site: "Amazon", how: "browser" }, { at: 20, price: 7400, site: "noon", how: "browser" }] }).map((m) => (m.T ? m.T[0] + JSON.stringify(m.T[1] || {}) : m.text)).join(" | ");
ok(!/"p":120/.test(chat) && /"p":7400/.test(chat), "the conversation never says “cheapest 120”: " + chat);

// 4. one list item reworded (its tick stays) or removed
let st = L.addList({ lists: [] }, L.makeList({ name: "Talabat", items: ["Toast", "Fitness for", "Fitness"] }));
const id = st.lists[0].id, it = st.lists[0].items;
st = L.renameItem(st, id, it[1].id, "Fitness toast"); st = L.removeItem(st, id, it[2].id);
ok(st.lists[0].items.map((x) => x.text).join() === "Toast,Fitness toast", "“Fitness for” → “Fitness toast”, “Fitness” deleted: " + st.lists[0].items.map((x) => x.text).join());
ok(L.renameItem(st, id, it[0].id, "   ").lists[0].items[0].text === "Toast", "an empty new name changes nothing");
console.log(fail ? `FAIL ${fail} of ${n}` : `ALL PASSED (${n} checks)`);
process.exit(fail ? 1 : 0);
