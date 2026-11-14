// v9.9.40 AP-5 (the new Autopilot, Ali's OK on K1–K6): the decision for each chat message — 2,500 samples of the 10,000-conversation
// generator and its held-out set (0 actions on noise), plus the exact messages from Ali's screenshots.
import { execFileSync } from "child_process";
const A = await import("../../web-src/autopilot2.js");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const run = (env = {}) => { const o = execFileSync("node", [new URL("../autopilot2/gen.mjs", import.meta.url).pathname, "2500"], { env: { ...process.env, ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return { p: +((/\(([\d.]+)%\)/.exec(o) || [0, 0])[1]), noise: +((/Actions on noise: (\d+)/.exec(o) || [0, -1])[1]) }; };
const a = run(), h = run({ HELDOUT: "1" });
ok(a.p === 100 && a.noise === 0, "10,000 conversations, 2,500 sample: " + a.p + "%, actions on noise " + a.noise);
ok(h.p >= 99 && h.noise === 0, "held-out, 2,500 sample: " + h.p + "%, actions on noise " + h.noise + " (the marks: 99%, 0)");
const wa = (title, text, extra = {}) => ({ app: "WhatsApp", pkg: "com.whatsapp", title, text, ...extra });
const roles = { "whatsapp|g:talabat": { role: "shopping", ok: true }, "whatsapp|g:🏠address east marketplace": { role: "building", ok: true, care: ["garage", "الجراج"] }, "whatsapp|p:mama": { role: "person", ok: true },
  "whatsapp|g:صيانة الاوناش في الضبعة": { role: "work", ok: true, care: ["الونش", "crane"], whenMe: true } };
const d1 = A.decide(wa("Talabat", "Noudy: tortilla"), { roles });
ok(d1.kind === "items" && d1.items.join() === "tortilla" && d1.from.who === "Noudy" && d1.from.text === "tortilla", "Talabat · Noudy: tortilla → an item on the list, with its message");
const d2 = A.decide(wa("🏠ADDRESS EAST MARKETPLACE: ~Rowan Soliman", "صباح الخير، فى حد قريبى مهتم يشترى و كان بيدور لو متاح للبيع"), { roles });
ok(d2.kind === "keep", "Address East Marketplace · Rowan selling a flat → kept quietly (no to-do)");
const d3 = A.decide(wa("Emerald Park Owners: ~Dr/ghada Kotb", "الاجتماع يوم السبت"), { roles });
ok(d3.kind === "ask", "Emerald Park (not described yet) → asked once what it is, nothing done");
const d4 = A.decide(wa("صيانة الاوناش في الضبعة: M. Mohamed Sayed Depak", "وكده كده ممكن بكرة اجرب جزء الصيانة اللي هو عمله ده"), { roles, me: ["Ali", "علي"] });
ok(d4.kind === "keep", "the cranes group · «ممكن بكرة اجرب…» → kept (nothing for Ali)");
const d5 = A.decide(wa("صيانة الاوناش في الضبعة: Ahmed", "علي ممكن تبعتلي التقرير"), { roles, me: ["Ali", "علي"] });
ok(d5.kind === "alert", "the cranes group · «علي ممكن تبعتلي التقرير» → Ali is asked: shown");
const d6 = A.decide(wa("Mama", "can you call me when you're free"), { roles });
ok(d6.kind === "todo" && d6.why && d6.from.chat === "Mama", "Mama asks → a to-do, with why and the message");
ok(A.decide(wa("Talabat", "Noudy: 😂😂"), { roles }).kind === "keep" && A.decide(wa("Talabat", "Noudy: https://www.facebook.com/share/p/1"), { roles }).kind === "keep", "a meme or a link in Talabat → kept quietly, not an item");
const q = A.quietCounts([d2, d4, A.decide(wa("Talabat", "Noudy: ok"), { roles })]);
ok(q.total === 3 && q.byChat.length === 3, "Kept quietly: 3 today, by chat");
console.log(fail ? `FAIL ${fail} of ${n}` : `ALL PASSED (${n} checks)`);
process.exit(fail ? 1 : 0);
