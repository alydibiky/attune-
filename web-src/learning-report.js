/* ---- v7.7 Mind & learning in two levels (Gemini's mock-up "Area 5", Ali sent it 24 Oct 2026): the numbers for the Mind Report,
   the Learning Report, the Homework Report, Remember and Recall — all by code from what Attune keeps (no model, nothing sent).
   Pure (no DOM). Tests: tests/unit/v800learnreport.test.mjs                                                                      */
import * as M from "./mind.js";

const DAY = 86400000;
const pad = (n) => String(n).padStart(2, "0");
const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

/** Promises (commitments) still open, with when they are due: late · today · upcoming · no date. Sorted: late, today, soonest. */
export function openPromises(commits = [], now = Date.now()) {
  const today = dayKey(now);
  return (commits || []).filter((c) => c && (c.state === "confirmed" || c.state === "suggested")).map((c) => {
    const d = c.due ? dayKey(c.due) : null;
    return { id: c.id, action: c.action || c.quote || "", who: c.who || "me", due: c.due || null, whenText: c.whenText || "", sourceId: c.sourceId || null,
      status: !d ? "none" : d < today ? "late" : d === today ? "today" : "upcoming", days: c.due ? Math.round((new Date(d + "T12:00:00") - new Date(today + "T12:00:00")) / DAY) : null };
  }).sort((a, b) => ({ late: 0, today: 1, upcoming: 2, none: 3 }[a.status] - { late: 0, today: 1, upcoming: 2, none: 3 }[b.status]) || (a.due || 9e15) - (b.due || 9e15));
}

/** The Mind Report: everything kept, what was kept this week by kind, promises due or late, the most-used tags, the auto spaces
 *  and "things you forgot you have" (kept long ago, never opened since). */
export function mindReport(records = [], commits = [], now = Date.now()) {
  const week = records.filter((r) => now - (r.ts || 0) < 7 * DAY);
  const byKind = {};
  for (const r of week) { const k = M.kindOf(r); byKind[k] = (byKind[k] || 0) + 1; }
  const kinds = Object.entries(byKind).map(([kind, n]) => ({ kind, n, label: M.KINDS[kind] ? M.KINDS[kind].en : kind, labelAr: M.KINDS[kind] ? M.KINDS[kind].ar : kind }))
    .sort((a, b) => b.n - a.n).slice(0, 5);
  const tags = M.autoSpaces(records, { min: 1, max: 6 });
  const promises = openPromises(commits, now);
  const forgotten = records.filter((r) => now - (r.ts || 0) > 45 * DAY && !(r.meta && r.meta.opened)).sort((a, b) => (a.ts || 0) - (b.ts || 0))
    .slice(0, 2).map((r) => ({ id: r.id, title: M.titleOf(r), ts: r.ts }));
  return { total: records.length, week: week.length, kinds, tags, spaces: M.autoSpaces(records, { min: 2 }).length,
    promises, due: promises.filter((p) => p.status === "late" || p.status === "today").length, late: promises.filter((p) => p.status === "late").length,
    today: promises.filter((p) => p.status === "today").length, forgotten };
}

/** The Learning Report across every course: the streak, days studied this month, lessons read, quiz scores over time, words /
 *  cards learned, cards due, and the weak points (what was missed in quizzes, still in review). */
export function learnReport(courses = [], now = Date.now()) {
  const today = dayKey(now), yest = dayKey(now - DAY);
  const streak = Math.max(0, ...courses.map((c) => (c.lastDay === today || c.lastDay === yest ? c.streak || 0 : 0)));
  const monthFrom = today.slice(0, 8) + "01";
  const days = new Set();
  for (const c of courses) for (const l of c.lessons || []) if (l.done && l.day && l.day >= monthFrom && l.day <= today) days.add(l.day);
  const quizzes = courses.flatMap((c) => (c.quizzes || []).map((q) => ({ at: q.at || 0, pct: q.total ? Math.round((100 * q.score) / q.total) : 0, course: c.topic || c.title || "" })))
    .sort((a, b) => a.at - b.at);
  const last = quizzes.slice(-6);
  const acc = quizzes.length ? Math.round(quizzes.reduce((s, q) => s + q.pct, 0) / quizzes.length) : null;
  const cardsDue = courses.reduce((s, c) => s + (c.cards || []).filter((k) => k.due <= now).length, 0);
  const learned = courses.reduce((s, c) => s + (c.learnedCards || 0) + (c.learned || 0), 0);
  const inDeck = courses.reduce((s, c) => s + (c.cards || []).length, 0);
  const weak = courses.flatMap((c) => (c.review || []).slice(0, 3).map((t) => ({ text: t, course: c.topic || c.title || "" }))).slice(0, 4);
  const list = courses.map((c) => { const done = (c.lessons || []).filter((l) => l.done).length, of = (c.plan || []).length;
    return { id: c.id, title: c.topic || c.title || "", done, of, pct: of ? Math.round((100 * done) / of) : 0, ready: (c.lessons || []).filter((l) => !l.done).length }; });
  return { streak, daysThisMonth: days.size, dayOfMonth: +today.slice(8, 10), quizzes: last, accuracy: acc, firstAcc: quizzes.length ? quizzes[0].pct : null,
    learned, inDeck, cardsDue, weak, courses: list, lessonsDone: list.reduce((s, c) => s + c.done, 0) };
}

/** The Homework Report: problems this week, how many right first time, by topic, and the topics to practise. */
export function coachReport(state, now = Date.now()) {
  const h = (state && state.history) || [];
  const wk = h.filter((x) => now - (x.at || 0) < 7 * DAY);
  const right = wk.filter((x) => x.right).length;
  const topics = Object.entries((state && state.topics) || {}).map(([topic, v]) => ({ topic, right: v.right || 0, wrong: v.wrong || 0, pct: v.right + v.wrong ? Math.round((100 * v.right) / (v.right + v.wrong)) : 0 }))
    .sort((a, b) => b.right + b.wrong - (a.right + a.wrong)).slice(0, 6);
  return { week: wk.length, right, pct: wk.length ? Math.round((100 * right) / wk.length) : null, total: h.length, topics,
    weak: topics.filter((t) => t.right + t.wrong >= 2 && t.pct < 70).map((t) => t.topic) };
}

/** Remember: how much the library holds. rows = the person's sources ({ chapters, pages, size, text… }). */
export function libraryStats(rows = []) {
  const chapters = rows.reduce((s, r) => s + (Number(r.chapters) || 0), 0);
  const bytes = rows.reduce((s, r) => s + (Number(r.size) || Number(r.bytes) || (r.chars ? r.chars * 2 : 0)), 0);
  return { sources: rows.length, chapters, books: rows.filter((r) => r.chapters).length, mb: Math.round((bytes / 1048576) * 10) / 10 };
}

/** Recall: what the on-device index holds, by kind, with the share of each. docs = recallDocs(...) rows ({ kind }). */
export function recallStats(docs = []) {
  const n = {};
  for (const d of docs) n[d.kind] = (n[d.kind] || 0) + 1;
  const total = docs.length;
  return { total, kinds: Object.entries(n).map(([kind, count]) => ({ kind, count, pct: total ? Math.round((100 * count) / total) : 0 })).sort((a, b) => b.count - a.count) };
}
