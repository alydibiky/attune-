// v9.9.40 AP-2 (the new Autopilot): which chat, who wrote it, group or not, noise or not — 2,500 samples of the generator and its
// held-out set, plus Ali's own notifications from his screenshots.
import { execFileSync } from "child_process";
const C = await import("../../web-src/chats.js");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const run = (env = {}) => +((/\(([\d.]+)%\)/.exec(execFileSync("node", [new URL("../chats/gen.mjs", import.meta.url).pathname, "2500"], { env: { ...process.env, ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })) || [0, 0])[1]);
const a = run(), h = run({ HELDOUT: "1" });
ok(a === 100, "10,000 notifications, 2,500 sample: " + a + "%"); ok(h >= 99, "held-out, 2,500 sample: " + h + "% (the mark: 99%)");
const wa = (title, text) => ({ app: "WhatsApp", pkg: "com.whatsapp", title, text });
const t1 = C.chatOf(wa("Talabat", "Noudy: tortilla"));
ok(t1.group && t1.chat === "Talabat" && t1.who === "Noudy" && t1.text === "tortilla", "Talabat / “Noudy: tortilla” → the Talabat group, Noudy wrote “tortilla” (the one that slipped through)");
const t2 = C.chatOf(wa("🏠ADDRESS EAST MARKETPLACE: ~Rowan Soliman", "صباح الخير، فى حد قريبى مهتم يشترى"));
ok(t2.group && t2.chat === "🏠ADDRESS EAST MARKETPLACE" && t2.who === "Rowan Soliman", "Address East Marketplace / ~Rowan Soliman → the group, Rowan");
const t3 = C.chatOf(wa("🏠ADDRESS EAST OWNERS 🏠: Dr Hazem Wagdy (Admin , Address East)", "لا حول و لا قوة إلا بالله"));
ok(t3.group && t3.who === "Dr Hazem Wagdy (Admin , Address East)", "Address East Owners / Dr Hazem (Admin , Address East) → the group, Dr Hazem");
const t4 = C.chatOf(wa("Mama (2 messages)", "call me when you're free"));
ok(!t4.group && t4.chat === "Mama", "Mama (2 messages) → Mama, one person");
ok(!C.chatOf(wa("Mama", "Note: the gas man comes at 2")).group, "“Note: …” from Mama is not a group");
const ph = C.chatOf({ app: "WhatsApp", pkg: "com.whatsapp", title: "Talabat", text: "tortilla", group: true, convo: "Talabat", who: "Noudy" });
ok(ph.group && ph.who === "Noudy" && ph.key === "whatsapp|g:talabat", "the phone's own fields are used as they are");
for (const [x, k] of [["📷 Photo", "media"], ["https://www.facebook.com/share/p/1abc", "link"], ["صباح الخير 🌹", "greeting"], ["😂😂", "emoji"], ["تمام", "ack"], ["This message was deleted", "deleted"]]) ok(C.noiseOf(x) === k, `«${x}» is noise (${k})`);
for (const x of ["tortilla", "chicken strips", "اللبن خلص", "the garage gate is closed till Saturday", "send me the invoice please"]) ok(C.noiseOf(x) === null, `«${x}» is a real message`);
console.log(fail ? `FAIL ${fail} of ${n}` : `ALL PASSED (${n} checks)`);
process.exit(fail ? 1 : 0);
