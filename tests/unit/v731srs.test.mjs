// v6.28 Learn daily: spaced repetition — a missed question comes back in a lesson, then after 2, 5, 12 and 30 days, then is learned.
import * as D from "../../web-src/daily.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const DAY = 86400000, t0 = Date.parse("2026-10-14T08:00:00");
let c = { ...D.newCourse({ topic: "Turkish" }), plan: ["a", "b", "c", "d", "e", "f", "g", "h"], lessons: [], quizzes: [] };
const quiz = { lessons: [0, 1], questions: [{ q: "Q1", options: ["x", "y"], answer: 0 }, { q: "Q2", options: ["x", "y"], answer: 0 }, { q: "Q3", options: ["x", "y"], answer: 0 }] };
c = D.finishQuiz(c, quiz, { 0: 1, 1: 1, 2: 0 }, { now: t0 }).course;
ok(c.review.length === 2 && D.reviewDue(c, t0).length === 2, "two missed → both due for the next lesson");
ok(D.lessonMessages(c, 2)[0].content.includes("Q1 → x") && D.lessonMessages(c, 2)[0].content.includes("Q2 → x"), "the next lesson starts with their quick review");
c = D.addLesson(c, 2, { body: "x" }, { now: t0 });
ok(c.review.length === 2 && D.reviewDue(c, t0 + DAY).length === 0, "reviewed once: still kept, but not due the next day");
ok(D.reviewDue(c, t0 + 2 * DAY + 1).length === 2, "due again after 2 days");
let t = t0 + 2 * DAY + 1; c = D.addLesson(c, 3, { body: "x" }, { now: t });
ok(D.reviewDue(c, t + 4 * DAY).length === 0 && D.reviewDue(c, t + 5 * DAY + 1).length === 2, "then after 5 days (further apart)");
for (const d of [5, 12, 30]) { t += d * DAY + 1; c = D.addLesson(c, 4, { body: "x" }, { now: t }); }
ok(c.review.length === 0 && c.learned === 2 && !Object.keys(c.srs).length, "after the 30-day review both are learned and leave the list");
const s = D.reviewStatus(c, t); ok(s.learned === 2 && s.due === 0 && s.waiting === 0, "the course screen shows 2 learned");
// missed again → starts over
let c2 = D.finishQuiz({ ...c, review: [], srs: {} }, quiz, { 0: 1, 1: 0, 2: 0 }, { now: t0 }).course;
c2 = D.addLesson(c2, 5, { body: "x" }, { now: t0 });
c2 = D.finishQuiz(c2, quiz, { 0: 1, 1: 0, 2: 0 }, { now: t0 + DAY }).course;
ok(c2.srs["Q1 → x"].box === 0 && D.reviewDue(c2, t0 + DAY).includes("Q1 → x"), "missed again in a later quiz → back to the start, due now");
ok(D.reviewDue({ review: ["old item"], plan: [] }, t0).length === 1, "an older course's review list (no schedule) still works");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
