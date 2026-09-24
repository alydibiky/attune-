// Unit tests for web-src/actions.js (time parsing, action building).
// Run: node tests/unit/run.mjs   (bundles with the page's esbuild, then runs)
import { parseTime, parseDuration, normalizePhone, looksLikeAction, buildAction, quickAction, nextOccurrence } from "../../web-src/actions.js";

const NOW = new Date(2026, 8, 24, 8, 22).getTime();   // Thu 24 Sep 2026 08:22
const fails = [];
const fmt = (ms) => { if (ms == null) return "null"; const d = new Date(ms); const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
function eq(got, want, what) { const ok = got === want; console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${got}, want ${want}`)); if (!ok) fails.push(what); }

const T = (s) => { const r = parseTime(s, NOW); return r ? fmt(r.at) : "null"; };
eq(T("remind me tomorrow at 9 to call Ahmed"), "2026-09-25 09:00", "tomorrow at 9");
eq(T("in 20 minutes"), "2026-09-24 08:42", "in 20 minutes");
eq(T("in 2 hours"), "2026-09-24 10:22", "in 2 hours");
eq(T("in half an hour"), "2026-09-24 08:52", "in half an hour");
eq(T("at 5"), "2026-09-24 17:00", "'at 5' means 5 pm");
eq(T("at 7:30"), "2026-09-24 19:30", "'at 7:30' (morning already passed) → this evening");
eq(T("at 17:30"), "2026-09-24 17:30", "at 17:30");
eq(T("tomorrow morning"), "2026-09-25 09:00", "tomorrow morning");
eq(T("tonight at 8"), "2026-09-24 20:00", "tonight at 8");
eq(T("on Monday at 10am"), "2026-09-28 10:00", "on Monday at 10am");
eq(T("thursday"), "2026-10-01 09:00", "'Thursday' said on a Thursday = next week");
eq(T("on 5/10 at 11"), "2026-10-05 11:00", "5/10 at 11 (day/month)");
eq(T("25 Dec"), "2026-12-25 09:00", "25 Dec");
eq(T("hello there"), "null", "no time in it");
// Egyptian Arabic
eq(T("فكرني بكرة الساعة 9 اكلم أحمد"), "2026-09-25 09:00", "بكرة الساعة 9");
eq(T("بعد 20 دقيقة"), "2026-09-24 08:42", "بعد 20 دقيقة");
eq(T("بعد ساعة"), "2026-09-24 09:22", "بعد ساعة");
eq(T("بعد ساعتين"), "2026-09-24 10:22", "بعد ساعتين");
eq(T("بعد نص ساعة"), "2026-09-24 08:52", "بعد نص ساعة");
eq(T("الساعة ٥ العصر"), "2026-09-24 17:00", "الساعة ٥ العصر (Arabic digits)");
eq(T("النهارده الساعة 8 بالليل"), "2026-09-24 20:00", "النهارده الساعة 8 بالليل");
eq(T("بكرة الصبح"), "2026-09-25 09:00", "بكرة الصبح");
eq(T("يوم الاتنين الساعة 10"), "2026-09-28 10:00", "يوم الاتنين الساعة 10");
eq(T("بعد بكرة الساعة 3"), "2026-09-26 15:00", "بعد بكرة الساعة 3");
eq(T("الساعة 9 ونص"), "2026-09-24 09:30", "الساعة 9 ونص");
eq(T("الساعة 10 الا ربع"), "2026-09-24 09:45", "الساعة 10 الا ربع");
eq(T("صحيني الساعة 6 الصبح"), "2026-09-25 06:00", "صحيني الساعة 6 الصبح (already passed → tomorrow)");
eq(T("25 سبتمبر"), "2026-09-25 09:00", "25 سبتمبر");
// durations and phones
eq(parseDuration("set a timer for 10 minutes"), 600, "timer 10 minutes");
eq(parseDuration("تايمر ربع ساعة"), 900, "تايمر ربع ساعة");
eq(parseDuration("1 hour 30 min"), 5400, "1 hour 30 min");
eq(normalizePhone("0100 123 4567"), "201001234567", "Egyptian mobile → 20…");
eq(normalizePhone("+971 50 123 4567"), "971501234567", "+971 number");
eq(normalizePhone("12"), "", "too short is not a phone");
// detection
eq(looksLikeAction("remind me tomorrow at 9 to call Ahmed"), true, "detects remind me");
eq(looksLikeAction("فكرني بكرة اكلم المهندس"), true, "detects فكرني");
eq(looksLikeAction("What is the load chart of an LTM 1100?"), false, "a normal question is not an action");
eq(looksLikeAction("how do alarms work on android?"), false, "a question about alarms is not a request");
// building
let a = buildAction({ action: "reminder", title: "Call Ahmed", time_text: "tomorrow at 9", when: "", repeat: "none", minutes: 0, contact: "Ahmed", phone: "", message: "", place: "" }, "remind me tomorrow at 9 to call Ahmed", NOW);
eq(a.kind + " " + fmt(a.at) + " " + a.problems.length, "reminder 2026-09-25 09:00 0", "model JSON + words → reminder, no problems");
a = buildAction({ action: "reminder", title: "x", time_text: "", when: "4888-66-58T98:84" }, "remind me about the thing", NOW);
eq(a.at, null, "an impossible date from the model is rejected");
eq(a.problems.length > 0, true, "…and the card asks when");
a = quickAction("صحيني الساعة 6 الصبح", NOW);
eq(a.kind + " " + fmt(a.at), "alarm 2026-09-25 06:00", "no model: صحيني → alarm 06:00");
a = quickAction("ابعت لمحمود على الواتساب 01001234567 إني هتأخر نص ساعة", NOW);
eq(a.kind + " " + a.phone + " " + a.message, "whatsapp 201001234567 هتأخر نص ساعة", "no model: WhatsApp with number and message");
a = quickAction("set a timer for 15 minutes", NOW);
eq(a.kind + " " + a.durationSec, "timer 900", "no model: timer 15 min");
a = quickAction("remind me every day at 8 to check the cranes", NOW);
eq(a.repeat + " " + fmt(a.at), "daily 2026-09-24 20:00", "every day at 8 → daily (8 pm, 8 am has passed)");
eq(fmt(nextOccurrence({ at: new Date(2026, 8, 24, 7, 0).getTime(), repeat: "weekdays" }, NOW)), "2026-09-27 07:00", "weekdays skips Fri+Sat (Egypt)");

console.log(fails.length ? fails.length + " FAILED" : "ALL PASSED");
process.exit(fails.length ? 1 : 0);
