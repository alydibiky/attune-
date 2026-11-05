// v9.3 (Ali picked D1 A + A2 A): Your day on Home — prayers only when turned on, agents' news, Close the day + Move to tomorrow, Ramadan.
import * as Y from "../../web-src/yourday.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
process.env.TZ = process.env.TZ || "Africa/Cairo";
const at = (s) => new Date(s).getTime();
const p = Y.prayersToday("cairo", at("2026-11-05T10:00:00+02:00"));
ok(p.list.length === 5 && p.list.map((x) => x.k).join() === "fajr,dhuhr,asr,maghrib,isha", "five prayers for the chosen city");
ok(p.list.every((x) => /^\d\d:\d\d$/.test(x.at)) && p.list[0].at < p.list[1].at, "…as HH:MM, in order: " + p.list.map((x) => x.at).join(" "));
ok(Y.isEvening(at("2026-11-05T21:00:00"), 20) && !Y.isEvening(at("2026-11-05T09:00:00"), 20) && Y.isEvening(at("2026-11-06T01:00:00"), 20), "evening from the chosen hour until 3 am");
const now = at("2026-11-05T21:00:00");
const rem = [{ id: "a", at: at("2026-11-05T11:00:00"), title: "Call insurance" }, { id: "b", at: at("2026-11-05T22:30:00"), title: "Tiles quote" },
  { id: "c", at: at("2026-11-05T08:00:00"), done: true, doneAt: at("2026-11-05T08:05:00") }, { id: "d", at: at("2026-11-05T07:00:00"), repeat: "daily" }, { id: "e", at: at("2026-11-09T10:00:00") }];
const todos = [{ id: "t1", meta: { todo: true } }, { id: "t2", meta: { todo: true, done: true, doneAt: at("2026-11-05T15:00:00") } }];
const c = Y.closeDay(rem, todos, now);
ok(c.done === 2 && c.left === 3 && c.movable.join() === "a,b", "Close the day: 2 done today, 3 left (2 reminders + 1 to-do); a repeating one and next week's are not moved");
const moved = Y.moveToTomorrow(rem, c.movable, now);
ok(new Date(moved[0].at).getDate() === 6 && new Date(moved[0].at).getHours() === 11 && new Date(moved[1].at).getHours() === 22 && moved[4].at === rem[4].at, "Move to tomorrow: each keeps its time of day, on the 6th; the others don't change");
const ag = [{ id: "1", kind: "watch", on: true, title: "Hotels · Makkah", best3: [{}], checks: [{ at: now - 1e6, price: 44800 }], currency: "EGP" },
  { id: "2", kind: "buy", on: true, what: "FreeClip 2", pending: { price: 7950 }, step: "confirm" }, { id: "3", kind: "watch", on: true, title: "Watching" }, { id: "4", kind: "watch", on: false, best3: [{}] }];
const news = Y.agentNews(ag, now);
ok(news.length === 2 && news[0].status === "needs" && news[1].price === 44800, "agents' news: what needs you first, then what was found — not the ones still working or paused");
const r1 = Y.ramadanCountdown("cairo", at("2026-03-01T15:00:00+02:00"));
ok(r1.to === "iftar" && r1.left > 0 && r1.left < 4 * 36e5, "Ramadan in the afternoon → the countdown to iftar (" + Y.hms(r1.left) + ")");
const r2 = Y.ramadanCountdown("cairo", at("2026-03-01T22:00:00+02:00"));
ok(r2.to === "suhoor" && r2.left > 4 * 36e5, "at night → the countdown to the end of suhoor (tomorrow's Fajr)");
ok(Y.hms(3723000) === "1:02:03", "h:mm:ss");
