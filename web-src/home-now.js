/* ---- v6.46 Home, option A (Ali picked it, 21 Oct 2026: "do A"): RIGHT NOW (the one thing that matters most, with its
   buttons) · four numbers · YOUR DAY (todayLine) · one thing Attune NOTICED. Everything is chosen by code from the apps' own
   data — nothing is guessed by the model. Pure; every store is passed in. Tests: tests/unit/v746home.test.mjs.            */
import { tr } from "./i18n.js";
import { isWorkingDay, holidayOn, holidayName, nextWorkingDay } from "./country.js";
import { warnings as fleetWarnings, live, byId, isoDay, kpis as fleetKpis } from "./fleet.js";

const BAD = new Set(["chequeOverdue", "docExpired", "licenceExpired", "invoiceOverdue", "repairOpen", "jobPast", "serviceDue"]);
const W_TITLE = {
  chequeOverdue: (w) => (w.days === 1 ? tr("Cheque {no} from {who} is 1 day late — {a}", { no: w.no || "", who: w.who || "", a: fmtN(w.amount) }) : tr("Cheque {no} from {who} is {d} days late — {a}", { no: w.no || "", who: w.who || "", d: w.days, a: fmtN(w.amount) })),
  chequeToday: (w) => (w.dir === "out" ? tr("Your cheque {no} to {who} is due today — {a}", { no: w.no || "", who: w.who || "", a: fmtN(w.amount) }) : tr("Cheque {no} from {who} is due today — {a}", { no: w.no || "", who: w.who || "", a: fmtN(w.amount) })),
  docExpired: (w) => tr("{c}: a crane paper expired {d} days ago", { c: w.crane || "", d: w.days }),
  docSoon: (w) => tr("{c}: a crane paper expires in {d} days", { c: w.crane || "", d: w.days }),
  licenceExpired: (w) => tr("{who}'s licence expired", { who: w.who || "" }),
  licenceSoon: (w) => tr("{who}'s licence expires in {d} days", { who: w.who || "", d: w.days }),
  invoiceOverdue: (w) => tr("Invoice {no} is {d} days overdue — {who}", { no: w.no || "", d: w.days, who: w.who || "" }),
  repairOpen: (w) => tr("{c} has been broken down for {d} days", { c: w.crane || "", d: w.days }),
  jobPast: (w) => tr("{no} passed its end date — {c}", { no: w.no || "", c: w.crane || "" }),
  jobEnding: (w) => tr("{no} ends in {d} days — {c}", { no: w.no || "", d: w.days, c: w.crane || "" }),
  serviceDue: (w) => tr("{c} is due for its service", { c: w.crane || "" }),
  serviceSoon: (w) => tr("{c}: service soon", { c: w.crane || "" }),
  lowStock: (w) => tr("{item}: {b} left in the store", { item: w.item || "", b: w.balance }),
  poLate: (w) => tr("Purchase order {no} is late", { no: w.no || "" }),
  quoteExpiring: (w) => tr("Quotation {no} expires in {d} days", { no: w.no || "", d: w.days }),
  fuelHigh: (w) => tr("{c} is using more fuel than usual", { c: w.crane || "" }),
};
const fmtN = (n) => (n == null ? "" : Math.round(+n || 0).toLocaleString("en-US"));

/**
 * The one thing that matters most right now, with its buttons — or null on a quiet day. Order: what is already late (a Fleet
 * cheque or paper, a payment, a dose), then what is due today, then the next thing due.
 * → { from, kind, level: "bad"|"warn"|"info", title, sub, actions: [{ id, label }], open, ref }
 */
export function nowCard({ needs = [], fleet = null, country = null, now = Date.now() } = {}) {
  const day = isoDay(new Date(now));
  // v6.47 country packs: a cheque due on a weekend or a bank holiday clears on the next working day — say which
  const bankShut = (w) => { try { if (!country || w.kind !== "chequeToday" || isWorkingDay(country, day)) return null; const h = holidayOn(country, day);
    return tr("Banks are closed today{h} — it clears on {d}", { h: h ? " (" + holidayName(h) + ")" : "", d: nextWorkingDay(country, day).split("-").reverse().join("/") }); } catch (e) { return null; } };
  let ws = [];
  try { ws = fleet && fleet.cheques ? fleetWarnings(fleet, day).filter((w) => w.level !== "info") : []; } catch (e) { ws = []; }
  const fleetCard = (w) => ({ from: "fleet", kind: w.kind, level: BAD.has(w.kind) || w.level === "bad" ? "bad" : "warn", title: (W_TITLE[w.kind] || (() => w.kind))(w),
    sub: bankShut(w) || tr("Fleet & rentals"), open: "fleet-rentals", ref: w.id,
    actions: /^cheque/.test(w.kind) ? [{ id: "cleared", label: tr("It cleared") }, { id: "bounced", label: tr("Bounced") }] : [{ id: "open", label: tr("Open") }] });
  const needCard = (x) => ({ from: x.from, kind: x.dose ? "dose" : x.pay ? "pay" : "due", level: x.late ? "bad" : "warn", title: x.title,
    sub: x.amount ? fmtN(x.amount) + (x.pay && x.pay.cur ? " " + x.pay.cur : "") : x.date === day ? tr("Today") : x.date || "", open: x.from === "life" ? "life" : x.from === "radar" ? "radar" : x.from === "care" ? "care" : x.from,
    ref: x.pay || null, actions: x.pay ? [{ id: "paid", label: tr("Paid") }, ...(x.pay.kind === "radar" ? [{ id: "notRenewed", label: tr("No") }] : [])] : [{ id: "open", label: tr("Open") }] });
  const badFleet = ws.find((w) => BAD.has(w.kind));
  if (badFleet) return fleetCard(badFleet);
  const late = needs.find((x) => x.late);
  if (late) return needCard(late);
  const todayFleet = ws.find((w) => w.kind === "chequeToday");
  if (todayFleet) return fleetCard(todayFleet);
  const dueToday = needs.find((x) => x.date === day || x.dose || x.low);
  if (dueToday) return needCard(dueToday);
  if (ws.length) return fleetCard(ws[0]);
  if (needs.length) return needCard(needs[0]);
  return null;
}

/** The four numbers under it — only the ones that have data: spend today · calories · cranes out · the goal. */
export function homeNumbers({ safe = null, kcal = 0, kcalGoal = 0, fleet = null, mission = null } = {}) {
  const out = [];
  if (safe && safe.cur) out.push({ k: "spend", label: tr("Spend today"), value: fmtN(safe.today), open: "money" });
  if (kcalGoal) out.push({ k: "kcal", label: tr("Calories"), value: fmtN(kcal), of: fmtN(kcalGoal), open: "fit" });
  try { if (fleet && live(fleet.cranes || []).length) { const k = fleetKpis(fleet); out.push({ k: "cranes", label: tr("Cranes out"), value: `${k.working} / ${k.cranes}`, open: "fleet-rentals" }); } } catch (e) {}
  if (mission && mission.chance != null) out.push({ k: "goal", label: tr("Goal"), value: Math.round(mission.chance * 100) + "%", open: "missions" });
  return out.slice(0, 4);
}

/**
 * One thing Attune noticed, worth knowing today (or null): spending past today's safe amount, a goal falling behind, a crane
 * standing free while clients have hired it before, new Scout finds. → { k, text, open }
 */
/** v6.48 (CHAT_RUNS_APP.md S10): something kept in Mind on this day in an earlier year (a photo, a video, a note) — or null. */
export function onThisDay(records, now = Date.now()) {
  const d = new Date(now), md = (t) => { const x = new Date(t); return x.getMonth() === d.getMonth() && x.getDate() === d.getDate() && x.getFullYear() < d.getFullYear(); };
  const r = (records || []).filter((x) => x && x.ts && md(x.ts) && !(x.meta && (x.meta.trashed || x.meta.todo)) && x.kind !== "where").sort((a, b) => b.ts - a.ts)[0];
  if (!r) return null;
  const years = d.getFullYear() - new Date(r.ts).getFullYear();
  return { k: "past", id: r.id, text: years === 1 ? tr("A year ago today you kept: {t}", { t: r.title || "" }) : tr("{n} years ago today you kept: {t}", { n: years, t: r.title || "" }), open: "memory" };
}

export function noticed({ safe = null, mission = null, fleet = null, scout = null, past = null, now = Date.now() } = {}) {
  if (safe && safe.cur && safe.spentToday > 0 && safe.today === 0 && safe.perDay >= 0 && safe.spentToday > safe.perDay)
    return { k: "spend", text: tr("You spent {s} today — more than the {p} that keeps every bill paid. Tomorrow's safe amount is lower.", { s: fmtN(safe.spentToday), p: fmtN(safe.perDay) }), open: "money" };
  if (mission && mission.chance != null && mission.chance < 0.5)
    return { k: "goal", text: tr("{t}: {c}% chance now", { t: mission.title, c: Math.round(mission.chance * 100) }) + (mission.step ? " — " + mission.step : ""), open: "missions" };
  try {
    if (fleet && fleet.jobs && live(fleet.jobs).length) {
      const busy = new Set(live(fleet.jobs).filter((j) => j.status === "active").map((j) => j.crane));
      const free = live(fleet.cranes || []).filter((c) => !busy.has(c.id));
      if (free.length && busy.size) {
        const c = free[0], past = live(fleet.jobs).filter((j) => j.crane === c.id), last = past.map((j) => j.end || j.start || "").sort().pop() || "";
        const who = [...new Set(past.map((j) => (byId(fleet.clients || [], j.client) || {}).name).filter(Boolean))].slice(0, 2);
        return { k: "crane", text: who.length ? tr("{c} is free — {w} hired it before.", { c: c.name, w: who.join(tr(" and ")) }) : tr("{c} is free{since}.", { c: c.name, since: last ? " " + tr("since {d}", { d: last.split("-").reverse().join("/") }) : "" }), open: "fleet-rentals" };
      }
    }
  } catch (e) {}
  const g = ((scout && scout.goals) || []).find((x) => (x.unseen || []).length);
  if (g) return { k: "scout", text: tr("Scout found {n} new for “{w}”.", { n: g.unseen.length, w: (g.g && g.g.what) || g.text || "" }), open: "scout" };
  if (past) return past;
  return null;
}
