/* ---- v6.44 Fleet & rentals in depth (Ali: "make business systems with great depth so it is of great value") ------------
   What a crane-rental company's ERP has beyond jobs, work, cheques and the store — pure functions on Fleet's one state:
   1. Invoices from the work (فواتير): the work not invoiced yet → an invoice per client, VAT (14 % in Egypt) and the
      withholding tax the client deducts (خصم من المنبع), numbered INV-0001… (never reused). Payments are matched to
      the opening balance and then to the invoices, oldest first → paid / partly paid / unpaid / overdue.
   2. Receivables aging (أعمار الديون): what each client still owes on invoices, by days past due (not due · 1–30 ·
      31–60 · 61–90 · 90+), and the work not invoiced yet.
   3. Team (المشغلين والسواقين): operators, drivers, riggers, mechanics — licence and its expiry, the crane they work on,
      a day wage or a monthly salary, advances (سلف), and the monthly payroll (days from their crane's work).
   4. Crane papers (رخصة، تأمين، شهادة اختبار الأحمال، فحص): each with its expiry → warnings before it runs out.
   5. Breakdowns & repairs (الأعطال): from – to (downtime), cause, cost (saved as a Maintenance expense, so profit sees it).
   6. Fuel log (السولار): litres and cost (a Fuel expense), litres per working hour each month, and a warning when a
      month is well above that crane's own usual (a leak, theft, or an engine problem).
   7. Reports: utilisation per crane (worked / down / idle days), revenue per crane per month (a year matrix).
   Money is rounded to 2 decimals, dates are ISO. Tests: tests/unit/v744fleetpro.test.mjs.                              */
import { live, byId, r2, isoDay, readDate, showDate, daysBetween, addDays, addExpense, FleetError, craneHours } from "./fleet.js";

const DAY = 86400000;
const clone = (x) => JSON.parse(JSON.stringify(x));
const fail = (t, v) => { throw new FleetError(t, v); };
const nid = (s, p) => p + (s.seq++).toString(36);
const daysIn = (ym) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate();
const monthStart = (ym) => ym + "-01", monthEnd = (ym) => ym + "-" + String(daysIn(ym)).padStart(2, "0");

export const TAX = { vat: 14, wht: 0, dueDays: 30 };
export const DOC_KINDS = ["licence", "insurance", "loadtest", "inspection", "other"];
export const ROLES = ["operator", "driver", "rigger", "mechanic", "other"];
const COLLS_PRO = ["invoices", "people", "advances", "docs", "repairs"];
/** The new lists on an old state (heal adds the rest). */
export function healPro(s) {
  for (const k of COLLS_PRO) if (!Array.isArray(s[k])) s[k] = [];
  s.settings = { vat: TAX.vat, wht: TAX.wht, dueDays: TAX.dueDays, company: "", taxNo: "", nextInv: 1, ...s.settings };
  if (!(s.settings.nextInv >= 1)) s.settings.nextInv = 1;
  if (!s.attend || typeof s.attend !== "object") s.attend = {};
  return s;
}

// ---- 1. invoices -------------------------------------------------------------------------------------------------------
const entryDays = (e) => (e.mode === "daily" ? +e.qty || 0 : e.mode === "period" ? Math.max(1, daysBetween(e.pStart, e.pEnd) + 1) : 0);
/** The work of a client not invoiced yet (optionally one job, a date range): one line per job. */
export function uninvoiced(s, clientId, { from = "", to = "", job = null } = {}) {
  const jobs = live(s.jobs).filter((j) => j.client === clientId && (!job || j.id === job));
  const lines = [];
  for (const j of jobs) {
    const es = live(s.entries).filter((e) => e.job === j.id && !e.inv && (!from || e.date >= from) && (!to || e.date <= to));
    if (!es.length) continue;
    const amount = r2(es.reduce((n, e) => n + e.amount, 0));
    const qty = r2(es.reduce((n, e) => n + (e.mode === "hourly" ? +e.hours || 0 : e.mode === "daily" ? +e.qty || 0 : +e.qty || 1), 0));
    const unit = j.mode === "hourly" ? "h" : j.mode === "daily" ? "day" : "period";
    const dates = es.map((e) => e.date).sort();
    const crane = (byId(s.cranes, j.crane) || {}).name || "", site = (byId(s.sites, j.site) || {}).name || "";
    lines.push({ job: j.id, desc: `${j.no} · ${crane}${site ? " · " + site : ""} · ${showDate(dates[0])}–${showDate(dates[dates.length - 1])}`, qty, unit, rate: qty ? r2(amount / qty) : j.rate, amount, entries: es.map((e) => e.id) });
  }
  return lines;
}
/** Totals of invoice lines with the taxes: sub, vat, wht, total (sub + vat), net (what the client pays = total − wht). */
export function invoiceTotals(lines, vatPct = TAX.vat, whtPct = TAX.wht) {
  const sub = r2(lines.reduce((n, l) => n + (+l.amount || 0), 0)), vat = r2((sub * (+vatPct || 0)) / 100), wht = r2((sub * (+whtPct || 0)) / 100);
  return { sub, vat, wht, total: r2(sub + vat), net: r2(sub + vat - wht) };
}
/** Make an invoice for a client from the work not invoiced yet (all of it, or a range / one job). Marks the entries. */
export function makeInvoice(s0, { client, date = isoDay(), from = "", to = "", job = null, notes = "", vat = null, wht = null }) {
  const s = healPro(clone(s0));
  if (!byId(s.clients, client)) fail("Choose a client");
  const d = readDate(date); if (!d) fail("Enter the date");
  const lines = uninvoiced(s, client, { from, to, job });
  if (!lines.length) fail("Nothing to invoice — all this client's work is invoiced already");
  const vp = vat == null ? +s.settings.vat || 0 : +vat, wp = wht == null ? +s.settings.wht || 0 : +wht;
  const no = "INV-" + String(s.settings.nextInv++).padStart(4, "0");
  const inv = { id: nid(s, "v"), no, client, date: d, due: addDays(d, +s.settings.dueDays || 0), lines, vatPct: vp, whtPct: wp, ...invoiceTotals(lines, vp, wp), notes };
  s.invoices.push(inv);
  const ids = new Set(lines.flatMap((l) => l.entries));
  for (const e of s.entries) if (ids.has(e.id)) e.inv = inv.id;
  return { state: s, invoice: inv };
}
/** Delete an invoice → its work can be invoiced again (to the Recycle Bin like the rest; the number is not reused). */
export function voidInvoice(s0, id, now = Date.now()) {
  const s = clone(s0), v = byId(s.invoices, id); if (!v || v.del) fail("Not found");
  v.del = now; for (const e of s.entries) if (e.inv === id) { delete e.inv; e.invWas = id; }
  return s;
}
export function restoreInvoice(s0, id) {
  const s = clone(s0), v = byId(s.invoices, id); if (!v || !v.del) fail("Not in the Recycle Bin");
  delete v.del; for (const e of s.entries) if (e.invWas === id && !e.inv) { e.inv = id; delete e.invWas; }
  return s;
}
/** Each invoice with paid / left / status: the client's payments (cleared; cash and transfers clear at once) go to the
    opening balance first, then the invoices oldest first. Cheques not yet due are shown as "cheque pending", not paid. */
export function invoiceStatus(s, today = isoDay()) {
  const out = [];
  for (const c of live(s.clients)) {
    const ins = live(s.cheques).filter((q) => q.dir === "in" && q.client === c.id);
    let pool = r2(ins.filter((q) => q.status === "cleared").reduce((n, q) => n + q.amount, 0)) - (+c.opening > 0 ? +c.opening : 0);
    let pending = r2(ins.filter((q) => q.status === "pending").reduce((n, q) => n + q.amount, 0));
    for (const v of live(s.invoices || []).filter((x) => x.client === c.id).sort((a, b) => (a.date + a.no < b.date + b.no ? -1 : 1))) {
      const paid = r2(Math.max(0, Math.min(v.net, pool))); pool = r2(pool - paid);
      const left = r2(v.net - paid), onCheque = r2(Math.max(0, Math.min(left, pending))); pending = r2(pending - onCheque);
      const late = left > 0.004 && v.due < today ? daysBetween(v.due, today) : 0;
      out.push({ ...v, paid, left, onCheque, late, status: left <= 0.004 ? "paid" : late ? "overdue" : paid > 0 ? "partial" : "unpaid" });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}
/** VAT and withholding tax per client (the taxes on invoices) — added to what the client owes. */
export function clientTax(s, clientId) {
  return r2(live(s.invoices || []).filter((v) => v.client === clientId).reduce((n, v) => n + (v.vat || 0) - (v.wht || 0), 0));
}

// ---- 2. aging ------------------------------------------------------------------------------------------------------------
export const AGE_BUCKETS = ["current", "d30", "d60", "d90", "over90"];
/** Per client: what is left on invoices by days past due, the work not invoiced yet, and the total. Most owed first. */
export function aging(s, today = isoDay()) {
  const st = invoiceStatus(s, today), rows = [];
  for (const c of live(s.clients)) {
    const r = { client: c, current: 0, d30: 0, d60: 0, d90: 0, over90: 0, notInvoiced: 0, total: 0 };
    for (const v of st.filter((x) => x.client === c.id && x.left > 0.004)) {
      const k = !v.late ? "current" : v.late <= 30 ? "d30" : v.late <= 60 ? "d60" : v.late <= 90 ? "d90" : "over90";
      r[k] = r2(r[k] + v.left);
    }
    r.notInvoiced = r2(uninvoiced(s, c.id).reduce((n, l) => n + l.amount, 0));
    r.total = r2(AGE_BUCKETS.reduce((n, k) => n + r[k], 0) + r.notInvoiced);
    if (r.total > 0.004) rows.push(r);
  }
  rows.sort((a, b) => b.over90 + b.d90 - (a.over90 + a.d90) || b.total - a.total);
  const sum = { current: 0, d30: 0, d60: 0, d90: 0, over90: 0, notInvoiced: 0, total: 0 };
  for (const r of rows) for (const k of Object.keys(sum)) sum[k] = r2(sum[k] + r[k]);
  return { rows, sum };
}

// ---- 3. team: people, advances, payroll -------------------------------------------------------------------------------
export function upsertPerson(s0, p) {
  const s = healPro(clone(s0));
  if (!String(p.name || "").trim()) fail("Enter the name");
  const lic = p.licenceExp ? readDate(p.licenceExp) : "";
  if (p.licenceExp && !lic) fail("Enter the licence expiry as DD/MM/YYYY");
  const rec = { id: p.id || nid(s, "p"), name: String(p.name).trim(), role: ROLES.includes(p.role) ? p.role : "operator", phone: p.phone || "", licence: p.licence || "", licenceExp: lic,
    crane: p.crane || null, wage: r2(p.wage), salary: r2(p.salary), notes: p.notes || "" };
  if (p.id && byId(s.people, p.id)) s.people = s.people.map((x) => (x.id === p.id ? { ...x, ...rec } : x)); else s.people.push(rec);
  return s;
}
export function addAdvance(s0, a) {
  const s = healPro(clone(s0));
  if (!byId(s.people, a.person)) fail("Choose the person");
  const d = readDate(a.date); if (!d) fail("Enter the date");
  const amount = r2(a.amount); if (!(amount > 0)) fail("Enter the amount");
  s.advances.push({ id: nid(s, "a"), person: a.person, date: d, amount, notes: a.notes || "" });
  return s;
}
/** The days a person's crane worked in a month (hourly: each date; daily: the days entered; period: its days in the month). */
export function daysWorked(s, craneId, ym) {
  if (!craneId) return 0;
  const jobs = new Set(live(s.jobs).filter((j) => j.crane === craneId).map((j) => j.id));
  const dates = new Set(); let extra = 0;
  const a = monthStart(ym), b = monthEnd(ym);
  for (const e of live(s.entries)) {
    if (!jobs.has(e.job)) continue;
    if (e.mode === "hourly") { if (e.date >= a && e.date <= b) dates.add(e.date); }
    else if (e.mode === "daily") { if (e.date >= a && e.date <= b) extra += +e.qty || 0; }
    else { const x = e.pStart > a ? e.pStart : a, y = e.pEnd < b ? e.pEnd : b; if (x <= y) extra += daysBetween(x, y) + 1; }
  }
  return Math.min(daysIn(ym), dates.size + extra);
}
/** Set the days a person worked in a month by hand (attendance), or clear it (null) to count from the crane's work. */
export function setDays(s0, personId, ym, days) {
  const s = healPro(clone(s0));
  s.attend[ym] = { ...(s.attend[ym] || {}) };
  if (days == null || days === "") delete s.attend[ym][personId]; else { const d = +days; if (!(d >= 0 && d <= 31)) fail("Days must be 0–31"); s.attend[ym][personId] = d; }
  return s;
}
/** The month's payroll: per person — days, gross (salary, or day wage × days), advances that month, net to pay. */
export function payroll(s, ym) {
  healPro(s);
  const rows = live(s.people).map((p) => {
    const set = s.attend[ym] && s.attend[ym][p.id] != null, days = set ? +s.attend[ym][p.id] : daysWorked(s, p.crane, ym);
    const gross = p.salary > 0 ? p.salary : r2((p.wage || 0) * days);
    const adv = r2(live(s.advances).filter((a) => a.person === p.id && a.date.slice(0, 7) === ym).reduce((n, a) => n + a.amount, 0));
    return { person: p, days, byHand: set, gross: r2(gross), advances: adv, net: r2(gross - adv) };
  });
  const sum = rows.reduce((t, r) => ({ gross: r2(t.gross + r.gross), advances: r2(t.advances + r.advances), net: r2(t.net + r.net) }), { gross: 0, advances: 0, net: 0 });
  return { ym, rows, sum };
}

// ---- 4. crane papers ---------------------------------------------------------------------------------------------------
export function upsertDoc(s0, d) {
  const s = healPro(clone(s0));
  if (!byId(s.cranes, d.crane)) fail("Choose a crane");
  const exp = readDate(d.expiry); if (!exp) fail("Enter the expiry date (DD/MM/YYYY)");
  const rec = { id: d.id || nid(s, "d"), crane: d.crane, kind: DOC_KINDS.includes(d.kind) ? d.kind : "other", title: d.title || "", no: d.no || "", expiry: exp, evidence: d.evidence || null, notes: d.notes || "" };
  if (d.id && byId(s.docs, d.id)) s.docs = s.docs.map((x) => (x.id === d.id ? rec : x)); else s.docs.push(rec);
  return s;
}

// ---- 5. breakdowns & repairs -------------------------------------------------------------------------------------------
/** A breakdown: from (and to when fixed), cause, cost → a Maintenance expense for the crane (so profit counts it). */
export function addRepair(s0, r) {
  let s = healPro(clone(s0));
  if (!byId(s.cranes, r.crane)) fail("Choose a crane");
  const from = readDate(r.from); if (!from) fail("Enter the date it broke down");
  const to = r.to ? readDate(r.to) : ""; if (r.to && !to) fail("Enter the date it was fixed (DD/MM/YYYY)");
  if (to && to < from) fail("The fixed date is before the breakdown");
  const cost = r2(r.cost);
  let expense = null;
  if (cost > 0) { s = addExpense(s, { date: from, crane: r.crane, lines: [{ type: "Maintenance", amount: cost }], notes: r.cause || "", evidence: r.evidence || null }); expense = s.expenses[s.expenses.length - 1].id; }
  s.repairs.push({ id: nid(s, "r"), crane: r.crane, from, to, cause: r.cause || "", cost, expense, notes: r.notes || "" });
  return s;
}
export function closeRepair(s0, id, to = isoDay()) {
  const s = clone(s0), r = byId(s.repairs, id); if (!r) fail("Not found");
  const d = readDate(to); if (!d) fail("Enter the date it was fixed (DD/MM/YYYY)");
  if (d < r.from) fail("The fixed date is before the breakdown");
  r.to = d; return s;
}
/** Days a crane was down inside [a, b] (an open repair counts up to `today`). */
export function downDays(s, craneId, a, b, today = isoDay()) {
  let n = 0; const seen = new Set();
  for (const r of live(s.repairs || [])) {
    if (r.crane !== craneId) continue;
    const x = r.from > a ? r.from : a, end = r.to || today, y = end < b ? end : b;
    for (let d = x; d <= y; d = addDays(d, 1)) if (!seen.has(d)) { seen.add(d); n++; }
  }
  return n;
}

// ---- 6. fuel -------------------------------------------------------------------------------------------------------------
/** Fuel for a crane: litres and what it cost → a Fuel expense that also keeps the litres. */
export function addFuel(s0, f) {
  if (!byId(s0.cranes, f.crane)) fail("Choose a crane");
  const litres = r2(f.litres); if (!(litres > 0)) fail("Enter the litres");
  const cost = r2(f.cost); if (!(cost > 0)) fail("Enter what it cost");
  const s = addExpense(s0, { date: f.date, crane: f.crane, lines: [{ type: "Fuel", amount: cost }], notes: f.notes || "", evidence: f.evidence || null });
  const x = s.expenses[s.expenses.length - 1]; x.litres = litres;
  return s;
}
/** A crane's fuel month by month (oldest first): litres, cost, hours worked, litres per hour, and `high` when a month uses
    more than 25 % above the crane's own usual (the median of its other months; needs 3+ months with hours). */
export function fuelReport(s, craneId) {
  const by = {};
  for (const x of live(s.expenses)) if (x.crane === craneId && x.litres > 0) { const ym = x.date.slice(0, 7); by[ym] = by[ym] || { ym, litres: 0, cost: 0 }; by[ym].litres = r2(by[ym].litres + x.litres); by[ym].cost = r2(by[ym].cost + x.total); }
  const months = Object.values(by).sort((a, b) => (a.ym < b.ym ? -1 : 1)).map((m) => {
    const hours = r2(craneHours(s, craneId, { since: addDays(monthStart(m.ym), -1) }) - craneHours(s, craneId, { since: monthEnd(m.ym) }));
    return { ...m, hours, lph: hours > 0 ? r2(m.litres / hours) : null, perLitre: m.litres ? r2(m.cost / m.litres) : 0 };
  });
  const withH = months.filter((m) => m.lph != null);
  for (const m of withH) {
    const others = withH.filter((x) => x !== m).map((x) => x.lph).sort((a, b) => a - b);
    if (others.length < 2) continue;
    const med = others.length % 2 ? others[(others.length - 1) / 2] : (others[others.length / 2 - 1] + others[others.length / 2]) / 2;
    m.usual = r2(med); m.high = m.lph > med * 1.25;
  }
  return months;
}

// ---- 7. reports --------------------------------------------------------------------------------------------------------
/** Per crane for a month: days worked, days down (repairs), idle days, and the utilisation % (worked / days counted;
    the current month counts up to today). */
export function utilisation(s, ym, today = isoDay()) {
  const end = ym === today.slice(0, 7) ? today : monthEnd(ym), days = ym > today.slice(0, 7) ? 0 : daysBetween(monthStart(ym), end) + 1;
  return live(s.cranes).map((c) => {
    const worked = Math.min(days, daysWorked(s, c.id, ym)), down = Math.min(days - worked, downDays(s, c.id, monthStart(ym), end, today));
    return { crane: c, days, worked, down, idle: Math.max(0, days - worked - down), pct: days ? Math.round((worked / days) * 100) : 0 };
  }).sort((a, b) => b.pct - a.pct);
}
/** Income per crane per month for a year: rows [{ crane, months: [12 numbers], total }] and the month totals. */
export function revenueMatrix(s, year) {
  const jobs = new Map(live(s.jobs).map((j) => [j.id, j]));
  const rows = live(s.cranes).map((c) => ({ crane: c, months: new Array(12).fill(0), total: 0 }));
  const byC = new Map(rows.map((r) => [r.crane.id, r]));
  for (const e of live(s.entries)) {
    if (e.date.slice(0, 4) !== String(year)) continue;
    const j = jobs.get(e.job), r = j && byC.get(j.crane); if (!r) continue;
    const m = +e.date.slice(5, 7) - 1; r.months[m] = r2(r.months[m] + e.amount); r.total = r2(r.total + e.amount);
  }
  const months = new Array(12).fill(0).map((_, i) => r2(rows.reduce((n, r) => n + r.months[i], 0)));
  return { rows: rows.sort((a, b) => b.total - a.total), months, total: r2(months.reduce((a, b) => a + b, 0)) };
}

// ---- warnings for Today (added to fleet.js warnings) ---------------------------------------------------------------------
export function proWarnings(s, today = isoDay()) {
  healPro(s);
  const w = [];
  for (const d of live(s.docs)) {
    const c = byId(s.cranes, d.crane); if (!c || c.del) continue;
    const left = daysBetween(today, d.expiry);
    if (left < 0) w.push({ kind: "docExpired", level: "bad", id: c.id, crane: c.name, doc: d.kind, title: d.title, days: -left });
    else if (left <= 14) w.push({ kind: "docSoon", level: "warn", id: c.id, crane: c.name, doc: d.kind, title: d.title, days: left });
    else if (left <= 30) w.push({ kind: "docSoon", level: "info", id: c.id, crane: c.name, doc: d.kind, title: d.title, days: left });
  }
  for (const p of live(s.people)) {
    if (!p.licenceExp) continue;
    const left = daysBetween(today, p.licenceExp);
    if (left < 0) w.push({ kind: "licenceExpired", level: "bad", id: p.id, who: p.name, days: -left });
    else if (left <= 30) w.push({ kind: "licenceSoon", level: left <= 14 ? "warn" : "info", id: p.id, who: p.name, days: left });
  }
  for (const v of invoiceStatus(s, today)) if (v.status === "overdue") w.push({ kind: "invoiceOverdue", level: v.late > 60 ? "bad" : "warn", id: v.id, no: v.no, who: (byId(s.clients, v.client) || {}).name || "", amount: v.left, days: v.late });
  for (const r of live(s.repairs)) if (!r.to) { const d = daysBetween(r.from, today); w.push({ kind: "repairOpen", level: d > 7 ? "warn" : "info", id: r.crane, crane: (byId(s.cranes, r.crane) || {}).name || "", days: d }); }
  for (const c of live(s.cranes)) { const f = fuelReport(s, c.id), last = f[f.length - 1]; if (last && last.high && last.ym >= addDays(today, -62).slice(0, 7)) w.push({ kind: "fuelHigh", level: "warn", id: c.id, crane: c.name, lph: last.lph, usual: last.usual, ym: last.ym }); }
  return w;
}

// ---- printing & export --------------------------------------------------------------------------------------------------
const esc = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fmt = (n) => (+n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** A printable tax invoice (HTML), English or Arabic. */
export function invoiceHTML(s, id, { rtl = false, currency = s.settings.currency } = {}) {
  const v = invoiceStatus(s).find((x) => x.id === id) || byId(s.invoices, id); if (!v) fail("Not found");
  const c = byId(s.clients, v.client) || {}, S = s.settings;
  const L = rtl ? { t: "فاتورة ضريبية", no: "رقم الفاتورة", date: "التاريخ", due: "تاريخ الاستحقاق", to: "العميل", tax: "الرقم الضريبي", d: "البيان", q: "الكمية", r: "السعر", a: "القيمة", sub: "الإجمالي قبل الضريبة", vat: "ضريبة القيمة المضافة", total: "الإجمالي", wht: "خصم من المنبع", net: "الصافي المطلوب", paid: "المدفوع", left: "الباقي", h: "ساعة", day: "يوم", period: "فترة" }
    : { t: "Tax invoice", no: "Invoice no.", date: "Date", due: "Due", to: "Bill to", tax: "Tax reg. no.", d: "Description", q: "Qty", r: "Rate", a: "Amount", sub: "Subtotal", vat: "VAT", total: "Total", wht: "Withholding tax", net: "Net to pay", paid: "Paid", left: "Left to pay", h: "h", day: "days", period: "periods" };
  const row = (k, val, b) => `<tr${b ? ' class="b"' : ""}><td colspan="3" class="n">${k}</td><td class="n">${fmt(val)}</td></tr>`;
  return `<!doctype html><html dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${esc(v.no)}</title><style>body{font:14px system-ui,Segoe UI,Tahoma,sans-serif;margin:32px;color:#0F172A}h1{font-size:22px;margin:0}.m{color:#475569;margin:2px 0}.top{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap}table{border-collapse:collapse;width:100%;margin-top:18px}th,td{border-bottom:1px solid #CBD5E1;padding:7px 8px;text-align:start}th{color:#475569;font-weight:600}.n{text-align:end;font-variant-numeric:tabular-nums}.b td{font-weight:700;border-top:2px solid #0F172A}</style></head><body>
<div class="top"><div><h1>${esc(S.company || "")}</h1>${S.taxNo ? `<p class="m">${L.tax}: ${esc(S.taxNo)}</p>` : ""}</div><div><h1>${L.t}</h1><p class="m">${L.no}: <b>${esc(v.no)}</b></p><p class="m">${L.date}: ${showDate(v.date)} · ${L.due}: ${showDate(v.due)}</p></div></div>
<p class="m" style="margin-top:14px">${L.to}: <b>${esc(c.name || "")}</b>${c.taxNo ? " · " + L.tax + ": " + esc(c.taxNo) : ""}</p>
<table><thead><tr><th>${L.d}</th><th class="n">${L.q}</th><th class="n">${L.r}</th><th class="n">${L.a}</th></tr></thead><tbody>
${v.lines.map((l) => `<tr><td>${esc(l.desc)}</td><td class="n">${l.qty} ${L[l.unit] || ""}</td><td class="n">${fmt(l.rate)}</td><td class="n">${fmt(l.amount)}</td></tr>`).join("\n")}
${row(L.sub, v.sub)}${v.vat ? row(`${L.vat} ${v.vatPct}%`, v.vat) : ""}${row(L.total, v.total, true)}${v.wht ? row(`${L.wht} ${v.whtPct}%`, -v.wht) + row(L.net, v.net, true) : ""}${v.paid ? row(L.paid, v.paid) + row(L.left, v.left, true) : ""}
</tbody></table><p class="m">${esc(currency)}${v.notes ? " · " + esc(v.notes) : ""}</p></body></html>`;
}
/** Excel rows for the new parts: "invoices" | "aging" | "payroll:<ym>" | "utilisation:<ym>" | "revenue:<year>" | "fuel". */
export function exportProRows(s, kind) {
  const nm = (arr, id) => (byId(arr, id) || {}).name || "";
  if (kind === "invoices") return [["Invoice", "Date", "Due", "Client", "Subtotal", "VAT", "Withholding", "Total", "Net", "Paid", "Left", "Status"],
    ...invoiceStatus(s).map((v) => [v.no, showDate(v.date), showDate(v.due), nm(s.clients, v.client), v.sub, v.vat, v.wht, v.total, v.net, v.paid, v.left, v.status])];
  if (kind === "aging") { const a = aging(s); return [["Client", "Not due", "1–30", "31–60", "61–90", "90+", "Not invoiced", "Total"], ...a.rows.map((r) => [r.client.name, r.current, r.d30, r.d60, r.d90, r.over90, r.notInvoiced, r.total]), ["Total", a.sum.current, a.sum.d30, a.sum.d60, a.sum.d90, a.sum.over90, a.sum.notInvoiced, a.sum.total]]; }
  if (kind.startsWith("payroll:")) { const p = payroll(s, kind.slice(8)); return [["Name", "Role", "Crane", "Days", "Gross", "Advances", "Net"], ...p.rows.map((r) => [r.person.name, r.person.role, nm(s.cranes, r.person.crane), r.days, r.gross, r.advances, r.net]), ["Total", "", "", "", p.sum.gross, p.sum.advances, p.sum.net]]; }
  if (kind.startsWith("utilisation:")) return [["Crane", "Days", "Worked", "Down", "Idle", "Utilisation %"], ...utilisation(s, kind.slice(12)).map((r) => [r.crane.name, r.days, r.worked, r.down, r.idle, r.pct])];
  if (kind.startsWith("revenue:")) { const m = revenueMatrix(s, kind.slice(8)); return [["Crane", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Total"], ...m.rows.map((r) => [r.crane.name, ...r.months, r.total]), ["Total", ...m.months, m.total]]; }
  if (kind === "fuel") return [["Crane", "Month", "Litres", "Cost", "Hours", "L / h", "Usual L / h", "High"], ...live(s.cranes).flatMap((c) => fuelReport(s, c.id).map((m) => [c.name, m.ym, m.litres, m.cost, m.hours, m.lph ?? "", m.usual ?? "", m.high ? "yes" : ""]))];
  fail("Unknown export " + kind);
}
export { DAY };
