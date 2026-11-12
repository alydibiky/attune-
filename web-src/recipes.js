/* ---- v9.9.18 AU3 Ready-made automation recipes (Ali picked A — a gallery of life moments). Each recipe is a few rules in the
   rules.js shape; a recipe is offered only when it fits the person (a salary, a car, children, a trip ahead, Ramadan — only when
   prayers / Ramadan are switched on, as Ali asked on 5 Nov), and inside it only the rules whose data exist are switched on (no rent
   rule without rent). Ramadan's start comes from the Umm al-Qura calendar (country.js hijriOf), for every country. Pure; tests:
   tests/recipes (10,000 people) + tests/unit/v9918recipes.test.mjs.                                                               */
import { hijriOf } from "./country.js";
const DAY = 864e5;
/** The next 1 Ramadan on or after `now` (local midnight, ms), scanning the Hijri calendar; null where the phone lacks it. */
export function nextRamadan(now = Date.now()) {
  const d = new Date(now); d.setHours(12, 0, 0, 0);
  for (let i = 0; i < 400; i++) { const h = hijriOf(d); if (!h) return null; if (h.m === 9 && h.d === 1) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); } d.setDate(d.getDate() + 1); }
  return null;
}
export const daysTo = (t, now = Date.now()) => { const a = new Date(now); a.setHours(0, 0, 0, 0); return Math.round((t - a.getTime()) / DAY); };

/** profile: { salaryDay, rent, gameya, carFund, family:[name], car, kids, tripAt, baby, prayersOn, licenceAt, weekend:[days] } */
const T = (h, m = 0, x = {}) => ({ type: "time", at: { h, m }, ...x });
const dayBefore = (t, n) => { const d = new Date(t); d.setDate(d.getDate() - n); d.setHours(0, 0, 0, 0); return d.getTime(); };
const R = (id, title, needs, when, extra = {}) => ({ id, title, needs, rule: (p, now) => ({ when: typeof when === "function" ? when(p, now) : when, if: [], do: [{ type: "remind", text: title }], title, ...extra }) });
export const RECIPES = [
  { id: "salary", icon: "₤", title: "Salary day", fits: (p) => p.salaryDay > 0, why: "You get a salary on day {d}",
    rules: [R("split", "Split the salary", () => true, { type: "money_in", what: "salary" }),
      R("rent", "Pay the rent", (p) => p.rent > 0, T(9, 0, { monthly: true, dom: 1 })),
      R("gameya", "Pay the gam'eya", (p) => p.gameya > 0, T(9, 0, { monthly: true, dom: 1 })),
      R("save", "Move savings to the fund", (p) => !!p.carFund, (p) => T(10, 0, { monthly: true, dom: p.salaryDay }))] },
  { id: "ramadan", icon: "☾", title: "Ramadan", fits: (p, now) => !!p.prayersOn && (() => { const r = nextRamadan(now); return r != null && daysTo(r, now) <= 120; })(), why: "Ramadan starts in {n} days",
    rules: [R("suhoor", "Suhoor", () => true, (p, now) => { const r = nextRamadan(now); return T(3, 30, { from: r, until: r + 30 * DAY }); }),
      R("zakat", "Pay zakat before Eid", () => true, (p, now) => { const r = nextRamadan(now); return T(10, 0, { from: r + 20 * DAY, once: true }); }),
      R("eidiya", "Get the eidiya money ready", (p) => (p.family || []).length > 0 || p.kids > 0, (p, now) => { const r = nextRamadan(now); return T(18, 0, { from: r + 25 * DAY, once: true }); })] },
  { id: "school", icon: "✎", title: "School year", fits: (p) => p.kids > 0, why: "You have children at school",
    rules: [R("fees", "School fees", () => true, T(9, 0, { monthly: true, dom: 1 })),
      R("bag", "Pack the school bag", () => true, (p) => T(21, 0, { days: [0, 1, 2, 3, 4, 5, 6].filter((d) => !(p.weekend || [5, 6]).includes((d + 1) % 7)) }))] },
  { id: "trip", icon: "✈", title: "A trip", fits: (p, now) => p.tripAt > now && p.tripAt - now <= 120 * DAY, why: "You have a trip in {n} days",
    rules: [R("papers", "Check passport and visa", (p, now) => p.tripAt - 30 * DAY > (now || Date.now()), (p) => T(10, 0, { from: dayBefore(p.tripAt, 30), once: true })),
      R("pack", "Pack for the trip", () => true, (p) => T(19, 0, { from: dayBefore(p.tripAt, 2), once: true }))] },
  { id: "car", icon: "🚗", title: "The car", fits: (p) => !!p.car, why: "Your car's papers and service",
    rules: [R("licence", "Renew the car licence", (p) => p.licenceAt > 0, (p) => T(10, 0, { from: dayBefore(p.licenceAt, 30), once: true })),
      R("check", "Check the oil and tyres", () => true, T(10, 0, { monthly: true, dom: 1 }))] },
  { id: "baby", icon: "♡", title: "New baby", fits: (p) => !!p.baby, why: "Checkups and vaccines",
    rules: [R("checkup", "Baby checkup", () => true, T(10, 0, { monthly: true, dom: 1 }))] },
];
/** The gallery for this person: every recipe that fits, nearest moment first, each with the rules that will be switched on. */
export function gallery(p = {}, now = Date.now()) {
  const out = [];
  for (const r of RECIPES) {
    let fit = false; try { fit = !!r.fits(p, now); } catch (e) {}
    if (!fit) continue;
    const on = r.rules.filter((x) => { try { return !!x.needs(p, now); } catch (e) { return false; } });
    const soon = r.id === "ramadan" ? daysTo(nextRamadan(now), now) : r.id === "trip" ? daysTo(p.tripAt, now) : r.id === "salary" ? ((p.salaryDay - new Date(now).getDate() + 31) % 31) : 999;
    out.push({ id: r.id, icon: r.icon, title: r.title, why: r.why, n: soon, d: p.salaryDay, on: on.map((x) => x.id), off: r.rules.filter((x) => !on.includes(x)).map((x) => x.id), rules: r.rules.map((x) => ({ id: x.id, title: x.title, on: on.includes(x), rule: on.includes(x) ? x.rule(p, now) : null })) });
  }
  return out.sort((a, b) => a.n - b.n);
}
