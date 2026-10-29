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
  const by = {}; let total = 0;
  const seen = new Set();
  for (const t of (ledger && ledger.txns) || []) {
    if (t.type !== "expense" || !(t.date >= from && t.date <= to)) continue;
    seen.add(t.date.slice(0, 7));
    const c = t.cat || "other"; by[c] = (by[c] || 0) + (+t.amount || 0); total += +t.amount || 0;
  }
  const k = Math.max(1, Math.min(months, seen.size));
  for (const c of Object.keys(by)) by[c] = by[c] / k;
  return { by, total: total / k, months: seen.size };
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
  let flexible = Object.entries(avg.by).filter(([c]) => !FLEX_SKIP.has(c)).map(([cat, a]) => ({ cat, avg: r0(a), plan: r0(a) })).sort((a, b) => b.avg - a.avg);
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
