// v6.32 prayer-aware planner: prayer times by the sun; tasks from a sentence; a day planned around the prayers.
import * as P from "../../web-src/prayer.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const near = (a, b, tol = 4) => Math.abs(a - b) <= tol;
const toMin = (s) => +s.slice(0, 2) * 60 + +s.slice(3);
// Cairo, 17 Oct 2026 (Egypt is on summer time, UTC+3, until the last Thursday of October) — Egyptian-method times ≈ Fajr 05:31 · Sunrise 06:57 · Dhuhr 12:40 · Asr 15:55 · Maghrib 18:21 · Isha 19:39 (sources differ by a minute or two)
const c = P.prayerTimes(new Date(Date.UTC(2026, 9, 17, 12)), 30.0444, 31.2357, 180, { method: "egypt" });
ok(near(c.fajr, toMin("05:31")) && near(c.sunrise, toMin("06:57")) && near(c.dhuhr, toMin("12:40")) && near(c.asr, toMin("15:55")) && near(c.maghrib, toMin("18:21")) && near(c.isha, toMin("19:39")),
  "Cairo's five prayers within a few minutes of the published times: " + [c.fajrAt, c.sunriseAt, c.dhuhrAt, c.asrAt, c.maghribAt, c.ishaAt].join(" "));
const h = P.prayerTimes(new Date(Date.UTC(2026, 9, 17, 12)), 30.0444, 31.2357, 180, { method: "egypt", asr: 2 });
ok(h.asr - c.asr > 40, "Hanafi Asr (shadow ×2) is later");
const mk = P.prayerTimes(new Date(Date.UTC(2026, 9, 17, 12)), 21.4225, 39.8262, 180, { method: "makkah" });
ok(mk.isha - mk.maghrib === 90, "Umm al-Qura: Isha 90 minutes after Maghrib");
ok(P.methodFor("Africa/Cairo") === "egypt" && P.methodFor("Asia/Riyadh") === "makkah" && P.methodFor("Europe/London") === "mwl", "the method follows the city");
const t = P.parseTasks("جيم ساعة، مذاكرة ساعتين، مكالمة ماما ربع ساعة");
ok(t.length === 3 && t[0].minutes === 60 && t[1].minutes === 120 && t[2].minutes === 15 && t[2].title === "مكالمة ماما", "«جيم ساعة، مذاكرة ساعتين، مكالمة ماما ربع ساعة» (" + JSON.stringify(t) + ")");
const e = P.parseTasks("groceries 30 min, gym 1.5h, call mum at 6pm");
ok(e.length === 3 && e[1].minutes === 90 && e[2].at === "18:00" && e[2].title === "call mum", "English tasks with a fixed time");
const d = P.planDay(P.parseTasks("study 2 hours, gym 1h, groceries 30 min"), c, { start: 10 * 60, end: 22 * 60 });
const overlaps = d.plan.some((p) => d.blocks.some((b) => p.from < b.to && p.to > b.from));
ok(d.plan.length === 3 && !overlaps && !d.left.length, "three tasks placed, none over a prayer: " + d.plan.map((p) => p.title + " " + p.fromAt + "–" + p.toAt).join(", "));
ok(d.plan[0].title === "study" && d.plan[0].fromAt === "10:00" && d.plan[0].to <= c.dhuhr, "study first, 10:00–12:00, before Dhuhr: " + d.plan[0].fromAt + "–" + d.plan[0].toAt);
const fr = P.planDay([{ title: "meeting", minutes: 30, at: "12:30" }], c, { friday: true });
ok(fr.plan[0].moved && fr.plan[0].from >= c.dhuhr + 60, "Friday: a meeting set during Jumu'ah is moved after it (" + fr.plan[0].fromAt + ")");
const rm = P.planDay([{ title: "work", minutes: 60 }], c, { start: 18 * 60, end: 23 * 60, ramadan: true });
ok(rm.blocks.some((b) => b.name === "iftar") && rm.blocks.some((b) => b.name === "taraweeh") && rm.plan[0].from >= c.maghrib + 60, "Ramadan: Iftar and Taraweeh kept free (" + rm.plan[0].fromAt + ")");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
