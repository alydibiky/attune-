/* ---- v6.27: the phone Home's TODAY list (design A "Calm") — pure logic, used by home-ui.jsx; tests: tests/unit/v727home.test.mjs ---- */
import { tr } from "./i18n.js";
import { dueSoon } from "./life.js";
import { moneyOverview } from "./money-calm.js";
import { radarToday } from "./deadlines.js";

export /** What is due today and this week, from People & plans and Money's bills — at most `max`, the late ones first. Pure. */
function todayList({ life, ledger, radar, now = Date.now(), max = 4 }) {
  const out = [];
  for (const x of dueSoon(life || { items: [] }, now, 7)) {
    const c = x.c, who = c.person || "";
    const title = c.kind === "installment" ? (who ? tr("{p} · installment {i} of {n}", { p: who, i: x.i + 1, n: c.count }) : tr("Installment {i} of {n}", { i: x.i + 1, n: c.count }))
      : c.kind === "circle" ? tr("Savings circle · {i} of {n}", { i: x.i + 1, n: c.count }) : c.kind === "debt" ? (c.dir === "in" ? tr("{p} pays you back", { p: who }) : tr("Pay {p} back", { p: who }))
      : (c.title ? c.title[0].toUpperCase() + c.title.slice(1) : tr("Bill"));
    out.push({ from: "life", title, date: x.date, amount: x.amount, dir: c.dir, late: x.late });
  }
  for (const b of moneyOverview(ledger, now).due) out.push({ from: "money", title: b.note, date: b.date, amount: b.amount, dir: "out", late: b.late });
  // v6.27 Deadline Radar: a trial / return / warranty / document inside its warning window
  const RL = { trial: "Free trial ends", renewal: "Renews", return: "Last day to return", warranty: "Warranty ends", expiry: "Expires", other: "Deadline" };
  for (const x of radarToday(radar || { items: [] }, now)) out.push({ from: "radar", title: tr(RL[x.kind] || "Deadline") + ": " + (x.title || ""), date: x.date, amount: x.amount || 0, dir: "out", late: false });
  return out.sort((a, b) => (b.late - a.late) || a.date.localeCompare(b.date)).slice(0, max);
}

