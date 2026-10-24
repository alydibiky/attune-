// v7.7: Mind & learning in two levels (Gemini's Area 5 mock-up) — the reports' numbers by code.
import { openPromises, mindReport, learnReport, coachReport, libraryStats, recallStats } from "../../web-src/learning-report.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const now = new Date("2026-10-24T15:00:00").getTime(), D = 86400000;
const recs = [
  { id: "a", kind: "note", title: "Kia oil filter 26300-35505", text: "Kia oil filter #car", tags: ["car"], ts: now - 2 * D },
  { id: "b", kind: "note", title: "https://aqarmap.com.eg/x", text: "https://aqarmap.com.eg/x", tags: ["apartment"], ts: now - 1 * D },
  { id: "c", kind: "photo", title: "Wedding", text: "", tags: ["family"], ts: now - 3 * D, meta: { mindKind: "photo" } },
  { id: "d", kind: "note", title: "Paint code Jotun 1024", text: "Jotun 1024", tags: ["home"], ts: now - 70 * D },
  { id: "e", kind: "note", title: "Kahk recipe", text: "flour, ghee", tags: ["home"], ts: now - 200 * D }];
const commits = [{ id: "p1", action: "Send Dr. Tarek the lab report", due: new Date("2026-10-24T17:00:00").getTime(), state: "confirmed" },
  { id: "p2", action: "Renew Mom's Eltroxin", due: now - D, state: "confirmed" }, { id: "p3", action: "Call Eng. Karim", due: now + 5 * D, state: "suggested" },
  { id: "p4", action: "Done one", due: now - 3 * D, state: "done" }, { id: "p5", action: "No date", state: "confirmed" }];
const ps = openPromises(commits, now);
ok(ps.map((p) => p.id).join() === "p2,p1,p3,p5" && ps[0].status === "late" && ps[1].status === "today" && ps[2].days === 5, "promises: late, today, upcoming, no date (done left out)");
const m = mindReport(recs, commits, now);
ok(m.total === 5 && m.week === 3 && m.kinds.reduce((s, k) => s + k.n, 0) === 3, "kept: 5, this week 3, by kind");
ok(m.due === 2 && m.late === 1 && m.today === 1, "promises due: 1 today, 1 late");
ok(m.tags[0].tag === "home" && m.tags[0].count === 2, "most-used tag: home ×2");
ok(m.forgotten.length === 2 && m.forgotten[0].id === "e", "things you forgot you have: the oldest first");
const L = (t, o) => ({ id: t, topic: t, plan: new Array(30).fill("x"), ...o });
const courses = [L("Turkish", { streak: 9, lastDay: "2026-10-24", lessons: [{ n: 0, done: true, day: "2026-10-02" }, { n: 1, done: true, day: "2026-10-03" }, { n: 2, done: true, day: "2026-10-24" }, { n: 3, done: false }],
    quizzes: [{ score: 3, total: 4, at: now - 20 * D }, { score: 5, total: 5, at: now - D }], cards: [{ id: "k1", due: now - 10 }, { id: "k2", due: now + D }], learnedCards: 40, review: ["Vowel harmony → -lar/-ler"] }),
  L("English", { streak: 3, lastDay: "2026-10-20", lessons: [{ n: 0, done: true, day: "2026-09-30" }], quizzes: [], cards: [], learned: 5 })];
const l = learnReport(courses, now);
ok(l.streak === 9, "the streak: 9 days (English's 3 is broken)");
ok(l.daysThisMonth === 3 && l.lessonsDone === 4, "days studied this month (October only): 3; lessons read: 4");
ok(l.accuracy === 88 && l.firstAcc === 75 && l.quizzes.length === 2, "quiz accuracy 88% (75 → 100)");
ok(l.learned === 45 && l.cardsDue === 1 && l.inDeck === 2, "learned 45, 1 card due");
ok(l.weak[0].text.includes("Vowel") && l.courses[0].pct === 10 && l.courses[0].ready === 1, "weak points; course progress 3/30 = 10%, 1 lesson ready");
const c = coachReport({ topics: { linear: { right: 5, wrong: 1 }, fractions: { right: 1, wrong: 2 } }, history: [{ right: true, at: now - D }, { right: false, at: now - 2 * D }, { right: true, at: now - 20 * D }] }, now);
ok(c.week === 2 && c.right === 1 && c.pct === 50 && c.total === 3, "homework: 2 this week, 1 right first time");
ok(c.weak.join() === "fractions" && c.topics[0].topic === "linear", "topics, and the one to practise");
ok(libraryStats([{ chapters: 22, size: 3145728 }, { chapters: 0 }, { chapters: 12, size: 1048576 }]).chapters === 34 && libraryStats([{ chapters: 22, size: 3145728 }]).mb === 3, "Remember: chapters and size");
const r = recallStats([{ kind: "photo" }, { kind: "photo" }, { kind: "chat" }, { kind: "note" }]);
ok(r.total === 4 && r.kinds[0].kind === "photo" && r.kinds[0].pct === 50, "Recall: by kind with shares");
ok(mindReport([], [], now).total === 0 && learnReport([], now).streak === 0 && coachReport(null, now).pct === null, "nothing kept → empty reports that do not break");
console.log(fail ? "FAIL " + fail : "PASS all");
