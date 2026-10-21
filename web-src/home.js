/* ---- v6.27: the phone Home's TODAY list (design A "Calm") — pure logic, used by home-ui.jsx; tests: tests/unit/v727home.test.mjs ---- */
import { holidayNote } from "./country.js";
import { tr } from "./i18n.js";
import { dueSoon } from "./life.js";
import { moneyOverview } from "./money-calm.js";
import { radarToday, radarView, daysLeft } from "./deadlines.js";
import { dosesOn, lowSupply } from "./care.js";
import { cardsDue, todayPlan } from "./daily.js";
import { warnings as fleetWarnings, activeNow as fleetActive } from "./fleet.js";

const isoD = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export /** What is due today and this week, from People & plans and Money's bills — at most `max`, the late ones first. Pure. */
function todayList({ life, ledger, radar, care, now = Date.now(), max = 4 }) {
  const out = [];
  for (const x of dueSoon(life || { items: [] }, now, 7)) {
    const c = x.c, who = c.person || "";
    const title = c.kind === "installment" ? (who ? tr("{p} · installment {i} of {n}", { p: who, i: x.i + 1, n: c.count }) : tr("Installment {i} of {n}", { i: x.i + 1, n: c.count }))
      : c.kind === "circle" ? tr("Savings circle · {i} of {n}", { i: x.i + 1, n: c.count }) : c.kind === "debt" ? (c.dir === "in" ? tr("{p} pays you back", { p: who }) : tr("Pay {p} back", { p: who }))
      : (c.title ? c.title[0].toUpperCase() + c.title.slice(1) : tr("Bill"));
    // v6.34 (Ali): on its day a payment you make (the maid, a subscription, a bill, the rent) is a box: tick = paid, in Money
    const askPaid = c.dir === "out" && c.amount > 0 && x.date <= isoD(now) && ["regular", "subscription", "bill", "rent"].includes(c.kind);
    out.push({ from: "life", title, date: x.date, amount: x.amount, dir: c.dir, late: x.late, ...(askPaid ? { pay: { kind: "life", id: c.id, i: x.i, cur: c.currency } } : {}) });
  }
  for (const b of moneyOverview(ledger, now).due) out.push({ from: "money", title: b.note, date: b.date, amount: b.amount, dir: "out", late: b.late });
  // v6.27 Family health: the next doses not taken yet (late ones first)
  const hh = new Date(now).getHours();
  for (const x of dosesOn(care || { meds: [] }, now).filter((d) => !d.taken && (d.late || +d.time.slice(0, 2) <= hh + 3)).slice(0, 2))
    out.push({ from: "care", title: `${x.time} · ${x.med.name}${x.member && (care.members || []).length > 1 ? " · " + x.member.name : ""}`, date: x.key.split("|")[1], amount: 0, dir: "out", late: x.late, dose: true });
  // v6.27 Deadline Radar: a trial / return / warranty / document inside its warning window
  const RL = { trial: "Free trial ends", renewal: "Renews", return: "Last day to return", warranty: "Warranty ends", expiry: "Expires", other: "Deadline" };
  // v6.34 (Ali: "when the deadline of a subscription comes, a checkbox asks me if I paid"): a renewal with an amount, on its day
  // or up to 7 days after it, asks "Paid?" — yes = the expense in Money and the renewal done; until then the usual line before it
  const rd = radar || { items: [] };
  for (const x of radarToday(rd, now)) if (!(x.kind === "renewal" && x.amount > 0 && daysLeft(x, now) <= 0)) out.push({ from: "radar", title: tr(RL[x.kind] || "Deadline") + ": " + (x.title || ""), date: x.date, amount: x.amount || 0, dir: "out", late: false });
  for (const x of radarView(rd, now).soon) if (x.kind === "renewal" && x.amount > 0 && daysLeft(x, now) <= 0)
    out.push({ from: "radar", title: tr("Renewed: {t}", { t: x.title || "" }), date: x.date, amount: x.amount, dir: "out", late: daysLeft(x, now) < 0, pay: { kind: "radar", id: x.id, cur: x.currency || "" } });
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

/* ---- v6.43 (Ali picked "1 + the Today line"): Home is one box that acts in every app, and under it ONE line for today across
   the apps — what is waiting (late first), then what happened and what is ahead today, by time. Pure; every store is passed in.
   Tests: tests/unit/v743today.test.mjs. → { needs: [waitingList items], line: [{ t, hm, app, title, sub, open, ahead }] } */
const MEALS_T = [["breakfast", "Breakfast", 8], ["lunch", "Lunch", 13], ["dinner", "Dinner", 20], ["snacks", "Snacks", 17]];
const hmOf = (t) => { const d = new Date(t); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
export function todayLine({ fit, ledger, reminders, life, radar, care, scout, courses, fleet, country = null, now = Date.now() } = {}) {
  const day = isoD(now), start = new Date(now); start.setHours(0, 0, 0, 0);
  const at = (h) => start.getTime() + h * 3600e3;
  const line = [];
  // food: each meal eaten today, at the time its first food was logged
  const meals = ((fit && fit.days && fit.days[day]) || {}).meals || {};
  for (const [k, name, h] of MEALS_T) {
    const xs = (meals[k] || []).filter(Boolean); if (!xs.length) continue;
    const kcal = Math.round(xs.reduce((a, x) => a + (+x.kcal || 0), 0));
    const t = Math.min(...xs.map((x) => (x.t && x.t >= start.getTime() ? x.t : at(h))));
    line.push({ t, app: "fit", title: tr(name) + " · " + xs.map((x) => x.name).slice(0, 3).join(", "), sub: tr("{n} kcal", { n: kcal }), open: "fit" });
  }
  // money: today's spending, one line
  const spent = ((ledger && ledger.txns) || []).filter((x) => x && x.type === "expense" && x.date === day);
  if (spent.length) {
    const sum = spent.reduce((a, x) => a + (+x.amount || 0), 0);
    const ts = spent.map((x) => /^n[0-9a-z]{6,}/.test(x.id || "") ? parseInt(String(x.id).slice(1, 9), 36) : 0).filter((v) => v >= start.getTime() && v <= now + 60e3);
    line.push({ t: ts.length ? Math.max(...ts) : now - 1, app: "money", title: tr("Spent today: {n}", { n: Math.round(sum).toLocaleString("en-US") }) + (ledger.currency ? " " + ledger.currency : ""), sub: spent.map((x) => x.note || x.cat).filter(Boolean).slice(0, 3).join(", "), open: "money" });
  }
  // reminders still to come today
  const list = Array.isArray(reminders) ? reminders : (reminders && reminders.items) || [];
  for (const r of list) if (r && !r.done && r.at >= now && r.at < at(24)) line.push({ t: r.at, app: "reminders", title: r.title || tr("Reminder"), sub: "", open: "reminders", ahead: true });
  // v6.44 Fleet & rentals: the cranes working today (one line, at 07:00 — the work day) and what needs you there
  // (a cheque overdue / due today, a job past its end, a crane due for service, a store item out) at 09:00, when its alert comes
  if (fleet && fleet.jobs) {
    try {
      const on = fleetActive(fleet).filter((a) => a.crane && (!a.job.start || a.job.start <= day));
      if (on.length) line.push({ t: at(7), app: "fleet", title: on.length === 1 ? tr("1 crane working") : tr("{n} cranes working", { n: on.length }),
        sub: on.slice(0, 3).map((a) => a.crane.name + (a.site ? " @ " + a.site.name : a.client ? " · " + a.client.name : "")).join(", "), open: "fleet-rentals" });
      const W = { chequeOverdue: "Cheque overdue", chequeToday: "Cheque due today", jobPast: "Job past its end", jobEnding: "Job ends", serviceDue: "Due for service", serviceSoon: "Service soon", lowStock: "Low in the store",
        docExpired: "Crane paper expired", docSoon: "Crane paper expiring", licenceExpired: "Licence expired", licenceSoon: "Licence expiring", invoiceOverdue: "Invoice overdue", repairOpen: "Still broken down", fuelHigh: "Fuel use high", poLate: "Purchase order late" };
      const ws = fleetWarnings(fleet, day).filter((w) => w.level !== "info");
      for (const w of ws.slice(0, 3)) line.push({ t: at(9), app: "fleet", open: "fleet-rentals", ahead: at(9) > now,
        title: tr(W[w.kind] || w.kind) + (w.crane ? " · " + w.crane : w.item ? " · " + w.item : w.who ? " · " + w.who : ""),
        sub: w.amount != null ? Math.round(w.amount).toLocaleString("en-US") + (fleet.settings && fleet.settings.currency ? " " + fleet.settings.currency : "") + (w.no ? " · #" + w.no : "") : w.no ? "#" + w.no : "" });
      if (ws.length > 3) line.push({ t: at(9) + 1, app: "fleet", open: "fleet-rentals", ahead: at(9) > now, title: tr("{n} more in Fleet", { n: ws.length - 3 }), sub: "" });
    } catch (e) {}
  }
  // v6.47 (VISION phase 2 "every area on Today"): doses at their time, payments and deadlines due today, the lesson waiting
  try {
    for (const x of dosesOn(care || { meds: [] }, now).filter((d) => d.key.split("|")[1] === day).slice(0, 6)) {
      const [hh, mm] = x.time.split(":").map(Number);
      line.push({ t: start.getTime() + (hh * 60 + (mm || 0)) * 60e3, app: "care", title: x.med.name + (x.member && ((care && care.members) || []).length > 1 ? " · " + x.member.name : ""),
        sub: x.taken ? tr("Taken") : x.late ? tr("Not taken yet") : tr("Dose"), open: "care", ahead: !x.taken && !x.late });
    }
  } catch (e) {}
  try {
    for (const x of dueSoon(life || { items: [] }, now, 0).filter((x) => x.date === day).slice(0, 3))
      line.push({ t: at(10), app: "life", title: x.c.title ? x.c.title[0].toUpperCase() + x.c.title.slice(1) : x.c.person || tr("Payment"), sub: x.amount ? Math.round(x.amount).toLocaleString("en-US") + (x.c.currency ? " " + x.c.currency : "") : "", open: "life", ahead: at(10) > now });
  } catch (e) {}
  try { for (const x of radarToday(radar || { items: [] }, now).filter((x) => x.date === day).slice(0, 2)) line.push({ t: at(9) + 2, app: "radar", title: x.title || tr("Deadline"), sub: tr("Last day"), open: "radar", ahead: at(9) > now }); } catch (e) {}
  try {
    for (const c of (courses || []).slice(0, 2)) { const p = todayPlan(c, now), l = p.steps.find((x) => x.kind === "lesson" && !x.done);
      if (l) line.push({ t: at(19), app: "learn", title: c.title || c.topic || tr("Your course"), sub: tr("lesson {n}", { n: (l.lesson ? l.lesson.n : l.n) + 1 }), open: "learn", ahead: at(19) > now }); }
  } catch (e) {}
  // v6.47 country packs: a public holiday today, tomorrow or the day after (banks closed — country.js)
  if (country) { try { const h = holidayNote(country, now); if (h) line.push({ t: start.getTime() + 1, app: "country", title: h.title, sub: h.sub, open: null, ahead: h.days > 0 }); } catch (e) {} }
  line.sort((a, b) => a.t - b.t);
  for (const x of line) x.hm = hmOf(x.t);
  return { needs: waitingList({ life, ledger, radar, care, scout, courses, now, max: 4 }), line };
}
