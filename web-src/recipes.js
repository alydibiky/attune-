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

/** profile: { salaryDay, rent, gameya, carFund, family:[name], car, kids, tripAt, baby, prayersOn } */
export const RECIPES = [
  { id: "salary", icon: "₤", title: "Salary day", fits: (p) => p.salaryDay > 0, why: "You get a salary on the {d}th",
    rules: [{ id: "split", title: "Split the salary", needs: () => true, rule: { when: { type: "money_in", what: "salary" }, if: [], do: [{ type: "salary_sort" }] } },
      { id: "rent", title: "Pay rent on the 1st", needs: (p) => p.rent > 0, rule: { when: { type: "time", at: { h: 9, m: 0 }, monthly: true, dom: 1 }, if: [], do: [{ type: "remind", text: "rent" }] } },
      { id: "gameya", title: "Gam'eya reminder", needs: (p) => p.gameya > 0, rule: { when: { type: "time", at: { h: 9, m: 0 }, monthly: true, dom: 1 }, if: [], do: [{ type: "remind", text: "gameya" }] } },
      { id: "save", title: "Move savings to the fund", needs: (p) => !!p.carFund, rule: { when: { type: "money_in", what: "salary" }, if: [], do: [{ type: "pot", pct: 10, pot: "fund" }] } }] },
  { id: "ramadan", icon: "☾", title: "Ramadan", fits: (p, now) => !!p.prayersOn && (() => { const r = nextRamadan(now); return r != null && daysTo(r, now) <= 120; })(), why: "Ramadan starts in {n} days",
    rules: [{ id: "suhoor", title: "Suhoor alarm", needs: () => true, rule: { when: { type: "time", at: { h: 3, m: 30 } }, if: [], do: [{ type: "remind", text: "suhoor" }] } },
      { id: "zakat", title: "Zakat reminder", needs: () => true, rule: { when: { type: "time", at: { h: 10, m: 0 } }, if: [], do: [{ type: "remind", text: "zakat" }] } },
      { id: "eidiya", title: "Eid gift list", needs: (p) => (p.family || []).length > 0 || p.kids > 0, rule: { when: { type: "time", at: { h: 10, m: 0 } }, if: [], do: [{ type: "list_add", list: "eid" }] } }] },
  { id: "school", icon: "✎", title: "School year", fits: (p) => p.kids > 0, why: "You have {k} children at school",
    rules: [{ id: "fees", title: "School fees reminders", needs: () => true, rule: { when: { type: "time", at: { h: 9, m: 0 } }, if: [], do: [{ type: "remind", text: "fees" }] } },
      { id: "bag", title: "Pack the school bag the night before", needs: () => true, rule: { when: { type: "time", at: { h: 21, m: 0 } }, if: [{ type: "weekdays" }], do: [{ type: "remind", text: "bag" }] } }] },
  { id: "trip", icon: "✈", title: "A trip", fits: (p, now) => p.tripAt > now && p.tripAt - now <= 120 * DAY, why: "You have a trip in {n} days",
    rules: [{ id: "papers", title: "Check the papers a month before", needs: () => true, rule: { when: { type: "time", at: { h: 10, m: 0 } }, if: [], do: [{ type: "remind", text: "papers" }] } },
      { id: "pack", title: "Packing list 2 days before", needs: () => true, rule: { when: { type: "time", at: { h: 19, m: 0 } }, if: [], do: [{ type: "show", what: "list", list: "travel" }] } }] },
  { id: "car", icon: "🚗", title: "The car", fits: (p) => !!p.car, why: "Your car's papers and service",
    rules: [{ id: "licence", title: "Licence 30 days before", needs: () => true, rule: { when: { type: "time", at: { h: 10, m: 0 } }, if: [], do: [{ type: "remind", text: "licence" }] } },
      { id: "oil", title: "Oil change by km", needs: () => true, rule: { when: { type: "time", at: { h: 10, m: 0 } }, if: [], do: [{ type: "remind", text: "oil" }] } }] },
  { id: "baby", icon: "♡", title: "New baby", fits: (p) => !!p.baby, why: "Vaccines, feeds and checkups",
    rules: [{ id: "vaccines", title: "Vaccine dates", needs: () => true, rule: { when: { type: "time", at: { h: 10, m: 0 } }, if: [], do: [{ type: "remind", text: "vaccine" }] } },
      { id: "checkup", title: "Monthly checkup", needs: () => true, rule: { when: { type: "time", at: { h: 10, m: 0 }, monthly: true, dom: 1 }, if: [], do: [{ type: "remind", text: "checkup" }] } }] },
];
/** The gallery for this person: every recipe that fits, nearest moment first, each with the rules that will be switched on. */
export function gallery(p = {}, now = Date.now()) {
  const out = [];
  for (const r of RECIPES) {
    let fit = false; try { fit = !!r.fits(p, now); } catch (e) {}
    if (!fit) continue;
    const on = r.rules.filter((x) => { try { return !!x.needs(p); } catch (e) { return false; } });
    const soon = r.id === "ramadan" ? daysTo(nextRamadan(now), now) : r.id === "trip" ? daysTo(p.tripAt, now) : r.id === "salary" ? ((p.salaryDay - new Date(now).getDate() + 31) % 31) : 999;
    out.push({ id: r.id, icon: r.icon, title: r.title, why: r.why, n: soon, on: on.map((x) => x.id), off: r.rules.filter((x) => !on.includes(x)).map((x) => x.id) });
  }
  return out.sort((a, b) => a.n - b.n);
}
