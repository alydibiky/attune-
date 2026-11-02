// v9.0 (Ali: "99 percent accurate"): reminders land at the exact minute and repeat (now = Mon 2 Nov 2026, 8 pm).
import { quickAction } from "../../web-src/actions.js";
const now = Date.parse("2026-11-02T20:00:00");   // Monday
const d = (t) => { if (!t) return "none"; const x = new Date(t); return `${x.getMonth() + 1}/${x.getDate()} ${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`; };
const C = [
 ["remind me tomorrow at 9 to call the bank", "11/3 09:00", "none"], ["remind me at 9 to call the bank", "11/2 21:00", "none"], ["remind me at 9am tomorrow", "11/3 09:00", "none"],
 ["remind me in 20 minutes to take the food out", "11/2 20:20", "none"], ["remind me in 2 hours", "11/2 22:00", "none"], ["remind me in an hour to check the oven", "11/2 21:00", "none"],
 ["remind me tonight at 10 to lock the car", "11/2 22:00", "none"], ["remind me next Monday to renew my car license", "11/9 09:00", "none"], ["remind me on Thursday at 5 for the dentist", "11/5 17:00", "none"],
 ["remind me on the 25th to pay the rent", "11/25 09:00", "none"], ["remind me on 1 December to pay the school fees", "12/1 09:00", "none"], ["remind me every friday to call my grandmother", "11/6 09:00", "weekly"],
 ["remind me every day at 8 pm to take my medicine", "11/3 20:00", "daily"], ["remind me on the last day of each month to pay interest for mom", "11/30 09:00", "lastday"], ["wake me up at 7", "11/3 07:00", "none"],
 ["set an alarm for 6:30", "11/3 06:30", "none"], ["wake me up at 5:45 tomorrow", "11/3 05:45", "none"], ["remind me at 3 to pick up the kids", "11/3 15:00", "none"],
 ["فكرني بكرة الساعة 9 اكلم ماما", "11/3 09:00", "none"], ["فكرني بعد ساعتين اشرب الدوا", "11/2 22:00", "none"], ["فكرني بعد نص ساعة", "11/2 20:30", "none"], ["صحيني الساعة 6 ونص", "11/3 06:30", "none"],
 ["فكرني يوم الخميس ادفع للشغالة", "11/5 09:00", "none"], ["فكرني كل يوم الساعة 8 بالليل اخد الدوا", "11/3 20:00", "daily"], ["فكرني يوم 25 من كل شهر ادفع الإيجار", "11/25 09:00", "monthly"],
 ["فكرني الساعة 3 العصر اجيب الولاد", "11/3 15:00", "none"], ["فكرني بكرة الصبح الساعة 10", "11/3 10:00", "none"], ["صحيني 5 الفجر", "11/3 05:00", "none"], ["فكرني آخر يوم في كل شهر", "11/30 09:00", "lastday"],
 ["remind me every Sunday and Wednesday at 7 to go to the gym", "11/4 07:00", "days:0,3"],
];
let bad = 0;
for (const [s, at, rep] of C) { const a = quickAction(s, now); const ok = d(a.at) === at && (a.repeat || "none") === rep; if (!ok) { bad++; console.log(`FAIL ${s}\n    got ${d(a.at)} ${a.repeat} · want ${at} ${rep} · problems ${JSON.stringify(a.problems)}`); } }
console.log(bad ? bad + " FAILED" : `PASS v909times: ${C.length} reminders at the exact time and repeat`);
