/* ---- v6.27: the phone Home's TODAY list (design A "Calm") — pure logic, used by home-ui.jsx; tests: tests/unit/v727home.test.mjs ---- */
import { tr } from "./i18n.js";
import { dueSoon } from "./life.js";
import { moneyOverview } from "./money-calm.js";
import { radarToday } from "./deadlines.js";
import { dosesOn, lowSupply } from "./care.js";
import { cardsDue, todayPlan } from "./daily.js";

export /** What is due today and this week, from People & plans and Money's bills — at most `max`, the late ones first. Pure. */
function todayList({ life, ledger, radar, care, now = Date.now(), max = 4 }) {
  const out = [];
  for (const x of dueSoon(life || { items: [] }, now, 7)) {
    const c = x.c, who = c.person || "";
    const title = c.kind === "installment" ? (who ? tr("{p} · installment {i} of {n}", { p: who, i: x.i + 1, n: c.count }) : tr("Installment {i} of {n}", { i: x.i + 1, n: c.count }))
      : c.kind === "circle" ? tr("Savings circle · {i} of {n}", { i: x.i + 1, n: c.count }) : c.kind === "debt" ? (c.dir === "in" ? tr("{p} pays you back", { p: who }) : tr("Pay {p} back", { p: who }))
      : (c.title ? c.title[0].toUpperCase() + c.title.slice(1) : tr("Bill"));
    out.push({ from: "life", title, date: x.date, amount: x.amount, dir: c.dir, late: x.late, ...(c.kind === "regular" ? { regular: { id: c.id, i: x.i, cur: c.currency } } : {}) });
  }
  for (const b of moneyOverview(ledger, now).due) out.push({ from: "money", title: b.note, date: b.date, amount: b.amount, dir: "out", late: b.late });
  // v6.27 Family health: the next doses not taken yet (late ones first)
  const hh = new Date(now).getHours();
  for (const x of dosesOn(care || { meds: [] }, now).filter((d) => !d.taken && (d.late || +d.time.slice(0, 2) <= hh + 3)).slice(0, 2))
    out.push({ from: "care", title: `${x.time} · ${x.med.name}${x.member && (care.members || []).length > 1 ? " · " + x.member.name : ""}`, date: x.key.split("|")[1], amount: 0, dir: "out", late: x.late, dose: true });
  // v6.27 Deadline Radar: a trial / return / warranty / document inside its warning window
  const RL = { trial: "Free trial ends", renewal: "Renews", return: "Last day to return", warranty: "Warranty ends", expiry: "Expires", other: "Deadline" };
  for (const x of radarToday(radar || { items: [] }, now)) out.push({ from: "radar", title: tr(RL[x.kind] || "Deadline") + ": " + (x.title || ""), date: x.date, amount: x.amount || 0, dir: "out", late: false });
  return out.sort((a, b) => (b.late - a.late) || a.date.localeCompare(b.date)).slice(0, max);
}


/* ---- v6.29 (Ali picked A + "What's waiting"): one card with everything that waits for you, and a live line under each recent tool.
   Pure: every store is passed in; tests: tests/unit/v733home.test.mjs. */
/** What's waiting: what is due (todayList), new Scout finds, cards to review / today's lesson, a medicine running out. */
export function waitingList({ life, ledger, radar, care, scout, courses, now = Date.now(), max = 6 }) {
  const due = todayList({ life, ledger, radar, care, now, max: 4 });
  const extra = [];
  for (const g of (scout && scout.goals) || []) { const n = (g.unseen || []).length; if (n) extra.push({ from: "scout", title: tr("{n} new finds: {w}", { n, w: (g.g && g.g.what) || g.text || "" }), n }); }
  // (Ali 17 Oct: "lesson 2 — Turkish" showed above "lesson 1 — Turkish": two courses on one topic, newest first. Now one
  // line per topic — the course furthest behind, lowest lesson first)
  const learn = [];
  for (const c of courses || []) {
    const k = cardsDue(c, now).length, p = todayPlan(c, now), l = p.steps.find((x) => x.kind === "lesson" && !x.done);
    const ln = l ? (l.lesson ? l.lesson.n : l.n) : 1e9, key = String(c.topic || c.title || "").trim().toLowerCase();
    if (!(k || l)) continue;
    const prev = learn.find((x) => x.key === key);
    if (prev && prev.ln <= ln) continue;
    if (prev) learn.splice(learn.indexOf(prev), 1);
    learn.push({ key, ln, from: "learn", course: c.id, title: [k ? (k === 1 ? tr("1 card to review") : tr("{n} cards to review", { n: k })) : "", l ? tr("lesson {n}", { n: ln + 1 }) : ""].filter(Boolean).join(" · ") + " — " + (c.topic || ""), n: k });
  }
  extra.push(...learn.sort((a, b) => a.ln - b.ln).map(({ key, ln, ...x }) => x));
  for (const x of lowSupply(care || { meds: [] }).slice(0, 2)) extra.push({ from: "care", title: x.days <= 0 ? tr("{m} has run out", { m: x.med.name }) : x.days === 1 ? tr("{m}: about 1 day left", { m: x.med.name }) : tr("{m}: about {d} days left", { m: x.med.name, d: x.days }), low: true });
  // the late ones first, then what is due, then the rest — at most `max`
  return [...due.filter((x) => x.late), ...extra.filter((x) => x.low), ...due.filter((x) => !x.late), ...extra.filter((x) => !x.low)].slice(0, max);
}
/** The short line under a recent tool on Home ("2 new finds", "Review 4 cards · Lesson 5", "Fleet pitch"), or "" when there is nothing to say. */
export function toolLine(id, { scout, courses, slides, ledger, care, now = Date.now() } = {}) {
  try {
    if (id === "scout") { const gs = (scout && scout.goals) || []; const n = gs.reduce((a, g) => a + (g.unseen || []).length, 0); return n ? (n === 1 ? tr("1 new find") : tr("{n} new finds", { n })) : gs.length === 1 ? tr("1 goal watched") : gs.length ? tr("{n} goals watched", { n: gs.length }) : ""; }
    if (id === "learn") { const c = (courses || [])[0]; if (!c) return ""; const p = todayPlan(c, now); const s = p.steps.filter((x) => !x.done).map((x) => (x.kind === "review" ? (x.n === 1 ? tr("Review 1 card") : tr("Review {n} cards", { n: x.n })) : x.kind === "quiz" ? tr("Quiz time") : tr("Lesson {n}", { n: (x.lesson ? x.lesson.n : x.n) + 1 }))); return s.length ? s.join(" · ") : tr("All done for today ✓"); }
    if (id === "slides") { const x = (slides || [])[0]; return x ? x.title || "" : ""; }
    if (id === "care") { const low = lowSupply(care || { meds: [] }); return low.length ? tr("{m} running low", { m: low[0].med.name }) : ""; }
    if (id === "money") { const o = moneyOverview(ledger, now); return o.monthOut ? tr("Spent this month: {n}", { n: Math.round(o.monthOut).toLocaleString("en-US") }) : ""; }
  } catch (e) {}
  return "";
}
