// v9.7 Messages like Auto Text (Ali picked M3 + S1 + S2 + S3): repeats, links per app, auto-reply rules
import assert from "node:assert/strict";
const M = await import("../../web-src/msgsched.js");
const at = new Date(2026, 1, 3, 9, 0).getTime();   // 3 Feb 2026 9:00
const after = new Date(2026, 10, 6, 13, 0).getTime();
const y = new Date(M.nextAt(at, "yearly", after)); assert.deepEqual([y.getFullYear(), y.getMonth(), y.getDate(), y.getHours()], [2027, 1, 3, 9], "yearly: next 3 Feb 2027, 9:00");
const m31 = new Date(2026, 0, 31, 20).getTime(), mm = new Date(M.nextAt(m31, "monthly", new Date(2026, 1, 1).getTime()));
assert.equal(mm.getDate(), 28, "monthly on the 31st → the month's last day (28 Feb)");
assert.equal(M.nextAt(at, "none", after), null, "once, passed → nothing");
assert.equal(new Date(M.nextAt(at, "weekly", at + 1)).getDate(), 10);
assert.equal(M.linkFor({ app: "whatsapp", phone: "+20 100 123 4431", text: "كل سنة وانتي طيبة" }), "https://wa.me/201001234431?text=" + encodeURIComponent("كل سنة وانتي طيبة"));
assert.ok(M.linkFor({ app: "sms", phone: "0100", text: "hi" }).startsWith("smsto:0100?body=hi"));
assert.ok(M.linkFor({ app: "email", email: "a@b.com", subject: "Site", text: "x" }).startsWith("mailto:a%40b.com?subject=Site"));
assert.ok(M.linkFor({ app: "telegram", phone: "201", text: "x" }).startsWith("tg://resolve?phone=201"));
assert.deepEqual(M.missing({ app: "sms", who: "Ahmed", text: "x", at: after + 1 }, after), ["Their phone number"]);
assert.deepEqual(M.missing({ app: "whatsapp", who: "Mama", text: "x", at: after - 1, repeat: "yearly" }, after), [], "a repeating message may start in the past");
assert.equal(M.appIn("sms Ahmed tomorrow at 5"), "sms"); assert.equal(M.appIn("ابعت لماما على تليجرام"), "telegram"); assert.equal(M.appIn("send Mama"), "whatsapp");
assert.equal(M.repeatIn("send Mama every year on 3 Feb"), "yearly"); assert.equal(M.repeatIn("ابعت للشيخ كل شهر"), "monthly");
// auto-reply rules
const r = M.newRule({ ...M.RULE_PRESETS[2] }, 1);   // night 23:00–07:00
assert.ok(M.ruleFits(r, { app: "whatsapp", who: "Ahmed", key: "k1" }, { now: new Date(2026, 10, 6, 23, 30).getTime() }), "night rule at 23:30");
assert.ok(M.ruleFits(r, { app: "whatsapp", who: "Ahmed" }, { now: new Date(2026, 10, 7, 6, 59).getTime() }), "…and at 06:59 (over midnight)");
assert.ok(!M.ruleFits(r, { app: "whatsapp", who: "Ahmed" }, { now: new Date(2026, 10, 7, 12, 0).getTime() }), "not at noon");
assert.ok(!M.ruleFits(r, { app: "whatsapp", who: "Family", group: true }, { now: new Date(2026, 10, 6, 23, 30).getTime() }), "never to groups unless allowed");
const day = new Date(2026, 10, 6, 23, 30);
assert.ok(!M.ruleFits(r, { app: "whatsapp", who: "Ahmed", key: "k1" }, { now: day.getTime(), replied: { [r.id + "|k1"]: day.toDateString() } }), "once per person per day");
const only = M.newRule({ text: "x", who: "only", list: ["Mama"] }, 2);
assert.ok(M.ruleFits(only, { app: "whatsapp", who: "Mama" }, {}) && !M.ruleFits(only, { app: "whatsapp", who: "Karim" }, {}), "only these people");
const sil = M.newRule({ text: "x", mode: "silent" }, 3);
assert.ok(!M.ruleFits(sil, { app: "sms", who: "A" }, { silent: false }) && M.ruleFits(sil, { app: "sms", who: "A" }, { silent: true }), "only while the phone is on silent");
assert.ok(!M.ruleFits(M.newRule({ text: "x", apps: ["whatsapp"] }, 4), { app: "telegram", who: "A" }, {}), "only the apps chosen");
console.log("ALL PASSED v970messages (24 checks)");
