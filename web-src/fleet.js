/* ---- v6.32 Fleet & rentals — the logic (inside Business: Hub → "Fleet & rentals") -------------------------------------
   Brings Ali's two desktop ERP apps into Attune, with their confirmed rules kept exactly:
   1. Crane Management (Electron, v2.7): cranes, clients, sites, garages, banks, job orders (hourly / daily / period),
      work entries with evidence, crane location + moves, cheques, expenses, warnings, recycle bin, demo data.
   2. Crane Warehouse (Electron, single HTML): incoming invoices with an internal code, outgoing issues linked to a
      reference code, the planOut split rule (planSadr), running balances, opening stock, reports.
   Joined, they give what neither had: the cost of the parts issued to a crane counts in that crane's profit.
   Pure functions on one plain state object — no storage, no screens (fleet-store.js, fleet-ui.jsx).
   Dates are ISO "YYYY-MM-DD" (shown DD/MM/YYYY); money is a number in the currency, rounded to 2 decimals.
   Tests: tests/unit/v732fleet.test.mjs.                                                                              */

import { proWarnings, clientTax } from "./fleet-pro.js";   // v6.44 the ERP depth (invoices, team, papers, repairs, fuel, reports)
export const FLEET_VERSION = 1;
export const BIN_DAYS = 7;
const r2 = (x) => Math.round((+x || 0) * 100 + Number.EPSILON * 100) / 100;
export { r2 };
const DAY = 86400000;
export const isoDay = (d = new Date()) => (typeof d === "string" ? d.slice(0, 10) : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10));
export const showDate = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(iso || "") ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
/** "17/10/2026", "17-10-26", "2026-10-17" → ISO, or "" when it isn't a real date. DD/MM always (never M/D — lesson 2). */
export function readDate(s) {
  s = String(s || "").trim().replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  let y, m, d, x;
  if ((x = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) [, y, m, d] = x;
  else if ((x = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/))) { [, d, m, y] = x; if (y.length === 2) y = "20" + y; }
  else return "";
  const dt = new Date(Date.UTC(+y, +m - 1, +d));
  if (dt.getUTCFullYear() !== +y || dt.getUTCMonth() !== +m - 1 || dt.getUTCDate() !== +d) return "";
  return dt.toISOString().slice(0, 10);
}
const daysBetween = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY);
const addDays = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
export { daysBetween, addDays };

// A refusal carries its English template + values, so the screens can show it in Arabic too (tr(tpl, vars)).
const fill = (t, v) => t.replace(/\{(\w+)\}/g, (m, k) => (v && v[k] != null ? String(v[k]) : m));
export class FleetError extends Error { constructor(t, v) { super(fill(t, v)); this.tpl = t; this.vars = v || null; } }
const fail = (t, v) => { throw new FleetError(t, v); };
const refuse = (t, v, extra = {}) => ({ ok: false, error: fill(t, v), tpl: t, vars: v || null, ...extra });

export const EMPTY = () => ({
  v: FLEET_VERSION, seq: 1,
  cranes: [], clients: [], sites: [], garages: [], banks: [],
  jobs: [], entries: [], moves: [], cheques: [],
  expTypes: ["Fuel", "Maintenance", "Spare parts", "Driver", "Transport", "Other"], expenses: [],
  settings: { currency: "EGP", chequeDays: 7, jobDays: 7, vat: 14, wht: 0, dueDays: 30, company: "", taxNo: "", nextInv: 1 },
  // v6.44 (fleet-pro.js): invoices, the team and their advances, crane papers, breakdowns; attend = days typed by hand
  invoices: [], people: [], advances: [], docs: [], repairs: [], attend: {},
  store: { items: [], suppliers: [], techs: [], dests: [], purchasers: [], requesters: [], nextDoc: 1, tx: [] },
});
/** An old or partial state → a complete one (self-healing, like healColumns: anything missing is added, nothing lost). */
export function heal(s) {
  const base = EMPTY(), out = { ...base, ...(s || {}) };
  for (const k of Object.keys(base)) if (Array.isArray(base[k]) && !Array.isArray(out[k])) out[k] = [];
  out.settings = { ...base.settings, ...(s && s.settings) };
  out.store = { ...base.store, ...(s && s.store) };
  for (const k of Object.keys(base.store)) if (Array.isArray(base.store[k]) && !Array.isArray(out.store[k])) out.store[k] = [];
  if (!(out.store.nextDoc >= 1)) out.store.nextDoc = 1 + out.store.tx.reduce((m, t) => Math.max(m, t.docSeq || 0), 0);
  if (!(out.seq >= 1)) out.seq = 1;
  return out;
}
const nid = (s, p) => p + (s.seq++).toString(36);
const live = (arr) => (arr || []).filter((x) => !x.del);
export { live };
const byId = (arr, id) => (arr || []).find((x) => x.id === id) || null;
export { byId };

// ---- lists: cranes, clients, sites, garages, banks ------------------------------------------------------------------
const LISTS = { cranes: "c", clients: "k", sites: "s", garages: "g", banks: "b" };
/** Add or update a record in one of the lists. Returns the new state (the input is not changed). */
export function upsert(s0, coll, rec) {
  if (!LISTS[coll]) fail("Unknown list " + coll);
  const s = clone(s0);
  if (!String(rec.name || "").trim()) fail("A name is needed");
  const dup = live(s[coll]).find((x) => x.id !== rec.id && norm(x.name) === norm(rec.name));
  if (dup) fail("\"{name}\" is already in the list", { name: rec.name });
  if (coll === "cranes") rec = { ...rec, hourly: r2(rec.hourly), daily: r2(rec.daily) };
  if (coll === "clients") rec = { ...rec, opening: r2(rec.opening) };
  if (rec.id && byId(s[coll], rec.id)) s[coll] = s[coll].map((x) => (x.id === rec.id ? { ...x, ...rec } : x));
  else {
    const n = { ...rec, id: nid(s, LISTS[coll]) };
    if (coll === "cranes" && !n.loc) { const g = live(s.garages)[0]; n.loc = g ? { kind: "garage", id: g.id } : { kind: "garage", id: null }; }
    s[coll].push(n);
  }
  return s;
}
const norm = (x) => String(x || "").trim().toLowerCase().replace(/\s+/g, " ");
const clone = (s) => JSON.parse(JSON.stringify(s));
export { clone };

/** Where a crane is: { kind: "garage"|"site", id, name }. */
export function whereIs(s, craneId) {
  const c = byId(s.cranes, craneId);
  if (!c || !c.loc) return { kind: "garage", id: null, name: "" };
  const place = byId(c.loc.kind === "site" ? s.sites : s.garages, c.loc.id);
  return { kind: c.loc.kind, id: c.loc.id, name: place ? place.name : "" };
}
/** Move a crane (garage ↔ site, site → site). Logged in moves. Refused while it has an active job at another site. */
export function moveCrane(s0, { crane, to, date = isoDay(), note = "" }) {
  const s = clone(s0), c = byId(s.cranes, crane);
  if (!c) fail("Choose a crane");
  if (!to || !to.kind || !to.id) fail("Choose where it goes");
  if (!byId(to.kind === "site" ? s.sites : s.garages, to.id)) fail("That place is not in the list");
  const busy = live(s.jobs).find((j) => j.crane === crane && j.status === "active" && !(to.kind === "site" && j.site === to.id));
  if (busy) fail("This crane has an active job ({no}) — complete it first", { no: busy.no });
  const from = c.loc || { kind: "garage", id: null };
  if (from.kind === to.kind && from.id === to.id) fail("The crane is already there");
  s.moves.push({ id: nid(s, "m"), crane, date, from, to, note });
  c.loc = { kind: to.kind, id: to.id };
  if (to.kind === "garage") c.home = to.id;
  return s;
}

// ---- job orders ---------------------------------------------------------------------------------------------------
export const MODES = ["hourly", "daily", "period"];
/** A job order is allowed only when the crane is free (in a garage) or already at that site; otherwise Move Crane first. */
export function canStartJob(s, craneId, siteId) {
  const c = byId(s.cranes, craneId);
  if (!c) return { ok: false, why: "Choose a crane", tpl: "Choose a crane" };
  const w = whereIs(s, craneId);
  if (w.kind === "garage") return { ok: true, moves: true };
  if (w.kind === "site" && w.id === siteId) return { ok: true, moves: false };
  return { ok: false, why: fill("The crane is at another site ({place}) — use Move Crane first", { place: w.name }), tpl: "The crane is at another site ({place}) — use Move Crane first", vars: { place: w.name } };
}
export function addJob(s0, j) {
  const s = clone(s0);
  if (!j.crane) fail("Choose a crane");
  if (!j.client) fail("Choose a client");
  if (!j.site) fail("Choose a site");
  if (!MODES.includes(j.mode)) fail("Choose how it is priced");
  if (!readDate(j.start)) fail("Enter the start date");
  if (j.end && j.end < j.start) fail("The end date is before the start date");
  const ok = canStartJob(s, j.crane, j.site);
  if (!ok.ok) fail(ok.why);
  const c = byId(s.cranes, j.crane);
  const rate = j.rate != null && j.rate !== "" ? r2(j.rate) : j.mode === "hourly" ? c.hourly : c.daily;
  const no = "JO-" + String(s.jobs.length + 1).padStart(3, "0");
  const job = { id: nid(s, "j"), no, crane: j.crane, client: j.client, site: j.site, mode: j.mode, rate, start: j.start, end: j.end || "", status: "active", notes: j.notes || "" };
  s.jobs.push(job);
  if (ok.moves) { s.moves.push({ id: nid(s, "m"), crane: j.crane, date: j.start, from: c.loc, to: { kind: "site", id: j.site }, note: no }); c.loc = { kind: "site", id: j.site }; }
  return s;
}
/** Completing or cancelling a job sends the crane back to its garage (the one it last came from). */
export function closeJob(s0, jobId, status = "completed", date = isoDay()) {
  if (!["completed", "cancelled"].includes(status)) fail("Unknown status");
  const s = clone(s0), j = byId(s.jobs, jobId);
  if (!j) fail("Job not found");
  if (j.status !== "active") fail("This job is already closed");
  j.status = status; if (!j.end || j.end > date) j.end = date;
  const c = byId(s.cranes, j.crane);
  const otherActive = live(s.jobs).some((x) => x.id !== j.id && x.crane === j.crane && x.status === "active");
  if (c && !otherActive && c.loc && c.loc.kind === "site") {
    const g = c.home && byId(s.garages, c.home) ? c.home : (live(s.garages)[0] || {}).id || null;
    s.moves.push({ id: nid(s, "m"), crane: c.id, date, from: c.loc, to: { kind: "garage", id: g }, note: j.no });
    c.loc = { kind: "garage", id: g };
  }
  return s;
}

// ---- work entries ---------------------------------------------------------------------------------------------------
const toMin = (t) => { const x = String(t || "").match(/^(\d{1,2}):(\d{2})$/); return x && +x[1] < 24 && +x[2] < 60 ? +x[1] * 60 + +x[2] : NaN; };
/** Hours from start time to end time, with an optional end date for work past midnight / 24 h shifts.
    08:00→14:00 = 6; 08:00 day 1 → 08:00 day 2 = 24. Without an end date, an end before the start crosses midnight. */
export function hoursOf({ date, start, end, endDate }) {
  const a = toMin(start), b = toMin(end);
  if (isNaN(a) || isNaN(b)) return NaN;
  let days = endDate ? daysBetween(date, endDate) : b <= a ? 1 : 0;
  if (days < 0) return NaN;
  const mins = days * 1440 + b - a;
  return mins > 0 ? r2(mins / 60) : NaN;
}
const span = (e) => { const a = Date.parse(e.date + "T00:00:00Z") + toMin(e.start) * 60000; return [a, a + e.hours * 3600000]; };
/** The entry of the same crane whose hours overlap these, or null. Touching (14:00 end, 14:00 start) is fine. */
export function overlapOf(s, craneId, e, ignoreId = null) {
  if (!(e.hours > 0)) return null;
  const [a, b] = span(e);
  for (const x of live(s.entries)) {
    if (x.id === ignoreId || x.mode !== "hourly") continue;
    const j = byId(s.jobs, x.job);
    if (!j || j.crane !== craneId || j.del) continue;
    const [c, d] = span(x);
    if (a < d && c < b) return x;
  }
  return null;
}
/** Add work to a job order. Hourly: start/end time (+ end date). Daily: days. Period: a period with an amount.
    Evidence (a photo/PDF id) is required for every entry (Ali's rule). Hourly entries of the same crane can't overlap. */
export function addEntry(s0, e0, { requireEvidence = true } = {}) {
  const s = clone(s0), j = byId(s.jobs, e0.job);
  if (!j || j.del) fail("Choose a job order");
  if (j.status !== "active") fail("This job is closed");
  const date = readDate(e0.date);
  if (!date) fail("Enter the work date");
  if (date < j.start) fail("The work date is before the job started");
  if (requireEvidence && !e0.evidence) fail("Attach the evidence (a photo of the time sheet)");
  const rate = e0.rate != null && e0.rate !== "" ? r2(e0.rate) : j.rate;
  const was = e0.id && byId(s.entries, e0.id);
  if (was && was.inv) { const v = byId(s.invoices || [], was.inv); fail("This work is on invoice {no} — delete the invoice first to change it", { no: (v && v.no) || "" }); }
  let e = { id: e0.id || nid(s, "e"), job: j.id, mode: j.mode, date, rate, evidence: e0.evidence || null, notes: e0.notes || "" };
  if (j.mode === "hourly") {
    const hours = hoursOf({ date, start: e0.start, end: e0.end, endDate: e0.endDate ? readDate(e0.endDate) : "" });
    if (!(hours > 0)) fail("Enter a start and end time (HH:MM)");
    if (hours > 24 * 31) fail("That is more than a month of hours — check the dates");
    e = { ...e, start: e0.start, end: e0.end, endDate: e0.endDate ? readDate(e0.endDate) : "", hours, qty: hours, amount: r2(hours * rate) };
    const clash = overlapOf(s, j.crane, e, e0.id);
    if (clash) fail("These hours overlap work already saved for this crane ({when})", { when: `${showDate(clash.date)} ${clash.start}–${clash.end}` });
  } else if (j.mode === "daily") {
    const qty = +e0.qty;
    if (!(qty > 0)) fail("Enter the number of days");
    e = { ...e, qty, amount: r2(qty * rate) };
  } else {
    const ps = readDate(e0.pStart), pe = readDate(e0.pEnd);
    if (!ps || !pe || pe < ps) fail("Enter the period (from – to)");
    const qty = e0.qty != null && e0.qty !== "" ? +e0.qty : 1;
    if (!(qty > 0)) fail("Enter how many periods");
    e = { ...e, pStart: ps, pEnd: pe, qty, amount: r2(qty * rate) };
  }
  e.ym = e.date.slice(0, 7);
  if (e0.id && byId(s.entries, e0.id)) s.entries = s.entries.map((x) => (x.id === e0.id ? e : x));
  else s.entries.push(e);
  return s;
}
/** A job's work grouped month by month (newest month first), each with its total. */
export function monthsOf(s, jobId) {
  const g = {};
  for (const e of live(s.entries)) if (e.job === jobId) (g[e.ym] = g[e.ym] || []).push(e);
  return Object.keys(g).sort().reverse().map((ym) => {
    const list = g[ym].sort((a, b) => (a.date + (a.start || "") < b.date + (b.start || "") ? -1 : 1));
    return { ym, entries: list, hours: r2(list.reduce((n, e) => n + (e.hours || 0), 0)), amount: r2(list.reduce((n, e) => n + e.amount, 0)) };
  });
}
export const jobTotal = (s, jobId) => r2(live(s.entries).filter((e) => e.job === jobId).reduce((n, e) => n + e.amount, 0));

// ---- cheques & payments ---------------------------------------------------------------------------------------------
/** dir "in" (from a client) or "out" (to a payee). method "cheque" | "cash" | "transfer" — cash and transfers are
    cleared the day they're entered; only cheques wait for their maturity date and can bounce. */
export function addCheque(s0, c0) {
  const s = clone(s0);
  if (!["in", "out"].includes(c0.dir)) fail("Incoming or outgoing?");
  const amount = r2(c0.amount);
  if (!(amount > 0)) fail("Enter the amount");
  const method = c0.method || "cheque";
  if (c0.dir === "in" && !c0.client) fail("Choose the client");
  if (c0.dir === "out" && !c0.client && !String(c0.payee || "").trim()) fail("Who is it paid to?");
  const due = readDate(c0.due) || (method !== "cheque" ? isoDay() : "");
  if (!due) fail("Enter the maturity date");
  if (method === "cheque" && !String(c0.no || "").trim()) fail("Enter the cheque number");
  const rec = { id: c0.id || nid(s, "q"), dir: c0.dir, method, no: String(c0.no || "").trim(), bank: c0.bank || "", amount, due,
    status: c0.status || (method === "cheque" ? "pending" : "cleared"), client: c0.client || null, payee: c0.payee || "", notes: c0.notes || "" };
  if (c0.id && byId(s.cheques, c0.id)) s.cheques = s.cheques.map((x) => (x.id === c0.id ? rec : x)); else s.cheques.push(rec);
  return s;
}
export function setChequeStatus(s0, id, status) {
  if (!["pending", "cleared", "bounced"].includes(status)) fail("Unknown status");
  const s = clone(s0), q = byId(s.cheques, id);
  if (!q) fail("Cheque not found");
  q.status = status;
  return s;
}

// ---- balances & profit ----------------------------------------------------------------------------------------------
/** Client balance = opening balance + work (job entries) − incoming payments that did not bounce. Bounced stays owed. */
export function clientBalance(s, clientId) {
  const c = byId(s.clients, clientId);
  const jobs = new Set(live(s.jobs).filter((j) => j.client === clientId).map((j) => j.id));
  const work = live(s.entries).filter((e) => jobs.has(e.job)).reduce((n, e) => n + e.amount, 0);
  const paid = live(s.cheques).filter((q) => q.dir === "in" && q.client === clientId && q.status !== "bounced").reduce((n, q) => n + q.amount, 0);
  const pending = live(s.cheques).filter((q) => q.dir === "in" && q.client === clientId && q.status === "pending").reduce((n, q) => n + q.amount, 0);
  const opening = c ? c.opening || 0 : 0;
  // v6.44: the VAT on its invoices is owed too; the withholding tax it deducts is not (it pays that to the tax office)
  const tax = clientTax(s, clientId);
  return { opening, work: r2(work), tax, paid: r2(paid), pending: r2(pending), balance: r2(opening + work + tax - paid) };
}
const inRange = (d, from, to) => (!from || d >= from) && (!to || d <= to);
/** One crane's money for a period: income from its work, its expenses (with its share of nothing general), and the
    parts issued to it from the Store at their purchase cost. Profit = income − expenses − parts. */
export function craneProfit(s, craneId, { from = "", to = "" } = {}) {
  const jobs = new Set(live(s.jobs).filter((j) => j.crane === craneId).map((j) => j.id));
  const work = live(s.entries).filter((e) => jobs.has(e.job) && inRange(e.date, from, to));
  const income = work.reduce((n, e) => n + e.amount, 0), hours = work.reduce((n, e) => n + (e.hours || 0), 0);
  const expenses = live(s.expenses).filter((x) => x.crane === craneId && inRange(x.date, from, to)).reduce((n, x) => n + x.total, 0);
  const parts = (s.store.tx || []).filter((t) => t.kind === "out" && t.crane === craneId && inRange(t.date, from, to)).reduce((n, t) => n + t.total, 0);
  return { income: r2(income), hours: r2(hours), expenses: r2(expenses), parts: r2(parts), profit: r2(income - expenses - parts) };
}
/** Every crane, most profitable first. */
export const fleetProfit = (s, range) => live(s.cranes).map((c) => ({ crane: c, ...craneProfit(s, c.id, range) })).sort((a, b) => b.profit - a.profit);

// ---- expenses -------------------------------------------------------------------------------------------------------
/** An expense for a crane, a site, or general (neither). lines = [{ type, amount }]; a period expense has from/to. */
export function addExpense(s0, x0) {
  const s = clone(s0);
  const date = readDate(x0.date);
  if (!date) fail("Enter the date");
  const lines = (x0.lines || []).map((l) => ({ type: String(l.type || "Other"), amount: r2(l.amount) })).filter((l) => l.amount);
  if (!lines.length) fail("Enter at least one amount");
  if (lines.some((l) => l.amount < 0)) fail("Amounts can't be negative");
  const rec = { id: x0.id || nid(s, "x"), date, crane: x0.crane || null, site: x0.site || null, period: !!x0.period, from: x0.period ? readDate(x0.from) : "", to: x0.period ? readDate(x0.to) : "",
    lines, total: r2(lines.reduce((n, l) => n + l.amount, 0)), evidence: x0.evidence || null, notes: x0.notes || "" };
  if (rec.period && (!rec.from || !rec.to || rec.to < rec.from)) fail("Enter the period (from – to)");
  for (const l of lines) if (!s.expTypes.includes(l.type)) s.expTypes.push(l.type);
  if (x0.id && byId(s.expenses, x0.id)) s.expenses = s.expenses.map((x) => (x.id === x0.id ? rec : x)); else s.expenses.push(rec);
  return s;
}
/** Totals by type for a period (and optionally one crane / site / "general"). */
export function expensesByType(s, { from = "", to = "", crane = null, site = null, general = false } = {}) {
  const out = {};
  for (const x of live(s.expenses)) {
    if (!inRange(x.date, from, to)) continue;
    if (crane && x.crane !== crane) continue;
    if (site && x.site !== site) continue;
    if (general && (x.crane || x.site)) continue;
    for (const l of x.lines) out[l.type] = r2((out[l.type] || 0) + l.amount);
  }
  return out;
}

// ---- warnings (the Today screen) --------------------------------------------------------------------------------------
/** Cheques overdue / due today / due within N days, jobs ending within N days, items at or under their minimum. */
export function warnings(s, today = isoDay()) {
  const w = [];
  const qd = s.settings.chequeDays, jd = s.settings.jobDays;
  for (const q of live(s.cheques)) {
    if (q.status !== "pending") continue;
    const d = daysBetween(today, q.due);
    const who = q.dir === "in" ? (byId(s.clients, q.client) || {}).name || "" : q.payee || (byId(s.clients, q.client) || {}).name || "";
    if (d < 0) w.push({ kind: "chequeOverdue", level: "bad", id: q.id, days: -d, amount: q.amount, dir: q.dir, who, no: q.no });
    else if (d === 0) w.push({ kind: "chequeToday", level: "warn", id: q.id, days: 0, amount: q.amount, dir: q.dir, who, no: q.no });
    else if (d <= qd) w.push({ kind: "chequeSoon", level: "info", id: q.id, days: d, amount: q.amount, dir: q.dir, who, no: q.no });
  }
  for (const j of live(s.jobs)) {
    if (j.status !== "active" || !j.end) continue;
    const d = daysBetween(today, j.end);
    if (d < 0) w.push({ kind: "jobPast", level: "bad", id: j.id, days: -d, no: j.no, crane: (byId(s.cranes, j.crane) || {}).name || "" });
    else if (d <= jd) w.push({ kind: "jobEnding", level: d <= 1 ? "warn" : "info", id: j.id, days: d, no: j.no, crane: (byId(s.cranes, j.crane) || {}).name || "" });
  }
  for (const it of live(s.store.items)) {
    if (!(it.min > 0)) continue;
    const b = itemBalance(s.store, it.name);
    if (b <= it.min) w.push({ kind: "lowStock", level: b <= 0 ? "bad" : "warn", id: it.id, item: it.name, balance: b, min: it.min });
  }
  // v6.34: a crane due for its service by engine hours (the hours worked since its last service)
  for (const c of live(s.cranes)) {
    const sv = serviceStatus(s, c.id, today); if (!sv) continue;
    if (sv.left <= 0) w.push({ kind: "serviceDue", level: "bad", id: c.id, crane: c.name, hours: sv.used, every: sv.every });
    else if (sv.left <= sv.every * 0.1) w.push({ kind: "serviceSoon", level: "warn", id: c.id, crane: c.name, left: sv.left, every: sv.every });
  }
  w.push(...proWarnings(s, today));   // v6.44: papers, licences, overdue invoices, open repairs, fuel
  const rank = { bad: 0, warn: 1, info: 2 };
  return w.sort((a, b) => rank[a.level] - rank[b.level] || (a.days ?? 0) - (b.days ?? 0));
}
/** Cranes working now (at a site with an active job), with the job and client. */
export function activeNow(s) {
  return live(s.jobs).filter((j) => j.status === "active").map((j) => ({ job: j, crane: byId(s.cranes, j.crane), client: byId(s.clients, j.client), site: byId(s.sites, j.site), total: jobTotal(s, j.id) }));
}
/** The numbers on top of Today. */
export function kpis(s, today = isoDay()) {
  const ym = today.slice(0, 7);
  const cranes = live(s.cranes), working = new Set(live(s.jobs).filter((j) => j.status === "active").map((j) => j.crane));
  const month = live(s.entries).filter((e) => e.ym === ym).reduce((n, e) => n + e.amount, 0);
  const owed = live(s.clients).reduce((n, c) => n + Math.max(0, clientBalance(s, c.id).balance), 0);
  const chequesIn = live(s.cheques).filter((q) => q.dir === "in" && q.status === "pending").reduce((n, q) => n + q.amount, 0);
  const spent = live(s.expenses).filter((x) => x.date.slice(0, 7) === ym).reduce((n, x) => n + x.total, 0) + (s.store.tx || []).filter((t) => t.kind === "in" && t.date.slice(0, 7) === ym).reduce((n, t) => n + t.total, 0);
  return { cranes: cranes.length, working: cranes.filter((c) => working.has(c.id)).length, month: r2(month), owed: r2(owed), chequesIn: r2(chequesIn), spent: r2(spent) };
}

// ---- recycle bin ----------------------------------------------------------------------------------------------------
const COLLS = ["cranes", "clients", "sites", "garages", "banks", "jobs", "entries", "cheques", "expenses", "invoices", "people", "advances", "docs", "repairs"];
/** What still points at a record (so deleting it would leave orphans). */
export function usedBy(s, coll, id) {
  const j = live(s.jobs);
  if (coll === "cranes") return j.filter((x) => x.crane === id).length + live(s.expenses).filter((x) => x.crane === id).length;
  if (coll === "clients") return j.filter((x) => x.client === id).length + live(s.cheques).filter((q) => q.client === id).length;
  if (coll === "sites") return j.filter((x) => x.site === id).length + live(s.cranes).filter((c) => c.loc && c.loc.kind === "site" && c.loc.id === id).length;
  if (coll === "garages") return live(s.cranes).filter((c) => c.loc && c.loc.kind === "garage" && c.loc.id === id).length;
  if (coll === "jobs") return 0;
  return 0;
}
/** Soft delete → the Recycle Bin (restorable for 7 days). A job takes its work entries with it. */
export function remove(s0, coll, id, now = Date.now()) {
  if (!COLLS.includes(coll)) fail("Unknown list " + coll);
  const s = clone(s0), r = byId(s[coll], id);
  if (!r) fail("Not found");
  const n = usedBy(s, coll, id);
  if (n) fail("Still used by {n} record(s) — delete or change those first", { n });
  r.del = now;
  // v6.44: a deleted invoice frees its work to be invoiced again (its number is never reused)
  if (coll === "invoices") for (const e of s.entries) if (e.inv === id) { delete e.inv; e.invWas = id; }
  if (coll === "jobs") {
    for (const e of s.entries) if (e.job === id && !e.del) { e.del = now; e.delWith = id; }
    const c = byId(s.cranes, r.crane);
    if (c && r.status === "active" && !live(s.jobs).some((x) => x.crane === c.id && x.status === "active")) { const g = c.home || (live(s.garages)[0] || {}).id || null; c.loc = { kind: "garage", id: g }; }
  }
  return s;
}
export function restore(s0, coll, id) {
  const s = clone(s0), r = byId(s[coll], id);
  if (!r || !r.del) fail("Not in the Recycle Bin");
  delete r.del;
  if (coll === "jobs") for (const e of s.entries) if (e.delWith === id) { delete e.del; delete e.delWith; }
  if (coll === "invoices") for (const e of s.entries) if (e.invWas === id && !e.inv) { e.inv = id; delete e.invWas; }
  return s;
}
export function binList(s, now = Date.now()) {
  const out = [];
  for (const coll of COLLS) for (const r of s[coll] || []) if (r.del && !r.delWith) out.push({ coll, id: r.id, rec: r, left: Math.max(0, BIN_DAYS - Math.floor((now - r.del) / DAY)) });
  return out.sort((a, b) => b.rec.del - a.rec.del);
}
/** Run on open: anything in the bin for more than 7 days is gone for good. */
export function purge(s0, now = Date.now()) {
  let n = 0;
  const s = clone(s0);
  for (const coll of COLLS) s[coll] = (s[coll] || []).filter((r) => { const old = r.del && now - r.del > BIN_DAYS * DAY; if (old) n++; return !old; });
  return { state: s, purged: n };
}

// =====================================================================================================================
// ---- STORE (the warehouse) ------------------------------------------------------------------------------------------
// Internal code: {docSeq}/{month}{last 2 digits of the year} — e.g. 1/526 = invoice 1, May 2026. One counter shared by
// incoming and outgoing; it never goes back (not even after a delete). An incoming invoice with several items = several
// lines with the same code. total is the line's whole price; unit price = total / qty (worked out, not stored).
export const docCode = (seq, date) => `${seq}/${+date.slice(5, 7)}${date.slice(2, 4)}`;
const tx = (st) => st.tx || [];
const itemKey = (x) => norm(x);
/** Opening stock + all incoming − all outgoing, for one item. */
export function itemBalance(st, item) {
  const k = itemKey(item), it = (st.items || []).find((x) => itemKey(x.name) === k);
  let b = it ? +it.opening || 0 : 0;
  for (const t of tx(st)) if (itemKey(t.item) === k) b += t.kind === "in" ? t.qty : -t.qty;
  return r2(b);
}
/** What an incoming invoice still has of an item: its quantity − what was issued against its code. */
export function invoiceRemaining(st, doc, item) {
  const k = itemKey(item);
  let got = 0, out = 0;
  for (const t of tx(st)) {
    if (itemKey(t.item) !== k) continue;
    if (t.kind === "in" && t.doc === doc) got += t.qty;
    if (t.kind === "out" && t.ref === doc) out += t.qty;
  }
  return r2(got - out);
}
/** The invoice's unit price for an item (its total / its quantity), or null when the item isn't on it. */
export function invoiceUnit(st, doc, item) {
  const k = itemKey(item);
  const lines = tx(st).filter((t) => t.kind === "in" && t.doc === doc && itemKey(t.item) === k);
  const q = lines.reduce((n, t) => n + t.qty, 0);
  return q > 0 ? lines.reduce((n, t) => n + t.total, 0) / q : null;
}
/** The items on an incoming invoice, each with original / issued / remaining / unit price (the Reference code report). */
export function invoiceItems(st, doc) {
  const names = [];
  for (const t of tx(st)) if (t.kind === "in" && t.doc === doc && !names.some((n) => itemKey(n) === itemKey(t.item))) names.push(t.item);
  return names.map((item) => {
    const orig = tx(st).filter((t) => t.kind === "in" && t.doc === doc && itemKey(t.item) === itemKey(item)).reduce((n, t) => n + t.qty, 0);
    const rem = invoiceRemaining(st, doc, item);
    return { item, qty: r2(orig), issued: r2(orig - rem), remaining: rem, unit: r2(invoiceUnit(st, doc, item)) };
  });
}
export const incomingDocs = (st) => [...new Set(tx(st).filter((t) => t.kind === "in").map((t) => t.doc))];

/** planOut (planSadr in the original) — how an issue of `qty` of `item` becomes saved lines. Confirmed rules (4.5):
    1. No reference code: qty > total balance → error naming what is available; else one line from the general
       balance (the user enters its price).
    2. With a reference code, remaining = invoice qty − already issued against it:
       · 0 < qty ≤ remaining → one line linked to the invoice, price automatic = qty × invoice unit price.
       · qty > remaining → if qty > total balance: error explaining why; else SPLIT: a line for the remaining
         (linked, automatic price) + a line for the rest from the general balance (the user enters its price).
       · remaining = 0 (used up) → all of it from the general balance — no zero line.
    3. Lines with quantity 0 are dropped.
    → { ok, lines:[{ qty, ref, total|null, auto }], error, available, remaining } */
export function planOut(st, { item, qty, ref = "", ignore = [] }) {
  qty = r2(qty);
  if (!String(item || "").trim()) return refuse("Choose the item");
  if (!(qty > 0)) return refuse("Enter a quantity above zero");
  const view = ignore.length ? { ...st, tx: tx(st).filter((t) => !ignore.includes(t.id)) } : st;
  const avail = itemBalance(view, item);
  if (!ref) {
    if (qty > avail) return refuse("Not enough in stock — available: {a}", { a: avail }, { available: avail });
    return { ok: true, lines: [{ qty, ref: "", total: null, auto: false }], available: avail };
  }
  const unit = invoiceUnit(view, ref, item);
  if (unit == null) return refuse("This item is not on invoice {ref}", { ref });
  const rem = invoiceRemaining(view, ref, item);
  let lines;
  if (rem <= 0) {
    if (qty > avail) return refuse("Invoice {ref} is used up for this item, and the general balance has only {a}", { ref, a: avail }, { available: avail, remaining: 0 });
    lines = [{ qty, ref: "", total: null, auto: false, fromInvoiceDepleted: true }];
  } else if (qty <= rem) lines = [{ qty, ref, total: r2(qty * unit), auto: true }];
  else {
    if (qty > avail) return refuse("Invoice {ref} has {r} left and the total balance is {a} — you asked for {q}", { ref, r: rem, a: avail, q: qty }, { available: avail, remaining: rem });
    lines = [{ qty: rem, ref, total: r2(rem * unit), auto: true }, { qty: r2(qty - rem), ref: "", total: null, auto: false, split: true }];
  }
  return { ok: true, lines: lines.filter((l) => l.qty > 0), available: avail, remaining: rem, unit: r2(unit) };
}

/** Save an incoming invoice: lines [{ item, qty, total }] share one new internal code. purchaser is required. */
export function addIncoming(s0, { date, purchaser, requester = "", supplier = "", crane = null, notes = "", lines = [], evidence = null }) {
  const s = clone(s0), st = s.store;
  date = readDate(date);
  if (!date) fail("Enter the date");
  if (!String(purchaser || "").trim()) fail("Who bought it? (required)");
  const ls = lines.map((l) => ({ item: String(l.item || "").trim(), qty: r2(l.qty), total: r2(l.total) })).filter((l) => l.item && l.qty > 0);
  if (!ls.length) fail("Add at least one item with a quantity");
  if (ls.some((l) => l.total < 0)) fail("A price can't be negative");
  const seq = st.nextDoc++, doc = docCode(seq, date);
  for (const l of ls) {
    ensureItem(st, l.item);
    st.tx.push({ id: nid(s, "t"), docSeq: seq, doc, date, kind: "in", purchaser, requester, supplier, crane, item: l.item, qty: l.qty, total: l.total, notes, evidence });
  }
  for (const [k, v] of [["purchasers", purchaser], ["requesters", requester], ["suppliers", supplier]]) addName(st, k, v);
  return { state: s, doc };
}
/** Save an issue (outgoing) after planOut. prices = the totals the user typed for the non-automatic lines, in order. */
export function addOutgoing(s0, { date, item, qty, ref = "", tech = "", crane = null, dest = "", notes = "", prices = [] }) {
  const s = clone(s0), st = s.store;
  date = readDate(date);
  if (!date) fail("Enter the date");
  if (!crane && !String(dest || "").trim()) fail("Where does it go? (a crane or another place)");
  const plan = planOut(st, { item, qty, ref });
  if (!plan.ok) fail(plan.error);
  const seq = st.nextDoc++, doc = docCode(seq, date);
  let pi = 0;
  for (const l of plan.lines) {
    const total = l.auto ? l.total : r2(prices[pi++] ?? 0);
    if (total < 0) fail("A price can't be negative");
    st.tx.push({ id: nid(s, "t"), docSeq: seq, doc, date, kind: "out", tech, crane, dest, ref: l.ref, item: String(item).trim(), qty: l.qty, total, notes, split: !!l.split || plan.lines.length > 1 });
  }
  ensureItem(st, item); addName(st, "techs", tech); addName(st, "dests", dest);
  return { state: s, doc, lines: plan.lines.length };
}
function ensureItem(st, name) { if (!(st.items || []).some((x) => itemKey(x.name) === itemKey(name))) st.items.push({ id: "i" + (st.items.length + 1) + Date.now().toString(36).slice(-3), name: String(name).trim(), unit: "", min: 0, opening: 0 }); }
function addName(st, k, v) { v = String(v || "").trim(); if (v && !st[k].some((x) => norm(x) === norm(v))) st[k].push(v); }
/** Edit one line (the original had no editing — only delete and re-enter). Quantity / price / notes; the stock may
    never go below zero at any point, and an incoming line can't drop under what was already issued against it. */
export function editLine(s0, id, patch) {
  const s = clone(s0), st = s.store, t = st.tx.find((x) => x.id === id);
  if (!t) fail("Line not found");
  const next = { ...t, ...patch, qty: patch.qty != null ? r2(patch.qty) : t.qty, total: patch.total != null ? r2(patch.total) : t.total };
  if (!(next.qty > 0)) fail("Enter a quantity above zero");
  if (next.total < 0) fail("A price can't be negative");
  if (t.kind === "in") {
    const issued = tx(st).filter((x) => x.kind === "out" && x.ref === t.doc && itemKey(x.item) === itemKey(t.item)).reduce((n, x) => n + x.qty, 0);
    const others = tx(st).filter((x) => x.kind === "in" && x.doc === t.doc && x.id !== id && itemKey(x.item) === itemKey(t.item)).reduce((n, x) => n + x.qty, 0);
    if (next.qty + others < issued) fail("{n} were already issued from this invoice — the quantity can't go below that", { n: issued });
  } else if (t.ref) {
    const rem = invoiceRemaining({ ...st, tx: st.tx.filter((x) => x.id !== id) }, t.ref, t.item);
    if (next.qty > rem) fail("Invoice {ref} has only {r} left for this item", { ref: t.ref, r: rem });
    if (patch.total == null) next.total = r2(next.qty * invoiceUnit(st, t.ref, t.item));
  }
  st.tx = st.tx.map((x) => (x.id === id ? next : x));
  const neg = runningBalances(st).find((r) => r.balance < 0);
  if (neg) fail("That would make the stock of {item} go below zero", { item: neg.item });
  return s;
}
/** Delete one line, or a whole document. An incoming invoice that issues were linked to can't be deleted (that
    used to leave orphan lines). The internal-code counter does not go back. */
export function deleteLines(s0, { id = null, doc = null }) {
  const s = clone(s0), st = s.store;
  const gone = st.tx.filter((t) => (id ? t.id === id : t.doc === doc));
  if (!gone.length) fail("Not found");
  for (const t of gone) if (t.kind === "in") {
    const linked = st.tx.filter((x) => x.kind === "out" && x.ref === t.doc && itemKey(x.item) === itemKey(t.item) && !gone.includes(x));
    const leftIn = st.tx.filter((x) => x.kind === "in" && x.doc === t.doc && itemKey(x.item) === itemKey(t.item) && !gone.includes(x)).reduce((n, x) => n + x.qty, 0);
    if (linked.length && leftIn < linked.reduce((n, x) => n + x.qty, 0)) fail("Issues are linked to invoice {ref} — delete those first", { ref: t.doc });
  }
  st.tx = st.tx.filter((t) => !gone.includes(t));
  const neg = runningBalances(st).find((r) => r.balance < 0);
  if (neg) fail("That would make the stock of {item} go below zero", { item: neg.item });
  return s;
}
/** Every line with its running balance per item (insertion order, as the original's balance column). */
export function runningBalances(st) {
  const bal = {};
  for (const it of st.items || []) bal[itemKey(it.name)] = +it.opening || 0;
  return tx(st).map((t) => { const k = itemKey(t.item); bal[k] = r2((bal[k] || 0) + (t.kind === "in" ? t.qty : -t.qty)); return { ...t, balance: bal[k], unit: t.qty ? r2(t.total / t.qty) : 0 }; });
}
/** Search: date range, item, technician, kind, crane, supplier, text — with counts and totals. */
export function searchStore(st, f = {}) {
  const q = norm(f.text || "");
  const rows = runningBalances(st).filter((t) => inRange(t.date, f.from, f.to) && (!f.item || itemKey(t.item) === itemKey(f.item)) && (!f.tech || norm(t.tech) === norm(f.tech))
    && (!f.kind || t.kind === f.kind) && (!f.crane || t.crane === f.crane) && (!f.supplier || norm(t.supplier) === norm(f.supplier))
    && (!q || norm([t.doc, t.item, t.notes, t.supplier, t.tech, t.dest, t.purchaser, t.ref].join(" ")).includes(q)));
  const sum = (k, p) => r2(rows.filter((t) => t.kind === k).reduce((n, t) => n + t[p], 0));
  return { rows, count: rows.length, inQty: sum("in", "qty"), inTotal: sum("in", "total"), outQty: sum("out", "qty"), outTotal: sum("out", "total"), balance: f.item ? itemBalance(st, f.item) : null };
}
/** Stock on hand: every item with balance, value at its average purchase price, and the low-stock flag. */
export function stockList(st) {
  return (st.items || []).map((it) => {
    const ins = tx(st).filter((t) => t.kind === "in" && itemKey(t.item) === itemKey(it.name));
    const q = ins.reduce((n, t) => n + t.qty, 0), avg = q ? ins.reduce((n, t) => n + t.total, 0) / q : 0;
    const b = itemBalance(st, it.name);
    return { ...it, balance: b, avg: r2(avg), value: r2(b * avg), low: it.min > 0 && b <= it.min };
  }).sort((a, b) => a.name.localeCompare(b.name));
}
/** Cost of what each technician issued, and what each crane / destination received (the dashboard and Destinations). */
export function storeBy(s, key) {
  const out = {};
  for (const t of tx(s.store)) {
    if (t.kind !== "out") continue;
    const k = key === "crane" ? t.crane ? (byId(s.cranes, t.crane) || {}).name || "?" : t.dest || "—" : t[key] || "—";
    const o = (out[k] = out[k] || { name: k, qty: 0, total: 0, lines: 0 });
    o.qty = r2(o.qty + t.qty); o.total = r2(o.total + t.total); o.lines++;
  }
  return Object.values(out).sort((a, b) => b.total - a.total);
}
/** One crane's parts report: every issue to it, by item. */
export function cranePartsReport(s, craneId, range = {}) {
  const lines = tx(s.store).filter((t) => t.kind === "out" && t.crane === craneId && inRange(t.date, range.from, range.to));
  const by = {};
  for (const t of lines) { const o = (by[t.item] = by[t.item] || { item: t.item, qty: 0, total: 0 }); o.qty = r2(o.qty + t.qty); o.total = r2(o.total + t.total); }
  return { lines, items: Object.values(by).sort((a, b) => b.total - a.total), total: r2(lines.reduce((n, t) => n + t.total, 0)) };
}
/** Set an item's opening stock / minimum / unit. */
export function setItem(s0, name, patch) {
  const s = clone(s0), st = s.store;
  ensureItem(st, name);
  st.items = st.items.map((x) => (itemKey(x.name) === itemKey(name) ? { ...x, ...patch, opening: patch.opening != null ? r2(patch.opening) : x.opening, min: patch.min != null ? r2(patch.min) : x.min } : x));
  if (runningBalances(st).some((r) => r.balance < 0)) fail("With that opening stock the balance would go below zero");
  return s;
}

// ---- demo data ------------------------------------------------------------------------------------------------------
/** A small believable company, every record tagged demo (and "[DEMO]" in its name) so Erase never touches real data. */
export function loadDemo(s0, today = isoDay()) {
  let s = heal(clone(s0));
  const before = new Set([...COLLS, "moves"].flatMap((k) => s[k].map((x) => x.id)).concat(s.store.tx.map((t) => t.id), s.store.items.map((i) => i.id)));
  const D = (x) => "[DEMO] " + x, d = (n) => addDays(today, n);
  s = upsert(s, "garages", { name: D("Main garage — 6th of October"), demo: 1 });
  const g = s.garages[s.garages.length - 1].id;
  for (const n of ["New Capital tower", "Ain Sokhna port"]) s = upsert(s, "sites", { name: D(n), demo: 1 });
  const [s1, s2] = s.sites.slice(-2).map((x) => x.id);
  s = upsert(s, "banks", { name: D("CIB"), demo: 1 });
  for (const [n, op] of [["Orascom Construction", 25000], ["Hassan Allam", 0]]) s = upsert(s, "clients", { name: D(n), opening: op, demo: 1 });
  const [k1, k2] = s.clients.slice(-2).map((x) => x.id);
  for (const [n, b, t, h, dy] of [["Liebherr LTM 1100", "Liebherr", 100, 1800, 14000], ["XCMG QY50", "XCMG", 50, 950, 7500], ["Grove GMK 5250", "Grove", 250, 3900, 30000]])
    s = upsert(s, "cranes", { name: D(n), brand: b, tons: t, hourly: h, daily: dy, loc: { kind: "garage", id: g }, home: g, demo: 1 });
  const [c1, c2] = s.cranes.slice(-3).map((x) => x.id);
  s = addJob(s, { crane: c1, client: k1, site: s1, mode: "hourly", start: d(-20), end: d(5) });
  s = addJob(s, { crane: c2, client: k2, site: s2, mode: "daily", start: d(-10) });
  const [j1, j2] = s.jobs.slice(-2).map((x) => x.id);
  s = addEntry(s, { job: j1, date: d(-3), start: "08:00", end: "16:00", evidence: "demo" });
  s = addEntry(s, { job: j1, date: d(-2), start: "07:00", end: "07:00", endDate: d(-1), evidence: "demo" });
  s = addEntry(s, { job: j2, date: d(-9), qty: 6, evidence: "demo" });
  s = addCheque(s, { dir: "in", client: k1, no: "100245", bank: "CIB", amount: 40000, due: d(-1) });
  s = addCheque(s, { dir: "in", client: k2, no: "553100", bank: "NBE", amount: 30000, due: d(4) });
  s = addExpense(s, { date: d(-5), crane: c1, lines: [{ type: "Fuel", amount: 6500 }, { type: "Driver", amount: 2500 }] });
  let r = addIncoming(s, { date: d(-15), purchaser: "Mahmoud", supplier: D("El-Nasr Hydraulics"), lines: [{ item: "Hydraulic oil (L)", qty: 200, total: 30000 }, { item: "Oil filter", qty: 10, total: 4500 }] });
  s = r.state;
  s = addOutgoing(s, { date: d(-4), item: "Hydraulic oil (L)", qty: 40, ref: r.doc, tech: "Sayed", crane: c1 }).state;
  s = addOutgoing(s, { date: d(-4), item: "Oil filter", qty: 2, ref: r.doc, tech: "Sayed", crane: c1 }).state;
  s = setItem(s, "Oil filter", { opening: 5, min: 10 });
  for (const x of [...[...COLLS, "moves"].flatMap((k) => s[k]), ...s.store.tx, ...s.store.items]) if (!before.has(x.id)) x.demo = 1;
  return s;
}
export const hasDemo = (s) => [...COLLS.map((k) => s[k] || []).flat(), ...(s.store.tx || [])].some((x) => x.demo);
/** Erase the demo records only. The internal-code counter keeps going (codes are never reused). */
export function eraseDemo(s0) {
  const s = clone(s0);
  for (const k of [...COLLS, "moves"]) s[k] = (s[k] || []).filter((x) => !x.demo);
  s.store.tx = s.store.tx.filter((x) => !x.demo);
  s.store.suppliers = s.store.suppliers.filter((x) => !/^\[DEMO\]/.test(x));
  const used = new Set(s.store.tx.map((t) => itemKey(t.item)));
  s.store.items = s.store.items.filter((it) => !it.demo || used.has(itemKey(it.name)));
  return s;
}

// ---- export ---------------------------------------------------------------------------------------------------------
/** Rows for Excel / CSV: a header row then data. kind = "store" | "entries" | "cheques" | "expenses" | "balances" | "profit". */
export function exportRows(s, kind) {
  const nm = (arr, id) => (byId(arr, id) || {}).name || "";
  if (kind === "store") return [["Code", "Date", "Kind", "Item", "Qty", "Unit price", "Total", "Balance", "Reference", "Supplier", "Technician", "Crane / destination", "Notes"],
    ...runningBalances(s.store).map((t) => [t.doc, showDate(t.date), t.kind === "in" ? "Incoming" : "Outgoing", t.item, t.qty, t.unit, t.total, t.balance, t.ref || "", t.supplier || "", t.tech || "", t.crane ? nm(s.cranes, t.crane) : t.dest || "", t.notes || ""])];
  if (kind === "entries") return [["Job", "Crane", "Client", "Site", "Date", "From", "To", "Hours / qty", "Rate", "Amount"],
    ...live(s.entries).map((e) => { const j = byId(s.jobs, e.job) || {}; return [j.no, nm(s.cranes, j.crane), nm(s.clients, j.client), nm(s.sites, j.site), showDate(e.date), e.start || showDate(e.pStart), e.end || showDate(e.pEnd), e.hours || e.qty, e.rate, e.amount]; })];
  if (kind === "cheques") return [["In / out", "Method", "Number", "Bank", "Client / payee", "Amount", "Due", "Status"],
    ...live(s.cheques).map((q) => [q.dir === "in" ? "In" : "Out", q.method, q.no, q.bank, q.client ? nm(s.clients, q.client) : q.payee, q.amount, showDate(q.due), q.status])];
  if (kind === "expenses") return [["Date", "Crane", "Site", "Type", "Amount", "Notes"],
    ...live(s.expenses).flatMap((x) => x.lines.map((l) => [showDate(x.date), nm(s.cranes, x.crane) || (x.site ? "" : "General"), nm(s.sites, x.site), l.type, l.amount, x.notes]))];
  if (kind === "balances") return [["Client", "Opening", "Work", "Paid", "Pending cheques", "Balance"], ...live(s.clients).map((c) => { const b = clientBalance(s, c.id); return [c.name, b.opening, b.work, b.paid, b.pending, b.balance]; })];
  if (kind === "profit") return [["Crane", "Hours", "Income", "Expenses", "Parts", "Profit"], ...fleetProfit(s).map((r) => [r.crane.name, r.hours, r.income, r.expenses, r.parts, r.profit])];
  fail("Unknown export " + kind);
}
/** A printable invoice / issue document (HTML) for one internal code — the original's "print the invoice" idea. */
export function docHTML(s, doc, { company = "", currency = s.settings.currency, rtl = false } = {}) {
  const lines = tx(s.store).filter((t) => t.doc === doc);
  if (!lines.length) fail("Not found");
  const t0 = lines[0], esc = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const fmt = (n) => (+n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const L = rtl ? { in: "فاتورة وارد", out: "إذن صرف", item: "الصنف", qty: "الكمية", unit: "سعر الوحدة", total: "الإجمالي", date: "التاريخ", code: "الكود", ref: "كود مرجعي" }
    : { in: "Purchase invoice", out: "Stock issue", item: "Item", qty: "Qty", unit: "Unit price", total: "Total", date: "Date", code: "Code", ref: "Reference" };
  const who = t0.kind === "in" ? [t0.supplier, t0.purchaser].filter(Boolean).join(" · ") : [t0.crane ? (byId(s.cranes, t0.crane) || {}).name : t0.dest, t0.tech].filter(Boolean).join(" · ");
  const sum = lines.reduce((n, t) => n + t.total, 0);
  return `<!doctype html><html dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${esc(doc)}</title><style>body{font:14px system-ui,Segoe UI,Tahoma,sans-serif;margin:32px;color:#0F172A}h1{font-size:20px;margin:0}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border-bottom:1px solid #DCE3EC;padding:8px;text-align:start}th{color:#56657A;font-weight:600}.n{text-align:end;font-variant-numeric:tabular-nums}.m{color:#56657A}</style></head><body>
<p class="m">${esc(company)}</p><h1>${t0.kind === "in" ? L.in : L.out} ${esc(doc)}</h1><p class="m">${L.date}: ${showDate(t0.date)}${who ? " · " + esc(who) : ""}</p>
<table><tr><th>${L.item}</th><th class="n">${L.qty}</th><th class="n">${L.unit}</th><th class="n">${L.total}</th>${t0.kind === "out" ? `<th>${L.ref}</th>` : ""}</tr>
${lines.map((t) => `<tr><td>${esc(t.item)}</td><td class="n">${t.qty}</td><td class="n">${fmt(t.qty ? t.total / t.qty : 0)}</td><td class="n">${fmt(t.total)}</td>${t0.kind === "out" ? `<td>${esc(t.ref || "—")}</td>` : ""}</tr>`).join("")}
<tr><th>${L.total}</th><td></td><td></td><th class="n">${fmt(sum)} ${esc(currency)}</th>${t0.kind === "out" ? "<td></td>" : ""}</tr></table>${t0.notes ? `<p class="m">${esc(t0.notes)}</p>` : ""}</body></html>`;
}

/* ---- v6.34 (Ali: "do everything left") — the Fleet ideas of §5.77: maintenance by engine hours, a client statement, the
   reminders as phone notifications. ------------------------------------------------------------------------------------- */
/** Hours a crane worked (hourly entries' hours; a day of a daily job = settings.dayHours, 8 by default) after `since`. */
export function craneHours(s, craneId, { since = "" } = {}) {
  const jobs = new Map(live(s.jobs).filter((j) => j.crane === craneId).map((j) => [j.id, j]));
  const dayH = +s.settings.dayHours || 8;
  let h = 0;
  for (const e of live(s.entries)) {
    if (!jobs.has(e.job) || (since && e.date <= since)) continue;
    h += e.mode === "hourly" ? +e.hours || 0 : e.mode === "daily" ? (+e.qty || 0) * dayH : 0;
  }
  return r2(h);
}
/** A crane with a service interval (serviceEvery hours): { every, used, left, last } — null when it has none. */
export function serviceStatus(s, craneId, today = isoDay()) {
  const c = byId(s.cranes, craneId); const every = c ? +c.serviceEvery || 0 : 0;
  if (!(every > 0)) return null;
  const used = craneHours(s, craneId, { since: c.lastService || "" });
  return { every, used, left: r2(every - used), last: c.lastService || "" };
}
/** "Serviced" on a date: the count starts again (and the service is in the crane's moves log as a note). */
export function markServiced(s0, craneId, date = isoDay()) {
  const s = clone(s0), c = byId(s.cranes, craneId); if (!c) fail("Not found");
  const d = readDate(date); if (!d) fail("Enter the date");
  c.lastService = d; c.services = [...(c.services || []), { date: d, hours: craneHours(s0, craneId, { since: s0.cranes.find((x) => x.id === craneId).lastService || "" }) }].slice(-50);
  return s;
}
/** A client's statement of account: opening, every work entry (debit) and payment (credit) by date, with the running balance.
    Bounced cheques are listed but not counted (they stay owed); cheques not yet due are counted when they clear only. */
export function statement(s, clientId, { from = "", to = "" } = {}) {
  const c = byId(s.clients, clientId); if (!c) fail("Not found");
  const jobs = new Map(live(s.jobs).filter((j) => j.client === clientId).map((j) => [j.id, j]));
  const rows = [];
  for (const e of live(s.entries)) if (jobs.has(e.job)) { const j = jobs.get(e.job);
    rows.push({ date: e.date, what: `${j.no || ""} · ${(byId(s.cranes, j.crane) || {}).name || ""} · ${e.mode === "hourly" ? e.hours + " h" : e.mode === "daily" ? e.qty + " d" : (e.pStart || "") + "–" + (e.pEnd || "")}`, debit: e.amount, credit: 0 }); }
  // v6.44: an invoice's VAT is owed (debit), the withholding tax the client deducts is not (credit)
  for (const v of live(s.invoices || [])) if (v.client === clientId) {
    if (v.vat) rows.push({ date: v.date, what: `VAT ${v.vatPct}% · ${v.no}`, debit: v.vat, credit: 0 });
    if (v.wht) rows.push({ date: v.date, what: `Withholding tax ${v.whtPct}% · ${v.no}`, debit: 0, credit: v.wht });
  }
  for (const q of live(s.cheques)) if (q.dir === "in" && q.client === clientId)
    rows.push({ date: q.due || q.date, what: (q.method === "cheque" ? "Cheque " + (q.no || "") : q.method === "cash" ? "Cash" : "Transfer") + (q.status === "bounced" ? " (bounced)" : q.status === "pending" ? " (not yet due)" : ""), debit: 0, credit: q.status === "bounced" ? 0 : q.amount, status: q.status });
  rows.sort((a, b) => a.date.localeCompare(b.date));
  let bal = +c.opening || 0;
  const before = rows.filter((r) => from && r.date < from);
  for (const r of before) bal += r.debit - r.credit;
  const open = r2(bal), out = [];
  for (const r of rows.filter((r) => (!from || r.date >= from) && (!to || r.date <= to))) { bal += r.debit - r.credit; out.push({ ...r, balance: r2(bal) }); }
  return { client: c, opening: open, rows: out, debit: r2(out.reduce((n, r) => n + r.debit, 0)), credit: r2(out.reduce((n, r) => n + r.credit, 0)), balance: r2(bal) };
}
export function statementHTML(s, clientId, { from = "", to = "", company = "", currency = s.settings.currency, rtl = false } = {}) {
  const st = statement(s, clientId, { from, to }), esc = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const fmt = (n) => (+n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const L = rtl ? { t: "كشف حساب", date: "التاريخ", what: "البيان", debit: "مدين", credit: "دائن", bal: "الرصيد", open: "رصيد أول المدة", total: "الإجمالي" }
    : { t: "Statement of account", date: "Date", what: "Details", debit: "Debit", credit: "Credit", bal: "Balance", open: "Opening balance", total: "Total" };
  return `<!doctype html><html dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${esc(L.t)} — ${esc(st.client.name)}</title><style>body{font:14px system-ui,Segoe UI,Tahoma,sans-serif;margin:32px;color:#0F172A}h1{font-size:20px;margin:0 0 4px}.m{color:#475569;margin:2px 0}table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border-bottom:1px solid #CBD5E1;padding:6px 8px;text-align:start}.n{text-align:end;font-variant-numeric:tabular-nums}tfoot th{border-top:2px solid #0F172A}</style></head><body>
<p class="m">${esc(company)}</p><h1>${L.t} — ${esc(st.client.name)}</h1><p class="m">${from || to ? showDate(from) + " – " + showDate(to || isoDay()) : showDate(isoDay())}</p>
<table><thead><tr><th>${L.date}</th><th>${L.what}</th><th class="n">${L.debit}</th><th class="n">${L.credit}</th><th class="n">${L.bal}</th></tr></thead><tbody>
<tr><td></td><td>${L.open}</td><td></td><td></td><td class="n">${fmt(st.opening)}</td></tr>
${st.rows.map((r) => `<tr><td>${showDate(r.date)}</td><td>${esc(r.what)}</td><td class="n">${r.debit ? fmt(r.debit) : ""}</td><td class="n">${r.credit ? fmt(r.credit) : ""}</td><td class="n">${fmt(r.balance)}</td></tr>`).join("\n")}
</tbody><tfoot><tr><th></th><th>${L.total}</th><th class="n">${fmt(st.debit)}</th><th class="n">${fmt(st.credit)}</th><th class="n">${fmt(st.balance)} ${esc(currency)}</th></tr></tfoot></table></body></html>`;
}
/** The phone notification for what needs you (overdue / today's cheques, jobs past their end, service due, stock out):
    one at 09:00 — today if it's before 9, else tomorrow — or null when nothing does. Re-made each time Fleet changes. */
export function reminderNote(s, now = Date.now()) {
  const today = isoDay(new Date(now)), w = warnings(s, today).filter((x) => x.level !== "info");
  if (!w.length) return null;
  const d = new Date(now); d.setHours(9, 0, 0, 0); if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  const what = { chequeOverdue: "cheque overdue", chequeToday: "cheque due today", jobPast: "job past its end", jobEnding: "job ending", lowStock: "item low in the store", serviceDue: "crane due for service", serviceSoon: "service soon",
    docExpired: "crane paper expired", docSoon: "crane paper expiring", licenceExpired: "licence expired", licenceSoon: "licence expiring", invoiceOverdue: "invoice overdue", repairOpen: "crane still broken down", fuelHigh: "fuel use high" };
  const counts = {}; for (const x of w) counts[x.kind] = (counts[x.kind] || 0) + 1;
  return { id: "fleet-needs", at: d.getTime(), n: w.length, counts, title: w.length === 1 ? "Fleet: 1 thing needs you" : `Fleet: ${w.length} things need you`, body: Object.entries(counts).map(([k, n]) => `${n} ${what[k] || k}`).join(" · ") };
}
