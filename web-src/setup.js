/* ---- v9.9.35 "Set up your life" (Ali picked GD-5 + GW-A + TR-3, 14 Nov 2026: "the extra 7 days … by ACTUALLY completing the setting up of
   your app, and make it very helpful and deep — not just very easy steps without actually doing anything and they get the extra days").
   Eight steps. A step is DONE only when the person's real data shows it — read from the stores, never a tap on "done":
     1 salary  — a repeating income in Money (the salary day and amount)
     2 bank    — at least one payment saved from a bank / wallet message (notification access given AND a message read)
     3 bills   — at least 2 things paid every month (bills, subscriptions, rent, instalments out, or repeating Money expenses)
     4 people  — at least one person with an amount (a debt, a loan, instalments, a gam'eya)
     5 papers  — at least 2 papers with an end date (passport, ID, car licence, insurance…)
     6 week    — at least one thing every week or every day (a repeating reminder, or a weekly plan like the maid)
     7 agent   — at least one agent switched on (a price, a hotel, a flight)
     8 backup  — the daily backup on AND at least one backup made
   Free keeps steps 1–3 (GW-A); the rest, the monthly check-up and the guide in full are Pro. TR-3: during the trial, 6 of 8 really done
   → the trial grows by 7 days, once (it ends 14 days after the first day, or 7 days after today if that is later). Pure.
   Tests: tests/setup/gen.mjs (10,000) + tests/unit/v9935setup.test.mjs. */

const DAY = 86400000;
const iso = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const num = (v) => Number(v) || 0;
export const FREE_STEPS = 3;

/** The 8 steps, in order. Each: id, title, the question Attune asks in Chat, an example answer, and the button to the page that helps. */
export const STEPS = [
  { id: "salary", title: "Your salary day", ask: "When does your salary arrive, and how much is it?", eg: "On the 25th, 18,500", open: "money" },
  { id: "bank", title: "Bank messages → Money", ask: "Let Attune read your bank and wallet messages, so payments are saved for you.", eg: "", open: "money", btn: "Allow bank messages" },
  { id: "bills", title: "Bills and subscriptions", ask: "What do you pay every month? Say each one with its amount.", eg: "Electricity 600 every month, internet 450 every month", open: "life" },
  { id: "people", title: "People and money", ask: "Does anyone owe you money, or do you owe someone?", eg: "Sheikh owes me 19,500, 2,500 a month", open: "life" },
  { id: "papers", title: "Your papers", ask: "Which of your papers have an end date? Passport, ID, car licence, insurance…", eg: "My passport expires on 3 March 2028", open: "radar", btn: "Scan a paper" },
  { id: "week", title: "Your week", ask: "What happens every week or every day? The maid, the gym, a class, a medicine…", eg: "Remind me every Saturday at 10 am the maid comes", open: "reminders" },
  { id: "agent", title: "One agent watching", ask: "Is there something you want to buy, or a price, hotel or flight to watch?", eg: "Tell me when the PS5 goes under 20,000", open: "agents" },
  { id: "backup", title: "Your data kept safe", ask: "Turn on the daily backup so nothing is ever lost.", eg: "", open: "backup", btn: "Turn on backup" },
];

/** What the stores show for each step → { [id]: { done, n, need } } (n = how many found, need = how many make it done). */
export function stepState(d = {}) {
  const L = d.ledger || {}, txns = L.txns || [], rec = (L.recurring || []).filter((r) => r && r.active !== false);
  const life = ((d.life && d.life.items) || d.life || []).filter((x) => x && !x.archived && !x.done);
  const radar = ((d.radar && d.radar.items) || d.radar || []).filter((x) => x && x.date && x.status !== "deleted");
  const rem = (d.reminders || []).filter((r) => r && !r.deleted);
  const agents = ((d.agents && d.agents.agents) || d.agents || []).filter((a) => a && a.on !== false);
  const bk = d.backup || {};
  const salary = rec.filter((r) => r.type === "income" && num(r.amount) > 0 && /^(monthly|weekly)$/.test(String(r.freq || "monthly"))).length
    + life.filter((x) => x.dir === "in" && x.kind === "regular" && /salary|مرتب|راتب/i.test(String(x.title || x.person || "")) && num(x.amount) > 0).length;
  const bank = txns.filter((t) => t && t.source === "notification" && num(t.amount) > 0).length;
  const bills = life.filter((x) => x.dir === "out" && x.every === "month" && num(x.amount) > 0 && /^(bill|subscription|rent|installment|circle)$/.test(x.kind)).length
    + rec.filter((r) => r.type === "expense" && num(r.amount) > 0).length;
  // (a person, not a title: "car installment 4,500" has no person — v9.9.35 the 10,000 run)
  const people = life.filter((x) => String(x.person || "").trim() && num(x.amount) > 0 && /^(debt|installment|loan|circle)$/.test(x.kind)).length;
  const papers = radar.length;
  const week = rem.filter((r) => r.repeat && r.repeat !== "none").length + life.filter((x) => x.kind === "regular" && /^(week|day)$/.test(x.every || "") && num(x.amount) >= 0).length;
  const agent = agents.length;
  const backup = bk.on && bk.pw && num(bk.last) > 0 ? 1 : 0;
  const S = { salary: [salary, 1], bank: [bank, 1], bills: [bills, 2], people: [people, 1], papers: [papers, 2], week: [week, 1], agent: [agent, 1], backup: [backup, 1] };
  return Object.fromEntries(Object.entries(S).map(([k, [n, need]]) => [k, { done: n >= need, n, need }]));
}
/** How many of the 8 are really done, and the next one to do (Free: only within the first 3). */
export function progress(d = {}, pro = true) {
  const st = stepState(d), done = STEPS.filter((s) => st[s.id].done).length;
  const open = STEPS.map((s, i) => ({ ...s, i, ...st[s.id], locked: !pro && i >= FREE_STEPS }));
  const next = open.find((s) => !s.done && !s.locked) || null;
  return { done, total: STEPS.length, steps: open, next, freeDone: !pro && open.slice(0, FREE_STEPS).every((s) => s.done) };
}

/* ---- TR-3: +7 trial days for 6 of 8 really done, once, during the trial ---------------------------------------------------- */
export const BONUS_FLAG = "attune:setup:bonus";
/** Should the 7 days be given now? trial = { first (first-run time), left (days left), bought (a real Pro purchase) }. */
export function bonusDue({ done = 0, trial = {}, given = false } = {}) {
  return !given && done >= 6 && !trial.bought && num(trial.left) > 0;
}
/** When the bonus ends: 7 days after the trial's own end (first + 7 days), never before 7 days from now. */
export function bonusEnd(first, now = Date.now(), trialDays = 7) {
  const end = num(first) + trialDays * DAY;
  return Math.max(end, now) + 7 * DAY;
}

/* ---- the salary answer: "On the 25th, 18,500", «يوم 25 المرتب 18500», "18,500 on the 25th" → { amount, day } ------------------------ */
const latin = (s) => String(s || "").replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x6f0));
export function readSalary(text) {
  const t = latin(text).replace(/(\d)[,٬](?=\d{3}\b)/g, "$1").toLowerCase();
  const dayM = /(?:on the|on|the|day|يوم|في|بتاريخ)\s*(\d{1,2})(?:st|nd|rd|th)?(?![\d.])/.exec(t) || /\b(\d{1,2})(?:st|nd|rd|th)\b/.exec(t);
  const nums = [...t.matchAll(/(\d+(?:\.\d+)?)\s*(k|الف|ألف|آلاف|الاف)?/g)].map((m) => ({ v: parseFloat(m[1]) * (m[2] ? 1000 : 1), raw: m[1], i: m.index }));
  const day = dayM ? +dayM[1] : null;
  const amount = nums.filter((x) => !(day != null && x.v === day && dayM && t.indexOf(dayM[1], dayM.index) === x.i)).map((x) => x.v).filter((v) => v >= 100).sort((a, b) => b - a)[0] || 0;
  if (!amount || !day || day < 1 || day > 31) return null;
  return { amount, day };
}
/** The repeating income for Money: the next salary day from today. */
export function salaryRecurring({ amount, day }, now = Date.now(), account = "") {
  const d = new Date(now); let next = new Date(d.getFullYear(), d.getMonth(), Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()), 12);
  if (iso(next.getTime()) < iso(now)) { const y = d.getFullYear(), m = d.getMonth() + 1; next = new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()), 12); }
  return { id: "r-salary-" + now.toString(36), type: "income", amount: Math.round(amount * 100) / 100, cat: "salary", note: "Salary ↻", freq: "monthly", nextDate: iso(next.getTime()), active: true, ...(account ? { account } : {}) };
}

/* ---- the monthly check-up (Pro): what needs a look this month ------------------------------------------------------------------ */
export function checkup(d = {}, now = Date.now()) {
  const out = [];
  const radar = ((d.radar && d.radar.items) || d.radar || []).filter((x) => x && x.date && x.status !== "deleted");
  for (const p of radar) { const days = Math.round((Date.parse(String(p.date).slice(0, 10) + "T12:00:00") - Date.parse(iso(now) + "T12:00:00")) / DAY);
    if (days >= 0 && days <= 45) out.push({ kind: "paper", title: p.title || p.kind || "", days, date: String(p.date).slice(0, 10) }); }
  const st = stepState(d);
  for (const s of STEPS) if (!st[s.id].done) out.push({ kind: "step", id: s.id, title: s.title });
  return out.sort((a, b) => (a.kind === "paper" ? a.days : 999) - (b.kind === "paper" ? b.days : 999));
}
