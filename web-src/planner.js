/* ---- v8.7 Money planner (Ali, 28 Oct: "a money planner that plans my monthly spending and spares for travelling, emergency, etc")
   The idea comes from Actual Budget (MIT, github.com/actualbudget/actual): envelope budgeting — every pound of the month's income
   gets a job — and its goal templates ("save 20,000 by June" = a sinking fund: what is left ÷ the months left). Written here from
   scratch for Attune's own data (no code copied):
     income this month (what came in, else the usual monthly income)
     − fixed: bills, rent, subscriptions, instalments and debts due this month (People & plans + Money's repeating bills)
     − pots: emergency (3 months of spending by default), travel, a car, Eid… each with a target and a date → this month's share
     − flexible: food, transport, groceries… — the last 3 months' average, scaled down when the money doesn't reach
     = free to spend
   Pure: stores in, the plan out. The screen prints it; Safe to spend keeps the pots aside.                                     */
import { scheduleOf } from "./life.js";
import { catName, looksLikeId } from "./money-report.js";

export const POTS_KEY = "attune:pots:v1";
const DAY = 864e5;
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const r0 = (v) => Math.round(v);
const FLEX_SKIP = new Set(["rent", "bills", "salary", "invoice"]);   // fixed, or not spending

export function loadPots(store = typeof localStorage !== "undefined" ? localStorage : null) {
  try { const v = JSON.parse(store.getItem(POTS_KEY) || "null"); return v && Array.isArray(v.pots) ? v : { v: 1, pots: [] }; } catch (e) { return { v: 1, pots: [] }; }
}
export function savePots(data, store = typeof localStorage !== "undefined" ? localStorage : null) { try { store.setItem(POTS_KEY, JSON.stringify(data)); } catch (e) {} return data; }

/** A pot: { id, name, kind: emergency|travel|car|eid|school|wedding|other, target, by: "YYYY-MM" | "", saved, log: [{d, a}],
 *  per: a fixed amount every month (v8.7, Ali: "I write I want to save 4000 for travelling, so at the end of the year I save 48000") } */
export function addPot(data, p, now = Date.now()) {
  const pot = { id: "pot" + now.toString(36), name: String(p.name || "").slice(0, 40) || "Savings", kind: p.kind || "other", target: Math.max(0, +p.target || 0), by: p.by || "", saved: Math.max(0, +p.saved || 0), per: Math.max(0, +p.per || 0), log: [], created: now };
  // one pot per name — and one emergency pot (EN and AR names are the same pot)
  return { ...data, pots: [...(data.pots || []).filter((x) => x.name.toLowerCase() !== pot.name.toLowerCase() && !(pot.kind !== "other" && x.kind === pot.kind)), pot] };
}
/** Money put into (or taken out of, a < 0) a pot. */
export function fundPot(data, id, a, now = Date.now()) {
  return { ...data, pots: (data.pots || []).map((p) => (p.id === id ? { ...p, saved: Math.max(0, r0((p.saved || 0) + a)), log: [...(p.log || []), { d: iso(new Date(now)), a: r0(a) }].slice(-120) } : p)) };
}

/** Months from this month to "YYYY-MM" inclusive (at least 1). */
export function monthsTo(by, now = Date.now()) {
  if (!/^\d{4}-\d{2}$/.test(by || "")) return 0;
  const n = new Date(now), [y, m] = by.split("-").map(Number);
  return Math.max(1, (y - n.getFullYear()) * 12 + (m - 1 - n.getMonth()) + 1);
}

/** The average monthly spending per category over the last `months` full months: { cat: avg }, and the total. */
export function averages(ledger, now = Date.now(), months = 3) {
  const n = new Date(now), from = iso(new Date(n.getFullYear(), n.getMonth() - months, 1)), to = iso(new Date(n.getFullYear(), n.getMonth(), 0));
  const by = {}, notes = {}; let total = 0;
  const seen = new Set();
  for (const t of (ledger && ledger.txns) || []) {
    if (t.type !== "expense" || !(t.date >= from && t.date <= to)) continue;
    seen.add(t.date.slice(0, 7));
    const c = t.cat || "other"; by[c] = (by[c] || 0) + (+t.amount || 0); total += +t.amount || 0;
    const nt = String(t.note || "").replace(" ↻", "").trim();
    if (nt) { const m = notes[c] || (notes[c] = {}); m[nt] = (m[nt] || 0) + 1; }
  }
  const k = Math.max(1, Math.min(months, seen.size));
  for (const c of Object.keys(by)) by[c] = by[c] / k;
  // v9.5 (Ali, 5 Nov: "I want the category with the note if there is"): the note most entries of a category carry
  const note = {};
  for (const [c, m] of Object.entries(notes)) { const top = Object.entries(m).sort((x, y) => y[1] - x[1])[0]; if (top) note[c] = top[0].slice(0, 40); }
  return { by, total: total / k, months: seen.size, note };
}

/** The usual monthly income: this month's if it came, else the average of the last 3 months. */
function incomeOf(ledger, now) {
  const n = new Date(now), m0 = iso(new Date(n.getFullYear(), n.getMonth(), 1)), from = iso(new Date(n.getFullYear(), n.getMonth() - 3, 1));
  const tx = ((ledger && ledger.txns) || []).filter((t) => t.type === "income");
  const thisMonth = tx.filter((t) => t.date >= m0).reduce((a, t) => a + (+t.amount || 0), 0);
  const before = tx.filter((t) => t.date >= from && t.date < m0), months = new Set(before.map((t) => t.date.slice(0, 7))).size;
  const avg = months ? before.reduce((a, t) => a + (+t.amount || 0), 0) / months : 0;
  return { value: Math.max(thisMonth, avg), came: thisMonth, usual: avg };
}

/**
 * The month's plan. → { month: "YYYY-MM", income, incomeCame, fixed: [{what, amount, date}], fixedTotal, pots: [{…pot, monthly,
 *   left, months, onTrack}], potsTotal, flexible: [{cat, avg, plan}], flexTotal, free, short, tips: [[text, vars]] }
 * opts.income overrides the income (the person typed "my salary is 25,000").
 */
export function planMonth({ ledger, life, pots, now = Date.now(), income: inc = 0 } = {}) {
  const n = new Date(now), m0 = new Date(n.getFullYear(), n.getMonth(), 1, 12), m1 = new Date(n.getFullYear(), n.getMonth() + 1, 0, 12);
  const from = iso(m0), to = iso(m1);
  const inc0 = incomeOf(ledger, now), income = r0(inc || inc0.value);
  // fixed: what People & plans and Money's repeating bills say is due this month
  const fixed = [];
  for (const c of (life && life.items) || []) {
    if (c.dir !== "out" || c.done) continue;
    for (const s of scheduleOf(c, at12(to))) if (!s.open && s.date >= from && s.date <= to) fixed.push({ what: [c.person, c.title || c.kind].filter(Boolean).join(" · "), amount: r0(+s.amount || 0), date: s.date, paid: !!s.paid });
  }
  for (const r of (ledger && ledger.recurring) || []) {
    if (r.active === false || r.type === "income") continue;
    if (!fixed.some((f) => f.what.toLowerCase().includes(String(r.note || "").toLowerCase().slice(0, 8)))) fixed.push({ what: (r.note || r.cat || "Bill").replace(" ↻", ""), amount: r0(+r.amount || 0), date: "", paid: false });
  }
  const fixedTotal = fixed.reduce((a, f) => a + f.amount, 0);
  // pots: this month's share of each target
  const avg = averages(ledger, now);
  const potList = ((pots && pots.pots) || []).map((p) => {
    const putThisMonth = (p.log || []).filter((x) => x.d >= from && x.d <= to).reduce((a, x) => a + x.a, 0);
    // v8.7 a fixed amount a month ("save 4000 a month for travel"): the month's share is that amount; the year adds up to ×12
    const monthsLeftYear = 12 - n.getMonth();
    if (p.per > 0) {
      const target = +p.target || 0, left = target ? Math.max(0, target - (p.saved || 0)) : 0;
      return { ...p, target, left, months: monthsTo(p.by, now) || monthsLeftYear, monthly: target && left < p.per ? left : p.per, putThisMonth, onTrack: putThisMonth >= p.per,
        yearMonths: 12, yearly: p.per * 12, byYearEnd: r0((p.saved || 0) + p.per * Math.max(0, monthsLeftYear - (putThisMonth >= p.per ? 1 : 0))) };
    }
    const target = p.kind === "emergency" && !(p.target > 0) ? r0(avg.total * 3) : +p.target || 0;
    const left = Math.max(0, target - (p.saved || 0)), months = monthsTo(p.by, now) || (p.kind === "emergency" ? 12 : 12);
    const monthly = left > 0 ? Math.ceil(left / months) : 0;
    const inYear = Math.min(months, monthsLeftYear);
    // a goal with a total stops when it is full: the year counts only the months it still needs
    const yearMonths = monthly > 0 ? Math.min(12, Math.ceil(left / monthly)) : 0;
    return { ...p, target, left, months, monthly, putThisMonth, onTrack: putThisMonth >= monthly,
      yearMonths, yearly: Math.min(left, monthly * yearMonths), byYearEnd: r0(Math.min(target || Infinity, (p.saved || 0) + monthly * Math.max(0, inYear - (putThisMonth >= monthly ? 1 : 0)))) };
  });
  const potsTotal = potList.reduce((a, p) => a + p.monthly, 0);
  // flexible: the last 3 months' average per category (fixed categories left out)
  let flexible = Object.entries(avg.by).filter(([c]) => !FLEX_SKIP.has(c)).map(([cat, a]) => ({ cat, avg: r0(a), plan: r0(a), note: (avg.note || {})[cat] || "" })).sort((a, b) => b.avg - a.avg);
  let flexTotal = flexible.reduce((a, f) => a + f.plan, 0);
  const room = income - fixedTotal - potsTotal;
  const tips = [];
  if (flexTotal > room && flexTotal > 0) {
    // not enough: every flexible category comes down by the same share (the person can move it), never below 0
    const k = Math.max(0, room) / flexTotal;
    flexible = flexible.map((f) => ({ ...f, plan: r0(f.avg * k) }));
    flexTotal = flexible.reduce((a, f) => a + f.plan, 0);
    tips.push(["To keep your savings goals, spend about {p}% less than usual on everyday things this month.", { p: r0((1 - k) * 100) }]);
  }
  const free = income - fixedTotal - potsTotal - flexTotal;
  const short = free < 0 ? -free : 0;
  if (short > 0) tips.push(["Your fixed costs and goals are {a} more than your income — move a goal's date, or lower a target.", { a: short }]);
  if (!potList.some((p) => p.kind === "emergency") && avg.total > 0) tips.push(["No emergency pot yet: 3 months of your spending is about {a}.", { a: r0(avg.total * 3) }]);
  if (!income) tips.push(["Add your income (say “salary 25,000”) to plan the month.", {}]);
  // v8.7 the year: each goal's monthly share ×12, and what will be saved by 31 December at this pace
  const year = { savedPerYear: potList.reduce((a, p) => a + (p.yearly || 0), 0), byYearEnd: potList.reduce((a, p) => a + (p.byYearEnd || 0), 0), incomeYear: income * 12, year: n.getFullYear() };
  return { year, month: from.slice(0, 7), income, incomeCame: r0(inc0.came), fixed, fixedTotal, pots: potList, potsTotal, flexible, flexTotal,
    free: Math.max(0, r0(free)), short: r0(short), tips, basedOn: avg.months };
}
const at12 = (d) => Date.parse(d + "T12:00:00");

/* ---- the Home box: «حوّش ٢٠ الف للسفر لحد يونيو», "save 20000 for travel by June", "emergency fund 50000" -------------------- */
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const AR_M = ["يناير", "فبراير", "مارس", "أبريل|ابريل", "مايو", "يونيو", "يوليو", "أغسطس|اغسطس", "سبتمبر", "أكتوبر|اكتوبر", "نوفمبر", "ديسمبر"];
const KINDS = [["emergency", /emergency|طوارئ|الطوارئ|للزمن|للظروف/i], ["travel", /travel|trip|holiday|vacation|سفر|السفر|سفرية|رحلة|المصيف|مصيف/i], ["car", /\bcar\b|عربية|العربية/i],
  ["eid", /\beid\b|العيد|عيد/i], ["school", /school|tuition|المدارس|مدارس|مصاريف المدرسة/i], ["wedding", /wedding|marriage|جواز|الجواز|فرح/i]];
const NAMES = { emergency: ["Emergency", "الطوارئ"], travel: ["Travel", "السفر"], car: ["Car", "العربية"], eid: ["Eid", "العيد"], school: ["School", "المدارس"], wedding: ["Wedding", "الجواز"], other: ["Savings", "تحويش"] };
/** → { name, kind, target, by } or null */
export function potIntent(text, now = Date.now()) {
  const t = String(text || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).trim();
  if (!/\b(save|saving|savings|set aside|put aside|fund|pot)\b|حوّش|حوش|احوش|أحوش|وفر|اوفر|أوفر|تحويش|ادخر|أدخر|ادخار/i.test(t)) return null;
  if (/[?؟]\s*$/.test(t) || /\b(how|should|can i|tips?|advice)\b|ازاي|إزاي|ليه|نصيحة/i.test(t)) return null;
  const kind = (KINDS.find(([, re]) => re.test(t)) || ["other"])[0];
  const am = /(\d[\d,.]*)\s*(k|الف|ألف|آلاف|الاف|thousand)?/i.exec(t.replace(/\b(?:in|في|خلال|على) \d{1,2} (?:months?|شهر|شهور)\b/gi, " "));
  // "emergency fund" with no amount: 3 months of spending, worked out by the planner (target 0 = automatic)
  const target = am ? +am[1].replace(/,/g, "") * (am[2] ? 1000 : 1) : kind === "emergency" ? 0 : NaN; if (!(target >= 0)) return null;
  const n = new Date(now); let by = "";
  const mi = MONTHS.findIndex((m) => new RegExp("\\b" + m, "i").test(t)), ai = AR_M.findIndex((m) => new RegExp(m).test(t)), mo = mi >= 0 ? mi : ai;
  if (mo >= 0) { const y = /\b(20\d\d)\b/.exec(t); const yy = y ? +y[1] : mo < n.getMonth() || (mo === n.getMonth()) ? n.getFullYear() + 1 : n.getFullYear(); by = `${yy}-${String(mo + 1).padStart(2, "0")}`; }
  else { const inM = /\bin (\d{1,2}) months?\b|(?:في|خلال|على) (\d{1,2}) (?:شهر|شهور)/i.exec(t); if (inM) { const d = new Date(n.getFullYear(), n.getMonth() + +(inM[1] || inM[2]) - 1, 1); by = iso(d).slice(0, 7); } }
  const ar = /[؀-ۿ]/.test(t);
  // v8.7 (Ali picked 1B, goals first): "save 60k for Umrah by Sep" → the goal is called "Umrah", not "Savings"
  let own = "";
  if (kind === "other") {
    const m = /\bfor (?:a |an |the |my |our )?([^\d,.]+?)(?=\s+(?:by|in|before|until|till|every|each|a month|per)\b|\s*$|[,.])/i.exec(t) || /(?:عشان|علشان)\s+([؀-ۿ ]+?)(?=\s+(?:قبل|في|خلال|على|كل|بحلول)\b|\s*$)/.exec(t) || /(?:^|\s)لل([؀-ۿ]{2,}(?:\s[؀-ۿ]{2,})?)(?=\s+(?:قبل|في|خلال|على|كل|بحلول)|\s*$)/.exec(t);
    if (m) { const w = m[1].trim(); if (w && w.length <= 30) own = /^[؀-ۿ]/.test(w) && !/^ال/.test(w) && m[0].includes("لل") ? "ال" + w : w.charAt(0).toUpperCase() + w.slice(1); }
  }
  const nameOf = own || NAMES[kind][ar ? 1 : 0];
  // v8.7 "4000 a month" / «4000 كل شهر» / «4000 في الشهر»: a fixed monthly amount (the year = ×12), no target needed
  if (/\b(a|per|every|each) month\b|\bmonthly\b|كل شهر|في الشهر|شهريا|شهرياً/i.test(t) && target > 0) return { name: nameOf, kind, target: 0, per: target, by };
  return { name: nameOf, kind, target, by };
}

/** v9.5 (Ali, 5 Nov: "things shown as id … I want the category with the note if there is"): the category's name (never an id
 *  like "cmuu3u3sb2q4sd"), its usual note after it; a category Attune can't name shows its note alone. */
export function flexLabel(f, ledger, ar = false) {
  const custom = ledger && (ledger.customCats || []).some((c) => c.id === f.cat);
  const named = custom || !looksLikeId(f.cat) ? catName(ledger, f.cat, ar) : "";
  if (!named) return f.note || catName(ledger, f.cat, ar);
  return f.note && f.note.toLowerCase() !== String(named).toLowerCase() ? named + " · " + f.note : named;
}

/** v9.5: the same bill more than once a month (the maid every Saturday) is one line: "Maid × 4". */
export function groupFixed(list) {
  const out = [];
  for (const f of list || []) { const o = out.find((x) => x.what === f.what && x.amount === f.amount && !!x.paid === !!f.paid); if (o) o.n++; else out.push({ ...f, n: 1 }); }
  return out;
}

/* ---- v9.6 (Ali, 5 Nov: "I want to set year savings and it goes from the November plan — income vs expenses, and if net profit it
   takes what we agreed for the month to reach the time span or the yearly goal; it doesn't have to be yearly only" — MOCKUPS.md,
   https://claude.ai/artifact/2T2ZRNTemt42fTyvYX6FeY). At the end of each month, by code:
     net = the month's income − its expenses (Money's ledger)
     wanted = what each goal needs that month (a total by a date: what is left ÷ the months left, this one included; a fixed
              amount a month: that amount), less what was put in by hand that month
     net ≥ wanted → wanted goes in; less (or a loss) → only what is there, shared by need — the shortfall is spread by itself,
     because next month each goal's need is worked out again from what is left and the months left.
   Starts with the month the goals page is first opened (data.since), so nothing is settled backwards. Pure. */
const ymOf = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
const nextYm = (m) => { const [y, mo] = m.split("-").map(Number); return mo === 12 ? (y + 1) + "-01" : y + "-" + String(mo + 1).padStart(2, "0"); };
const lastDay = (m) => { const [y, mo] = m.split("-").map(Number); return iso(new Date(y, mo, 0, 12)); };
/** One month's money: { income, expenses, net, count } from the ledger (transfers and gold left out). */
export function monthNet(ledger, m) {
  let income = 0, expenses = 0, count = 0;
  for (const t of (ledger && ledger.txns) || []) {
    if (!t || String(t.date || "").slice(0, 7) !== m) continue;
    if (t.type === "income") { income += +t.amount || 0; count++; } else if (t.type === "expense") { expenses += +t.amount || 0; count++; }
  }
  return { income: r0(income), expenses: r0(expenses), net: r0(income - expenses), count };
}
/** What goal p needs in month m (before what was put in by hand that month). */
export function needIn(p, m) {
  const putByHand = (p.log || []).filter((x) => String(x.d).slice(0, 7) === m && !x.auto).reduce((a, x) => a + x.a, 0);
  const savedBefore = (p.saved || 0) - putByHand;
  let need = 0;
  if (p.per > 0) need = p.target > 0 ? Math.min(p.per, Math.max(0, p.target - savedBefore)) : p.per;
  else if (p.target > 0) { const left = Math.max(0, p.target - savedBefore), months = p.by ? Math.max(1, monthsTo(p.by, Date.parse(m + "-15T12:00:00"))) : 12; need = left > 0 ? Math.ceil(left / months) : 0; }
  return Math.max(0, need - putByHand);
}
/** Settle every finished month since data.since that isn't settled yet. → { data, done: [{ month, net, wanted, put, short, nodata }] } */
export function settleMonths(data, ledger, now = Date.now()) {
  const d = { ...data, pots: [...((data && data.pots) || [])], settled: { ...((data && data.settled) || {}) } };
  const cur = ymOf(now);
  if (!d.since) { d.since = cur; return { data: d, done: [] }; }
  const done = [];
  for (let m = d.since, guard = 0; m < cur && guard < 60; m = nextYm(m), guard++) {
    if (d.settled[m]) continue;
    const mn = monthNet(ledger, m);
    const needs = d.pots.map((p) => needIn(p, m)), wanted = needs.reduce((a, x) => a + x, 0);
    if (!mn.count) { d.settled[m] = { net: 0, wanted, put: 0, short: 0, nodata: true }; done.push({ month: m, ...d.settled[m] }); continue; }
    const put = Math.min(Math.max(0, mn.net), wanted);
    let given = 0;
    d.pots = d.pots.map((p, i) => {
      if (!needs[i] || !put) return p;
      const a = i === d.pots.length - 1 || needs.slice(i + 1).every((x) => !x) ? put - given : Math.floor((needs[i] * put) / wanted);
      if (a <= 0) return p; given += a;
      return { ...p, saved: r0((p.saved || 0) + a), log: [...(p.log || []), { d: lastDay(m), a, auto: m }].slice(-120) };
    });
    d.settled[m] = { net: mn.net, income: mn.income, expenses: mn.expenses, wanted, put, short: wanted - put };
    done.push({ month: m, ...d.settled[m] });
  }
  return { data: d, done };
}
/** Undo month m's settling (what went into the goals comes out; the month is not settled again). */
export function undoSettle(data, m) {
  const pots = ((data && data.pots) || []).map((p) => { const back = (p.log || []).filter((x) => x.auto === m).reduce((a, x) => a + x.a, 0);
    return back ? { ...p, saved: Math.max(0, r0((p.saved || 0) - back)), log: (p.log || []).filter((x) => x.auto !== m) } : p; });
  return { ...data, pots, settled: { ...((data && data.settled) || {}), [m]: { ...(((data || {}).settled || {})[m] || {}), undone: true, put: 0 } } };
}
/** P5 sliders: a goal's monthly amount moved → a total-by-a-date goal gets a new date; a fixed-amount goal a new amount. */
export function setMonthly(data, id, monthly, now = Date.now()) {
  const v = Math.max(0, r0(+monthly || 0));
  return { ...data, pots: ((data && data.pots) || []).map((p) => {
    if (p.id !== id) return p;
    if (p.target > 0 && !(p.per > 0)) { const left = Math.max(0, p.target - (p.saved || 0)); if (!v || !left) return p; const n = Math.max(1, Math.ceil(left / v)), d = new Date(now); d.setDate(15); d.setMonth(d.getMonth() + n - 1); return { ...p, by: ymOf(d) }; }
    return { ...p, per: v };
  }) };
}
/** P6: plan vs actual for the month — fixed bills, everyday categories, goals. → [{ group, what, plan, actual, left }] */
export function planVsActual(plan, ledger, m = plan.month) {
  const spent = {};
  for (const t of (ledger && ledger.txns) || []) if (t && t.type === "expense" && String(t.date || "").slice(0, 7) === m) { const c = t.cat || "other"; spent[c] = (spent[c] || 0) + (+t.amount || 0); }
  const rows = [];
  for (const f of groupFixed(plan.fixed || [])) rows.push({ group: "fixed", what: f.what + (f.n > 1 ? " × " + f.n : ""), plan: f.amount * f.n, actual: f.paid ? f.amount * f.n : 0 });
  for (const f of plan.flexible || []) rows.push({ group: "everyday", cat: f.cat, note: f.note, plan: f.plan, actual: r0(spent[f.cat] || 0) });
  for (const p of plan.pots || []) rows.push({ group: "savings", what: p.name, plan: p.monthly, actual: r0(p.putThisMonth || 0) });
  return rows.map((r) => ({ ...r, left: r0(r.plan - r.actual) }));
}
/** P4: the month as a calendar — money that came in / went out on each day (Money), and what is due on the days ahead (People &
 *  plans). → { first: "YYYY-MM-01", days: [{ date, in, out, items: [{ what, amount, dir, due }] }] } */
export function monthCalendar({ ledger, life, month, now = Date.now() }) {
  const [y, mo] = month.split("-").map(Number), n = new Date(y, mo, 0).getDate(), today = iso(new Date(now));
  const days = Array.from({ length: n }, (_, k) => ({ date: month + "-" + String(k + 1).padStart(2, "0"), in: 0, out: 0, items: [] }));
  const at = (d) => days[+d.slice(8, 10) - 1];
  for (const t of (ledger && ledger.txns) || []) {
    if (!t || String(t.date || "").slice(0, 7) !== month || (t.type !== "income" && t.type !== "expense")) continue;
    const x = at(t.date), a = +t.amount || 0; if (!x) continue;
    if (t.type === "income") x.in += a; else x.out += a;
    x.items.push({ what: String(t.note || t.cat || "").replace(" ↻", ""), amount: r0(a), dir: t.type === "income" ? "in" : "out" });
  }
  for (const c of (life && life.items) || []) {
    if (c.done) continue;
    for (const s of scheduleOf(c, Date.parse(month + "-" + String(n).padStart(2, "0") + "T12:00:00"))) {
      if (s.open || s.paid || s.date.slice(0, 7) !== month || s.date < today) continue;
      const x = at(s.date); if (!x) continue;
      x.items.push({ what: [c.person, c.title || c.kind].filter(Boolean).join(" · "), amount: r0(+s.amount || 0), dir: c.dir === "in" ? "in" : "out", due: true });
      if (c.dir === "in") x.in += +s.amount || 0; else x.out += +s.amount || 0;
    }
  }
  for (const x of days) { x.in = r0(x.in); x.out = r0(x.out); }
  return { first: month + "-01", days };
}
