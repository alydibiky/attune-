// v9.9.3 T1 (Ali: "timetable photo → reminders — slower is OK but don't compromise quality and accuracy")
import assert from "node:assert/strict";
import * as T from "../../web-src/timetable.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS " + m); };
const L = (text, x, y, w = 80, h = 14) => ({ text, x, y, w, h });
// a GRID like a uni portal screenshot: days across, times down
const grid = [L("Sun", 200, 40, 40), L("Mon", 320, 40, 40), L("Tue", 440, 40, 40),
  L("9:00 - 10:30", 40, 100, 100), L("11:00 - 12:30", 40, 200, 110), L("1:00 - 2:30", 40, 300, 100),
  L("Accounting", 180, 95), L("B204", 190, 115, 40), L("Tax Law", 420, 95), L("A12", 430, 115, 30),
  L("Finance", 300, 195), L("Seminar", 180, 295), L("Finance Lab", 300, 295, 90), L("Accounting", 420, 295)];
let c = T.fromLines(grid);
ok(c.length === 6, "grid: 6 classes read (" + c.length + ")");
const acc = c.find((x) => x.day === 0 && x.start === "09:00");
ok(acc && acc.subject === "Accounting" && acc.room === "B204" && acc.end === "10:30", "Sun 09:00–10:30 Accounting · B204 (the room on its own line stays with its class)");
ok(c.some((x) => x.day === 1 && x.start === "13:00" && x.subject === "Finance Lab"), "“1:00 - 2:30” after morning classes is 13:00–14:30 (Mon Finance Lab)");
ok(c.some((x) => x.day === 2 && x.start === "09:00" && x.subject === "Tax Law" && x.room === "A12"), "Tue 09:00 Tax Law · A12");
// a LIST
c = T.fromLines([L("Sunday 9:00-10:30 Accounting B204", 10, 10), L("Monday 11:00 am - 12:30 pm Finance Hall 3", 10, 30), L("Wednesday 4:30-6 pm Seminar", 10, 50), L("Office hours: call 0100", 10, 70)]);
ok(c.length === 3 && c[0].subject === "Accounting" && c[0].room === "B204", "list: “Sunday 9:00-10:30 Accounting B204” → Sun 09:00 Accounting · B204");
ok(c.find((x) => x.day === 1).room === "Hall 3" && c.find((x) => x.day === 3).start === "16:30", "“Monday 11:00 am … Finance Hall 3” and “Wednesday 4:30-6 pm” → 16:30");
ok(!c.some((x) => /Office/.test(x.subject)), "a line with no day and no time (office hours, a phone number) is not a class");
// Arabic list
c = T.fromLines([L("الأحد ٩:٠٠ - ١٠:٣٠ محاسبة قاعة ٣", 10, 10), L("الثلاثاء 11:00-12:30 قانون الضرائب", 10, 30)]);
ok(c.length === 2 && c[0].day === 0 && c[0].start === "09:00" && /محاسبة/.test(c[0].subject) && /قاعة/.test(c[0].room), "«الأحد ٩:٠٠ - ١٠:٣٠ محاسبة قاعة ٣» → Sun 09:00 محاسبة · قاعة ٣");
// the photo model's answer is checked row by row
c = T.fromModel('Sure! [{"day":"Sunday","start":"09:00","end":"10:30","subject":"Accounting","room":"B204"},{"day":"Funday","start":"09:00","subject":"x"},{"day":"Monday","start":"25:00","subject":"Bad"},{"day":"Tuesday","start":"11:00","end":"10:00","subject":"Backwards"}]');
ok(c.length === 1 && c[0].subject === "Accounting", "model JSON: only the believable rows are kept (no Funday, no 25:00, no end before start)");
ok(T.fromModel("I cannot read this") .length === 0, "a model answer with no JSON → nothing (never a guess)");
const m = T.merge([{ day: 0, start: "09:00", end: "10:30", subject: "Accounting", room: "B204" }], [{ day: 0, start: "09:00", end: "10:30", subject: "Accounting", room: "B204" }, { day: 1, start: "11:00", end: "", subject: "Finance", room: "" }]);
ok(m.find((x) => x.day === 0).sure && m.find((x) => x.day === 1).check, "both readers agree → sure; read by one only → marked “check this”");
// reminders
const NOW = Date.parse("2026-11-09T08:00:00");   // Monday
const r = T.toReminders([{ day: 0, start: "09:00", end: "10:30", subject: "Accounting", room: "B204" }, { day: 1, start: "11:00", end: "", subject: "Finance", room: "" }], { minutes: 15, until: "2027-01-20", now: NOW });
ok(r.length === 2 && r.every((x) => x.repeat === "weekly" && x.until === Date.parse("2027-01-20T23:59:00")), "weekly reminders that stop after the term's last day");
const fin = r.find((x) => x.title === "Finance"), acc2 = r.find((x) => /Accounting/.test(x.title));
ok(new Date(fin.at).getHours() === 10 && new Date(fin.at).getMinutes() === 45 && new Date(fin.at).getDay() === 1, "Finance today (Mon) 11:00 → reminder today 10:45");
ok(new Date(acc2.at).getDay() === 0 && acc2.title === "Accounting · B204" && acc2.body === "09:00–10:30", "Accounting → next Sunday 8:45, “Accounting · B204”, 09:00–10:30");
console.log("ALL PASSED v993timetable (" + n + " checks)");
