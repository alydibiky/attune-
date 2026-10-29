/* ---- v8.7 (Ali, 29 Oct: "I want a year plan with months in it, like in Excel, as if I am doing it in Excel") -----------------------
   The year as a sheet: rows = where money comes from (income sources), the fixed payments (People & plans + Money's repeating
   bills), the savings goals (planner pots) and everyday spending (by category); columns = January … December + the year's total;
   then the totals and "Free" (income − everything planned) for each month.
     past months      what really happened (Money's ledger) — marked "actual"
     this month on    the plan: the usual income per source and the usual spending per category (last 3 months' average),
                      the fixed payments on their real dates, each goal's monthly share (a fixed amount, or its target spread)
     any cell         can be typed over, like Excel (overrides, kept on the phone) — the totals follow
   Pure: stores in, the sheet out. The page draws it and saves it as an .xlsx (convert.js xlsxFromRows).
   Tests: tests/unit/v870yearplan.test.mjs.                                                                                  */
import { scheduleOf } from "./life.js";
import { averages, monthsTo } from "./planner.js";
import { catName } from "./money-report.js";

export const YEARPLAN_KEY = "attune:yearplan:v1";
const r0 = (v) => Math.round(v || 0);
const ym = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}`;
const srcKey = (t) => { const n = String(t.note || "").replace(/\s+/g, " ").trim().slice(0, 28); return n ? ["src:" + n.toLowerCase(), n.charAt(0).toUpperCase() + n.slice(1)] : ["src:" + (t.cat || "other"), null]; };

export const loadYearPlan = (s = typeof localStorage !== "undefined" ? localStorage : null) => { try { const v = JSON.parse((s && s.getItem(YEARPLAN_KEY)) || "null"); return v && v.cells ? v : { cells: {} }; } catch (e) { return { cells: {} }; } };
export const saveYearPlan = (v, s = typeof localStorage !== "undefined" ? localStorage : null) => { try { s && s.setItem(YEARPLAN_KEY, JSON.stringify(v)); } catch (e) {} return v; };
/** Type a number into a cell (empty / null = back to the plan). */
export function setCell(plan, rowId, month, value) {
  const cells = { ...((plan && plan.cells) || {}) }, k = rowId + "|" + month;
  if (value === "" || value == null || !isFinite(+value)) delete cells[k]; else cells[k] = Math.max(0, +value);
  return { ...(plan || {}), cells };
}

/** → { year, months: ["2026-01"…], nowIdx, groups: [{ id, label, rows: [{ id, label, cells: [n×12], actual: [bool×12], typed: [bool×12], total }] }],
 *      income: [n×12], out: [n×12], free: [n×12], totals: { income, out, free } } */
export function yearGrid({ ledger, life, pots, plan, year, now = Date.now(), ar = false } = {}) {
  const n = new Date(now), Y = year || n.getFullYear(), nowYm = ym(n.getFullYear(), n.getMonth());
  const months = Array.from({ length: 12 }, (_, m) => ym(Y, m)), nowIdx = months.indexOf(nowYm);
  const past = (k) => months[k] < nowYm;
  const txns = ((ledger && ledger.txns) || []).filter((t) => t && (t.type === "income" || t.type === "expense") && t.date);
  const cells = (plan && plan.cells) || {};
  const groups = [];
  const row = (id, label, planOf, actualOf) => {
    const r = { id, label, cells: [], actual: [], typed: [] };
    months.forEach((mo, k) => {
      const typed = cells[id + "|" + mo];
      if (typed != null) { r.cells.push(typed); r.typed.push(true); r.actual.push(false); return; }
      if (past(k) && actualOf) { r.cells.push(r0(actualOf(mo))); r.actual.push(true); r.typed.push(false); return; }
      r.cells.push(r0(planOf(mo, k))); r.actual.push(false); r.typed.push(false);
    });
    r.total = r.cells.reduce((a, v) => a + v, 0);
    return r;
  };
  // ---- income, by source (the payer / note) — the usual: the last 3 months' average of each source
  const from3 = (() => { const d = new Date(n.getFullYear(), n.getMonth() - 3, 1); return ym(d.getFullYear(), d.getMonth()); })();
  const src = {};
  for (const t of txns) if (t.type === "income") {
    const [id, name] = srcKey(t), s = src[id] || (src[id] = { id, name: name || catName(ledger, t.cat || "other", ar), months: {}, recent: 0, recentMonths: new Set() });
    const mo = t.date.slice(0, 7); s.months[mo] = (s.months[mo] || 0) + (+t.amount || 0);
    if (mo >= from3 && mo < nowYm) { s.recent += +t.amount || 0; s.recentMonths.add(mo); }
  }
  const incRows = Object.values(src).filter((s) => s.recent > 0 || months.some((mo) => s.months[mo]))
    .map((s) => row(s.id, s.name, (mo) => (mo === nowYm && s.months[mo] ? Math.max(s.months[mo], s.recent / 3) : s.recent / 3), (mo) => s.months[mo] || 0))
    .sort((a, b) => b.total - a.total);
  // (typed rows the person added by hand: plan.extra = [{ id, group, label }])
  const extra = (plan && plan.extra) || [];
  for (const x of extra.filter((x) => x.group === "income")) incRows.push(row(x.id, x.label, () => 0, null));
  groups.push({ id: "income", label: ar ? "الدخل" : "Income", rows: incRows });
  // ---- fixed: People & plans' payments on their dates + Money's repeating bills
  const fixed = [];
  for (const c of (life && life.items) || []) {
    if (c.dir !== "out" || c.done) continue;
    let sched = []; try { sched = scheduleOf(c, Date.parse(Y + "-12-31T12:00:00")); } catch (e) {}
    const by = {}; for (const s of sched) if (!s.open && s.date && s.date.startsWith(String(Y))) by[s.date.slice(0, 7)] = (by[s.date.slice(0, 7)] || 0) + (+s.amount || 0);
    if (!Object.keys(by).length) continue;
    fixed.push(row("life:" + c.id, [c.person, c.title || c.kind].filter(Boolean).join(" · "), (mo) => by[mo] || 0, (mo) => by[mo] || 0));
  }
  for (const b of (ledger && ledger.recurring) || []) {
    if (b.active === false || b.type === "income") continue;
    const every = b.freq === "yearly" ? 12 : b.freq === "quarterly" ? 3 : 1, start = String(b.nextDate || "").slice(0, 7);
    fixed.push(row("bill:" + (b.id || b.note), String(b.note || b.cat || "Bill").replace(" ↻", ""), (mo) => {
      if (!start) return +b.amount || 0;
      const diff = (+mo.slice(0, 4) - +start.slice(0, 4)) * 12 + (+mo.slice(5) - +start.slice(5));
      return diff >= 0 && diff % every === 0 ? +b.amount || 0 : 0;
    }, null));
  }
  for (const x of extra.filter((x) => x.group === "fixed")) fixed.push(row(x.id, x.label, () => 0, null));
  groups.push({ id: "fixed", label: ar ? "الثابت" : "Fixed", rows: fixed });
  // ---- savings goals: a fixed amount a month, or what is left of the target spread over the months to its date
  const avg = averages(ledger, now);
  const sav = ((pots && pots.pots) || []).map((p) => {
    const target = p.kind === "emergency" && !(p.target > 0) ? r0(avg.total * 3) : +p.target || 0;
    let left = Math.max(0, target - (p.saved || 0));
    const per = p.per > 0 ? p.per : left > 0 ? Math.ceil(left / (monthsTo(p.by, now) || 12)) : 0;
    const putIn = {}; for (const x of p.log || []) putIn[String(x.d).slice(0, 7)] = (putIn[String(x.d).slice(0, 7)] || 0) + (+x.a || 0);
    return row("pot:" + p.id, (ar ? "تحويش: " : "Save: ") + p.name, (mo, k) => {
      if (mo < nowYm) return 0;
      if (p.by && mo > p.by) return 0;
      if (p.per > 0 && !target) return per;
      // a goal with a total stops when it is full
      const before = months.slice(Math.max(0, nowIdx), k).length * per, still = left - before;
      return still > 0 ? Math.min(per, still) : 0;
    }, (mo) => putIn[mo] || 0);
  });
  for (const x of extra.filter((x) => x.group === "savings")) sav.push(row(x.id, x.label, () => 0, null));
  groups.push({ id: "savings", label: ar ? "التحويش" : "Savings", rows: sav });
  // ---- everyday spending by category: past = actual, coming = the last 3 months' average
  const SKIP = new Set(["rent", "bills", "salary", "invoice"]);
  const spent = {};
  for (const t of txns) if (t.type === "expense" && !SKIP.has(t.cat || "other")) { const c = t.cat || "other", mo = t.date.slice(0, 7); (spent[c] || (spent[c] = {}))[mo] = (spent[c][mo] || 0) + (+t.amount || 0); }
  const cats = [...new Set([...Object.keys(avg.by).filter((c) => !SKIP.has(c)), ...Object.keys(spent)])];
  const every = cats.map((c) => row("cat:" + c, catName(ledger, c, ar), () => avg.by[c] || 0, (mo) => (spent[c] || {})[mo] || 0)).filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
  for (const x of extra.filter((x) => x.group === "everyday")) every.push(row(x.id, x.label, () => 0, null));
  groups.push({ id: "everyday", label: ar ? "المصاريف العادية" : "Everyday", rows: every });
  // ---- the totals and what is free each month
  const col = (gid) => months.map((_, k) => groups.find((g) => g.id === gid).rows.reduce((a, r) => a + r.cells[k], 0));
  const income = col("income"), fx = col("fixed"), sv = col("savings"), ev = col("everyday");
  const out = months.map((_, k) => fx[k] + sv[k] + ev[k]), free = months.map((_, k) => income[k] - out[k]);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  return { year: Y, months, nowIdx, groups, income, out, free, totals: { income: sum(income), out: sum(out), free: sum(free), savings: sum(sv) } };
}

/** The sheet as rows for Excel (convert.js xlsxFromRows): a header, each group's rows, the totals and Free. */
export function yearRows(g, ar = false) {
  const head = [ar ? "البند" : "Item", ...g.months.map((m) => new Date(m + "-15").toLocaleDateString(ar ? "ar-EG-u-nu-latn" : "en", { month: "short" })), ar ? "إجمالي السنة" : "Year"];
  const rows = [head];
  for (const gr of g.groups) {
    rows.push([gr.label.toUpperCase(), ...g.months.map(() => ""), ""]);
    for (const r of gr.rows) rows.push(["  " + r.label, ...r.cells, r.total]);
  }
  rows.push([ar ? "إجمالي الدخل" : "Total income", ...g.income, g.totals.income]);
  rows.push([ar ? "إجمالي المصروف والتحويش" : "Total out (incl. savings)", ...g.out, g.totals.out]);
  rows.push([ar ? "الحر" : "Free", ...g.free, g.totals.free]);
  return rows;
}

/** v8.7 (Ali picked 1B: "goals first, Attune spreads them"): each goal as the year sees it — how much a month, from which month
 *  to which, and the months where the plan runs short (free < 0) while it is saving. → [{ id, name, monthly, first, last,
 *  months: [k…], tight: [k…], total }] and the average free money a month after the goals (coming months only). */
export function goalsOfYear(g, now = Date.now()) {
  const sav = (g.groups.find((x) => x.id === "savings") || { rows: [] }).rows;
  const goals = sav.filter((r) => r.id.startsWith("pot:")).map((r) => {
    const months = r.cells.map((v, k) => (v > 0 && !r.actual[k] ? k : -1)).filter((k) => k >= 0);
    return { id: r.id.slice(4), name: r.label.replace(/^(Save: |تحويش: )/, ""), monthly: months.length ? Math.max(...months.map((k) => r.cells[k])) : 0,
      first: months.length ? months[0] : -1, last: months.length ? months[months.length - 1] : -1, months, tight: months.filter((k) => g.free[k] < 0), total: r.total };
  });
  const later = g.nowIdx < 0 && g.year > new Date(now).getFullYear();
  const coming = g.months.map((_, k) => k).filter((k) => (g.nowIdx >= 0 ? k >= g.nowIdx : later));
  const freeAvg = coming.length ? Math.round(coming.reduce((a, k) => a + g.free[k], 0) / coming.length) : 0;
  return { goals, freeAvg, coming };
}
