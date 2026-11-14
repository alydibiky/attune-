// v9.9.34 Free / Pro (Ali picked FP-4, PM-1, PM-2, PM-4; OK-1 "Don't remove undo"): the 10,000 generator on a 2,500 sample, held-out
// cases written after the fixes, and every screen wired to plan.js.
import { execFileSync } from "child_process";
import fs from "fs";
const mem = {}; globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const P = await import("../../web-src/plan.js");
const B = await import("../../web-src/billing.js");
const ok = (c, t) => { console.log((c ? "PASS " : "FAIL ") + t); if (!c) process.exitCode = 1; };
const out = execFileSync("node", [new URL("../plan/gen.mjs", import.meta.url).pathname, "2500"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
ok(/2500 situations, 2500 right/.test(out), "2,500 generated situations all right: " + out.split("\n")[0]);
// held-out
const now = Date.parse("2026-11-13T10:00:00");   // a Friday
ok(P.allowed("money", false) && P.allowed("reminders", false) && P.allowed("chat", false), "Free: money, reminders, Chat — never locked");
ok(!P.allowed("autoMoney", false) && P.allowed("autoMoney", true), "bank messages saved by themselves: Pro only");
for (let i = 0; i < 3; i++) P.noteUse("photo", now);
ok(!P.canUse("photo", { pro: false, now }).ok && P.canUse("photo", { pro: true, now }).ok, "the 4th photo read today: Free stops, Pro goes on");
ok(P.canUse("photo", { pro: false, now: now + 86400000 }).ok, "…tomorrow Free reads again");
P.noteUse("photo", now - 86400000);
ok(P.usedToday("photo", now) === 3, "a use stamped on another day never changes today's count (the bug the 10,000 run found)");
ok(P.historyFrom(now, false) === "2026-09-01" && P.historyFrom(now, true) === "", "Free shows September, October, November; Pro every year");
ok(P.canUse("agents", { pro: false, count: 1 }).ok === false && P.canUse("papers", { pro: false, count: 9 }).ok === true && P.canUse("papers", { pro: false, count: 10 }).ok === false, "1 agent, 10 papers");
localStorage.setItem("attune:auto:v1", JSON.stringify({ rules: [{ id: "a" }] }));
ok(!P.ruleRoom(1, false) && P.ruleRoom(1, true), "with 1 automation on, Free can't add a 2nd rule; Pro can");
localStorage.setItem("attune:auto:v1", JSON.stringify({ rules: [] }));
ok(P.ruleRoom(1, false) && !P.ruleRoom(2, false), "none on: Free may add 1, not 2 at once");
ok(P.showTypedNudge({ pro: false, typed: 5, now, st: {} }) && !P.showTypedNudge({ pro: true, typed: 9, now, st: {} }) && !P.showTypedNudge({ pro: false, typed: 5, dueToday: 1, now, st: {} }), "PM-1: Free with 5 typed — yes; Pro — never; a due day — never");
const st = P.noteShown("typed", { now, notNow: true });
ok(!P.showTypedNudge({ pro: false, typed: 7, now: now + 3 * 86400000, st }) && P.showTypedNudge({ pro: false, typed: 7, now: now + 15 * 86400000, st }), "“Not now” = quiet for 14 days");
ok(P.showWeekCard({ now, st: {} }) && !P.showWeekCard({ now: now - 86400000, st: {} }), "PM-2: Friday yes, Thursday no");
const w = P.weekStats({ txns: [{ type: "expense", date: "2026-11-12" }, { type: "expense", date: "2026-11-12", source: "notification" }, { type: "expense", date: "2026-11-01" }] }, [{ created: now - 3600000 }], now);
ok(w.typed === 1 && w.fromMsgs === 1 && w.reminders === 1, "this week: 1 typed, 1 from messages, 1 reminder (an old one not counted)");
// the Plan page says FP-4
ok(/saved by themselves, with Undo/.test(B.PRO_BENEFITS[0]), "Pro's first benefit: saved by themselves, WITH Undo (Ali: don't remove undo)");
ok(B.COMPARE_ROWS.some((r) => /Bank messages/.test(r[0]) && /Asks you/.test(r[1]) && /with Undo/.test(r[2])), "the table: Free asks each time · Pro by itself, with Undo");
// every screen wired
const src = (f) => fs.readFileSync(new URL("../../web-src/" + f, import.meta.url), "utf8");
ok(/allowed\("autoMoney"\)/.test(src("paylog-ui.jsx")), "Money's auto-save asks plan.js");
ok(/canUse\("photo"\)/.test(src("photogate.js")) && /noteUse\("photo"\)/.test(src("photogate.js")), "every photo read counts and is limited in one place");
ok(/proGate\("weekPlan"/.test(src("weekplan-ui.jsx")) && /proGate\("msgSchedule"/.test(src("messages-ui.jsx")) && /proGate\("sync"/.test(src("sync-ui.jsx")) && /proGate\("moneyForTwo"/.test(src("moneyshare-ui.jsx")), "week plan, scheduled messages, sync and Money for two show “Part of Pro” in Free");
ok(/allowed\("closeDay"\)/.test(src("yourday-ui.jsx")), "Close the day is Pro");
ok(/ruleRoom\(/.test(src("rules-ui.jsx")) && /ruleRoom\(/.test(src("autom-ui.jsx")), "rules and automations check the 1-rule limit");
ok(/LIMITS\.xray/.test(src("chatxray-ui.jsx")) && /LIMITS\.convert/.test(src("convert-ui.jsx")) && /FREE_PER_DAY = 3/.test(src("slides-ui.jsx")), "X-Ray, conversions, slides: 3 a day");
ok(/FREE_LIMIT = 10/.test(src("deadlines.js")), "papers with dates: 10");
ok(/setProNow\(proActive\)/.test(src("attune.jsx")) && /historyFrom\(\)/.test(src("attune.jsx")) && /allowedPlan\("pdfExport"\)/.test(src("attune.jsx")), "attune.jsx sets Pro for everyone, limits history and exports");
