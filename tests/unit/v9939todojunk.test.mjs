// v9.9.39 (Ali's phone, 14 Nov: "the to-do list has many things added that should have not been added at all"): WhatsApp group posts,
// «ممكن» (maybe), «لا حول ولا قوة إلا بالله», the same message twice and Scout's own alert were to-dos / follow-ups; "Remind me to X" kept its words.
const A = await import("../../web-src/autopilot.js"), K = await import("../../web-src/commands.js");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const now = Date.parse("2026-11-14T18:00:00"), wa = (title, text, id = Math.random()) => ({ id: String(id), app: "WhatsApp", pkg: "com.whatsapp", title, text, ts: now - 60000 });
const todo = (n) => { const x = A.suggestFrom(n, { now }); return x && x.kind === "todo" ? x : null; };
// the phone's own cases
ok(!todo(wa("🏠ADDRESS EAST MARKETPLACE: ~Rowan Soliman", "صباح الخير، فى حد قريبى مهتم يشترى و كان بيدور لو متاح للبيع، ممكن تبعتلي")), "a group post (ADDRESS EAST MARKETPLACE) is never a to-do, even with «ممكن تبعتلي»");
ok(!todo(wa("صيانة الاوناش في الضبعة: M. Mohamed Sayed Depak", "وكده كده ممكن بكرة اجرب جزء الصيانة اللي هو عمله ده ونشوف هينفعنا ازاي")), "the cranes group: not a to-do");
ok(!todo(wa("M. Mohamed Sayed Depak", "وكده كده ممكن بكرة اجرب جزء الصيانة اللي هو عمله ده ونشوف هينفعنا ازاي")), "«ممكن بكرة اجرب» = maybe — not a to-do even from one person");
ok(!todo(wa("🏠ADDRESS EAST OWNERS 🏠: Dr Hazem Wagdy (Admin , Address East)", "لا حول و لا قوة إلا بالله\nحضرتك توجهى")), "ADDRESS EAST OWNERS (group) — not a follow-up");
ok(!todo(wa("Hazem", "لا حول ولا قوة الا بالله")), "«لا حول ولا قوة إلا بالله» is a saying, not «حوّل»");
ok(!todo(wa("Talabat: Noudy", "please get me a tortilla")), "a group named Talabat: Noudy's request to the group is not your to-do");
ok(!todo(wa("Rowan Soliman", "~Rowan: can you send the file")), "~Name: in the text = a group");
// real requests still count
ok(!!todo(wa("Ahmed Salah", "ممكن تبعتلي الورق بكرة")), "«ممكن تبعتلي الورق» from one person is a to-do");
ok(!!todo(wa("Mama", "please call me when you're free")), "Mama: please call me → a to-do");
ok(!!todo(wa("Sara", "حول لي ٥٠٠ النهارده")), "«حول لي ٥٠٠» is still a request");
ok(!!todo(wa("Work group: Omar", "@Ali please send the report")), "a group post that @-mentions someone can still be a to-do");
// the same message twice → one key
ok(todo(wa("Mama", "please call me", 1)).key === todo(wa("Mama (2 messages)", "please call me", 2)).key, "the same message twice = one to-do");
// the clean-up of what was saved before
const saved = [
  { id: "1", source: "scout", title: "Scout: 1 strong new find — Hyundai Tucson 2022 used", at: now - 3600e3 },
  { id: "2", source: "autopilot", title: "M. Mohamed Sayed Depak: وكده كده ممكن بكرة اجرب جزء الصيانة", at: now },
  { id: "3", source: "autopilot", title: "🏠ADDRESS EAST MARKETPLACE: ~Rowan Soliman: صباح الخير، فى حد قريبى مهتم يشترى", at: now },
  { id: "4", source: "autopilot", title: "🏠ADDRESS EAST MARKETPLACE: ~Rowan Soliman: صباح الخير، فى حد قريبى مهتم يشترى", at: now },
  { id: "5", source: "autopilot", title: "🏠ADDRESS EAST OWNERS 🏠: Dr Hazem Wagdy (Admin , Address East): لا حول و لا قوة إلا بالله حضرتك توجهى", at: now },
  { id: "6", source: "autopilot", title: "Talabat: Noudy requested a tortilla.", at: now },
  { id: "7", source: "autopilot", title: "Mama: please call me back", at: now },
  { id: "8", source: "autopilot", title: "Mama: please call me back", at: now },
  { id: "9", source: "autopilot", title: "Call back Mama", at: now },
  { id: "10", source: "life", title: "Due: Maid", at: now },
  { id: "11", source: "home", title: "Call the bank", at: now } ];
const c = A.cleanAutoTodos(saved);
ok(JSON.stringify(c.gone) === JSON.stringify(["1", "2", "3", "4", "5", "6", "8"]), "the clean-up takes off Scout, the group posts, the 'maybe', the duplicate: " + c.gone);
ok(c.keep.map((r) => r.id).join() === "7,9,10,11", "…and keeps the real request, the call back, Due: Maid and what you typed");
// "Remind me to …" keeps only the to-do
for (const [a, b] of [["Remind me to try aldibiki website", "Try aldibiki website"], ["Remind me to hear the voice notes of the apps and websites group", "Hear the voice notes of the apps and websites group"],
  ["remind me to ask about maid in address east", "Ask about maid in address east"], ["don't let me forget to buy milk", "Buy milk"], ["فكرني اني اكلم ماما", "اكلم ماما"], ["Call back Mama", "Call back Mama"]])
  ok(K.cleanTodo(a) === b, `«${a}» → «${K.cleanTodo(a)}» (want «${b}»)`);
// the generator (10,000 chat notifications) and its held-out phrasings, 2,500 samples each
{ const { execFileSync } = await import("child_process"); const run = (env = {}) => +((/\(([\d.]+)%\)/.exec(execFileSync("node", [new URL("../todojunk/gen.mjs", import.meta.url).pathname, "2500"], { env: { ...process.env, ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })) || [0, 0])[1]);
  const a = run(), h = run({ HELDOUT: "1" }); ok(a === 100, "chat to-dos, 2,500 sample: " + a + "%"); ok(h >= 99, "held-out phrasings, 2,500 sample: " + h + "% (the mark: 99%)"); }
console.log(fail ? `FAIL ${fail} of ${n}` : `ALL PASSED (${n} checks)`);
process.exit(fail ? 1 : 0);
