// v9.9.40 AP-6 (K5 / AS-2): questions about a chat answered from its kept messages — 2,500 samples of the 10,000-question generator
// and its held-out set, plus Ali's own questions.
import { execFileSync } from "child_process";
const Q = await import("../../web-src/chatask.js");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const run = (env = {}) => +((/\(([\d.]+)%\)/.exec(execFileSync("node", [new URL("../chatask/gen.mjs", import.meta.url).pathname, "2500"], { env: { ...process.env, ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })) || [0, 0])[1]);
const a = run(), h = run({ HELDOUT: "1" });
ok(a === 100, "10,000 questions, 2,500 sample: " + a + "%"); ok(h >= 99, "held-out, 2,500 sample: " + h + "% (the mark: 99%)");
const chats = [{ key: "ae", chat: "🏠ADDRESS EAST OWNERS 🏠", role: "building" }, { key: "tb", chat: "Talabat", role: "shopping" }, { key: "cr", chat: "صيانة الاوناش في الضبعة", role: "work" }];
const t0 = Date.parse("2026-11-03T10:00:00"), D = 864e5;
const ae = [{ id: "1", ts: t0, who: "Dr Hazem Wagdy", text: "The garage gate will be closed for 2 days" }, { id: "2", ts: t0 + 3600e3, who: "Rowan", text: "thanks" },
  { id: "3", ts: t0 + 5 * D, who: "Mona", text: "مين راكن في الجراج مكاني؟" }, { id: "4", ts: t0 + 8 * D, who: "Dr Hazem Wagdy", text: "The second gate opens Saturday" }];
const r = Q.askChat("When did Address East discuss the garage?", chats, { ae });
ok(r && r.key === "ae" && r.days.map((x) => x.iso).join() === "2026-11-03,2026-11-08" && r.ids.join() === "1,3", "Address East · the garage → 3 Nov (Dr Hazem) and 8 Nov («الجراج», Mona); the 2 messages it used: " + JSON.stringify(r && r.days));
ok(Q.askChat("what are all the talabat", chats, {}).kind === "list", "“what are all the talabat” → the Talabat list itself (not the delivery app)");
const cr = Q.askChat("امتى صيانة الاوناش اتكلموا عن الصيانة؟", chats, { cr: [{ id: "a", ts: t0, who: "M. Mohamed", text: "الصيانة بكرة الساعة ٩" }] });
ok(cr.key === "cr" && cr.total === 1, "the cranes group (named «صيانة») asked about الصيانة → that group, 1 message");
console.log(fail ? `FAIL ${fail} of ${n}` : `ALL PASSED (${n} checks)`);
process.exit(fail ? 1 : 0);
