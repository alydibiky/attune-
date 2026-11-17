// v10.2 — Ali's 17 Nov list (computer + phone), each kept as a test: the Claude sign-in link email was saved in Dates like a
// subscription; the Home card said "36 tools" and its page showed 3.
import { execFileSync } from "child_process";
import fs from "fs";
import * as D from "../../web-src/deadlines.js";
import * as M from "../../web-src/notifmind.js";
import * as O from "../../web-src/overpay.js";
import * as W from "../../web-src/notifwords.js";
import { shownToolGroups, toolCount } from "../../web-src/hubs.js";
import * as CR from "../../web-src/chatroles.js";
import * as AP from "../../web-src/autopilot2.js";
import * as PL from "../../web-src/paylog.js";
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const now = Date.UTC(2026, 10, 17, 0, 45);
const claude = "Secure link to log in to Claude.ai\nClick the link below to log in to Claude.ai. This link will expire in 1 hour and can only be used once.";
const claude2 = "Sign in to Claude\nUse the secure link below to sign in. The link expires on 18 Nov 2026.";
for (const t of [claude, claude2]) {
  ok(D.readDeadlines(t, { now }).length === 0, "a Claude sign-in link is not a date: " + JSON.stringify(D.readDeadlines(t, { now })));
  ok(D.fromNotifications([{ id: 1, app: "Gmail", title: "Anthropic", text: t, ts: now }], [], { now }).length === 0, "…not from the notification either");
  ok(O.readSource({ id: "e1", kind: "email", title: "Claude", text: t, at: now }, { now }).length === 0, "…and not a subscription in the Overpaying check");
  const m = M.comprehend({ app: "Gmail", pkg: "com.google.android.gm", title: "Anthropic", text: t }, { now });
  ok(m.cat === "code" && m.action === "none" && !m.due, "…read as a login code, nothing to do: " + m.cat + "/" + m.action);
}
ok(D.readDeadlines("Your Claude Pro subscription renews on 5 Dec 2026. Sign in to manage it.", { now }).some((x) => x.kind === "renewal"), "a real renewal that says “sign in” is still a date");
ok(M.comprehend({ app: "Gmail", pkg: "com.google.android.gm", title: "Google", text: "New sign-in to your account on Windows. Was this you?" }, { now }).cat !== "code", "“new sign-in — was this you?” stays a security alert");
ok(!W.isSignInMessage("Your passport expires on 3 Dec 2026") && W.isSignInMessage("رابط تسجيل الدخول — الرابط صالح لمدة 15 دقيقة"), "isSignInMessage");
ok(D.dropSignIns({ items: [{ id: "a", source: "notification", note: claude }, { id: "b", source: "typed", note: claude }, { id: "c", source: "notification", note: "Netflix renews on 5 Dec 2026" }] }).items.map((x) => x.id).join() === "b,c", "his old wrong item is taken out of Dates");
// Ali's Orders group: "It's a group I put on all orders I buy" — Change did nothing (17 Nov, 15:21)
const od = CR.readDescription("It's a group I put on all orders I buy");
ok(od && od.role === "orders" && CR.understood(od, "Orders")[0].t.includes("record of the orders"), "his words → a record of the orders he buys: " + JSON.stringify(od));
ok(CR.readDescription("جروب بحط فيه كل الطلبات اللي بشتريها").role === "orders", "…the same in Egyptian Arabic is not a shopping list");
ok(CR.readDescription("our shopping list").role === "shopping" && CR.readDescription("الحاجات اللي خلصت في البيت").role === "shopping", "a real shopping list stays a shopping list");
const dn = AP.decide({ id: "o1", app: "WhatsApp", pkg: "com.whatsapp", title: "Orders", text: "Toilet paper, kitchen tissues, rice", group: true, convo: "Orders", who: "Ali", ts: Date.now() },
  { roles: { "whatsapp|g:orders": { ...od, ok: true } } });
ok(dn && dn.kind === "keep", "a message in his Orders group is kept — never added to a list: " + JSON.stringify(dn && dn.kind));
// …and for good: after Change there is always an answer (code → the phone's AI → the kinds to tap), and what he teaches is kept
ok(CR.nextStep(null, false) === "pick" && CR.nextStep({ role: "" }, true) === "model" && CR.nextStep(od, true) === "code", "Change always goes somewhere — never nothing");
ok(CR.readDescModel('{"role":"orders","care":[],"whenMe":false}').role === "orders" && CR.readDescModel('{"role":"banana"}') === null, "the AI's answer is checked: only a real kind is kept");
{ const st = { m: {}, getItem(k) { return this.m[k] || null; }, setItem(k, v) { this.m[k] = v; } };
  CR.learnDescription("the bag of everything I get from Amazon", { role: "orders" }, st);
  ok(CR.readDescription("The bag of everything I get from Amazon!", CR.loadLearned(st)).role === "orders", "taught once → understood next time, written a little differently"); }
{ const out = execFileSync("node", [new URL("../chatroles/never.mjs", import.meta.url).pathname, "2500"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const p = +((/\(([\d.]+)%\)/.exec(out) || [])[1] || 0); ok(p === 100, "10,000 descriptions never stuck, 2,500 sample: " + p + "%"); }
// Ali's own CIB messages, word for word (17 Nov 2026) — Money reads each payment; the balance is never the amount; CIB's own offer is no payment and no scam
{ const sms = (t) => ({ id: "c" + t.length, app: "Messages", pkg: "com.google.android.apps.messaging", title: "CIB", text: t, ts: Date.parse("2026-11-17T13:56:00") });
  const CIB = [["يرجى العلم انه تم تنفيذ تحويل لحظي بمبلغ 1160.00 جم من حسابك المنتهي بـ ********9279 برقم مرجعي ebe405c0 بتاريخ 2026-11-17 13:56 للمزيد، برجاء الاتصال بـ 19666", 1160, ""],
    ["تم خصم مبلغ EGP 800.00  من بطاقة الخصم المباشر المنتهية بـ **8251 عند FACES في 16/11/26 17:06 ، الرصيد المتاح EGP 1105065.40", 800, "FACES"],
    ["يرجى العلم انه تم تنفيذ تحويل لحظي بمبلغ 100.00 جم من حسابك المنتهي بـ ********9279 برقم مرجعي f50c9d30 بتاريخ 2026-11-16 19:46 للمزيد، برجاء الاتصال بـ 19666", 100, ""],
    ["يرجى العلم انه تم تنفيذ تحويل لحظي بمبلغ 80.00 جم من حسابك المنتهي بـ ********9279 برقم مرجعي ed6a371c بتاريخ 2026-11-16 21:37 للمزيد، برجاء الاتصال بـ 19666", 80, ""]];
  for (const [t, a, party] of CIB) { const r = PL.readNotification(sms(t), { home: "EGP" }), m = M.comprehend(sms(t));
    ok(r && r.amount === a && r.currency === "EGP" && r.direction === "out" && (!party || r.party === party) && m.amount && m.amount.dir === "out", "CIB " + a + " EGP → money out" + (party ? " at " + party : "") + ": " + JSON.stringify(r && [r.amount, r.direction, r.party]) + " / " + JSON.stringify(m.amount)); }
  const ad = "استمتع ببطاقة CIB Platinum الائتمانية والتي تتيح لك ٦٪ من قيمة مشترياتك في صورة نقاط SHARE لدى وجهات ماجد الفطيم، بحد أقصى ٣،٠٠٠ جم شهريًا. لمعرفة المزيد، اضغط هنا: https://cib.eg/0p1z أو تواصل مع مدير علاقات CIB Wealth الخاص بك. لا تشارك بياناتك البنكية مع أي شخص. تُطبق الشروط والأحكام. رقم التسجيل الضريبي: ٢٠٤-٨٩١-٩٤٩";
  const am = M.comprehend(sms(ad));
  ok(PL.readNotification(sms(ad), { home: "EGP" }) === null && am.cat !== "code" && am.intent !== "alert", "CIB's own Platinum offer: no payment, not a login code, not a scam (" + am.cat + "/" + am.intent + ")");
  ok(W.isScam("حسابك هيتوقف اضغط هنا https://cib-eg.help/x", "CIB"), "…but a fake link that only looks like CIB's is still a scam"); }
// HARD and unique (Ali, 17 Nov: "harder and all unique"): the notification run with real-world changes and composed bank messages
{ const out = execFileSync("node", [new URL("../notifs/gen.mjs", import.meta.url).pathname, "2500"], { env: { ...process.env, HARD: "1" }, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const p = +((/handled right \(([\d.]+)%\)/.exec(out) || [])[1] || 0), fm = +((/NOT a payment: \*\*(\d+)\*\*/.exec(out) || [])[1] ?? 99), sh = +((/\[(\d+) of 100\]/.exec(out) || [])[1] || 0);
  ok(p >= 99 && fm === 0, "HARD notifications, 2,500 sample: " + p + "% right, " + fm + " became money that were not payments");
  ok(sh >= 35, "…and they are different from each other: " + sh + " different shapes in 100 (the old run: 13)"); }
// tools: the count on Home = what the page lists
const groups = [["A", ["lists", "money", "crane"]], ["B", ["lists", "fit"]]];
const shown = shownToolGroups(groups, ["lists", "money", "crane", "fit"], (id) => id === "crane");
ok(toolCount(shown) === 3 && JSON.stringify(shown) === JSON.stringify([["A", ["lists", "money"]], ["B", ["fit"]]]), "each tool once, hidden ones out: " + JSON.stringify(shown));
const app = fs.readFileSync(new URL("../../web-src/attune.jsx", import.meta.url), "utf8"), desk = fs.readFileSync(new URL("../../web-src/desk-ui.jsx", import.meta.url), "utf8");
ok(/toolsN=\{toolCount\(groupsShown\)\}/.test(app) && /groups=\{groupsShown\}/.test(app), "Home counts and Tools lists the same groups");
ok(/data-testid="tools-every"/.test(desk), "the Tools page has “Every tool” under the families");
const run = (env = {}) => +((/\(([\d.]+)%\)/.exec(execFileSync("node", [new URL("../signin/gen.mjs", import.meta.url).pathname, "2500"], { env: { ...process.env, ...env }, encoding: "utf8" })) || [])[1] || 0);
const a0 = run(), h0 = run({ HELDOUT: "1" });
ok(a0 === 100, "10,000 sign-in / real-deadline messages, 2,500 sample: " + a0 + "%"); ok(h0 >= 99, "held-out, 2,500 sample: " + h0 + "% (the mark: 99%)");
console.log(fail ? `FAIL ${fail} of ${n}` : `ALL PASSED (${n} checks)`);
process.exit(fail ? 1 : 0);
