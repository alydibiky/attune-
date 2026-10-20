/* ---- v6.45 Fleet & rentals ← Ali's two desktop programs, screen by screen (Crane Management v2.7 + Crane Warehouse).
   Everything those programs had that Fleet still lacked (their rules were already in fleet.js since v6.32):
   - Crane program: the Dashboard's month money on a CASH basis (collected = incoming payments not bounced, by their date;
     spent = expenses) and the 6-month summary, all-time profit, the clients who owe most; Active now's counts; the Rates
     page (every crane's hourly and daily rate in one table); profitability per SITE; the Report builder's tables printed
     as a PDF; the Query page (cheques / jobs / expenses / moves by status and dates).
   - Warehouse program: the reference-code report's list of every issue taken from an invoice; the Destinations report's
     history (what a supplier sold us, what a crane or place received); the reference lists (القوائم المرجعية) — rename
     or remove a name everywhere; the store's dashboard numbers.
   Pure. Tests: tests/unit/v745fleetdesk.test.mjs.                                                                      */
import { live, byId, r2, isoDay, showDate, clientBalance, FleetError, runningBalances, itemBalance, stockList } from "./fleet.js";

const clone = (x) => JSON.parse(JSON.stringify(x));
const fail = (t, v) => { throw new FleetError(t, v); };
const norm = (x) => String(x || "").trim().toLowerCase().replace(/\s+/g, " ");
const inRange = (d, a, b) => (!a || d >= a) && (!b || d <= b);
const ymShift = (ym, n) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 1)).toISOString().slice(0, 7);

// ---- the crane program's Dashboard (cash basis) -----------------------------------------------------------------------------
/** Money collected (incoming payments not bounced, by their due date — the crane program's rule) and spent (expenses), from–to. */
export function cashTotals(s, { from = "", to = "" } = {}) {
  const income = r2(live(s.cheques).filter((q) => q.dir === "in" && q.status !== "bounced" && q.due && inRange(q.due, from, to)).reduce((n, q) => n + q.amount, 0));
  const expenses = r2(live(s.expenses).filter((x) => inRange(x.date, from, to)).reduce((n, x) => n + x.total, 0));
  return { income, expenses, profit: r2(income - expenses) };
}
/** The last `n` months, oldest first: collected, spent, profit (the crane program's "Monthly summary"). */
export function monthlyCash(s, n = 6, today = isoDay()) {
  const ym = today.slice(0, 7);
  return Array.from({ length: n }, (_, i) => { const m = ymShift(ym, i - n + 1); return { ym: m, ...cashTotals(s, { from: m + "-01", to: m + "-31" }) }; });
}
/** Clients who owe, most first. */
export const topOwing = (s, n = 8) => live(s.clients).map((c) => ({ client: c, balance: clientBalance(s, c.id).balance })).filter((x) => x.balance > 0.004).sort((a, b) => b.balance - a.balance).slice(0, n);
/** Active now: the sites, clients and jobs with a crane working. */
export function activeCounts(s) {
  const act = live(s.jobs).filter((j) => j.status === "active");
  return { jobs: act.length, sites: new Set(act.map((j) => j.site)).size, clients: new Set(act.map((j) => j.client)).size };
}

// ---- Rates page ------------------------------------------------------------------------------------------------------------
/** rates: { craneId: { hourly, daily } } → every crane's default rates at once (new job orders take them). */
export function setRates(s0, rates) {
  const s = clone(s0);
  for (const [id, r] of Object.entries(rates || {})) {
    const c = byId(s.cranes, id); if (!c) continue;
    const h = r2(r.hourly), d = r2(r.daily); if (h < 0 || d < 0) fail("A rate can't be negative");
    c.hourly = h; c.daily = d;
  }
  return s;
}

// ---- profitability per site --------------------------------------------------------------------------------------------------
/** Income from the work at each site (its jobs) − the expenses tagged to it, from–to; most profitable first. */
export function siteProfit(s, { from = "", to = "" } = {}) {
  const jobs = new Map(live(s.jobs).map((j) => [j.id, j]));
  return live(s.sites).map((site) => {
    const income = r2(live(s.entries).filter((e) => { const j = jobs.get(e.job); return j && j.site === site.id && j.status !== "cancelled" && inRange(e.date, from, to); }).reduce((n, e) => n + e.amount, 0));
    const expenses = r2(live(s.expenses).filter((x) => x.site === site.id && inRange(x.date, from, to)).reduce((n, x) => n + x.total, 0));
    return { site, income, expenses, profit: r2(income - expenses) };
  }).sort((a, b) => b.profit - a.profit);
}

// ---- the Query page ------------------------------------------------------------------------------------------------------------
export const QUERY_STATUS = { cheques: ["pending", "cleared", "bounced"], jobs: ["active", "completed", "cancelled"], expenses: [], moves: [] };
/** { table: cheques | jobs | expenses | moves, status, from, to } → { head: [labels], rows: [[cells]] } (dates DD/MM/YYYY). */
export function query(s, { table = "cheques", status = "", from = "", to = "" } = {}) {
  const nm = (arr, id) => (byId(arr, id) || {}).name || "";
  const place = (l) => (l ? nm(l.kind === "site" ? s.sites : s.garages, l.id) : "");
  if (table === "cheques") {
    const rows = live(s.cheques).filter((q) => (!status || q.status === status) && inRange(q.due, from, to)).sort((a, b) => (a.due < b.due ? 1 : -1));
    return { head: ["Number", "In / out", "Client / payee", "Bank", "Due", "Status", "Amount"], rows: rows.map((q) => [q.no || q.method, q.dir === "in" ? "In" : "Out", q.client ? nm(s.clients, q.client) : q.payee, q.bank || "", showDate(q.due), q.status, q.amount]), total: r2(rows.reduce((n, q) => n + q.amount, 0)) };
  }
  if (table === "jobs") {
    const rows = live(s.jobs).filter((j) => (!status || j.status === status) && inRange(j.start, from, to)).reverse();
    const tot = (id) => r2(live(s.entries).filter((e) => e.job === id).reduce((n, e) => n + e.amount, 0));
    return { head: ["Job", "Crane", "Site", "Client", "Pricing", "Status", "Total"], rows: rows.map((j) => [j.no, nm(s.cranes, j.crane), nm(s.sites, j.site), nm(s.clients, j.client), j.mode, j.status, tot(j.id)]), total: r2(rows.reduce((n, j) => n + tot(j.id), 0)) };
  }
  if (table === "expenses") {
    const rows = live(s.expenses).filter((x) => inRange(x.date, from, to)).sort((a, b) => (a.date < b.date ? 1 : -1));
    return { head: ["Date", "What", "Crane", "Site", "Amount"], rows: rows.map((x) => [x.period ? showDate(x.from) + " → " + showDate(x.to) : showDate(x.date), x.notes || x.lines.map((l) => l.type).join(", "), nm(s.cranes, x.crane), nm(s.sites, x.site), x.total]), total: r2(rows.reduce((n, x) => n + x.total, 0)) };
  }
  if (table === "moves") {
    const rows = (s.moves || []).filter((m) => inRange(m.date, from, to)).slice().reverse();
    return { head: ["Date", "Crane", "From", "To", "Note"], rows: rows.map((m) => [showDate(m.date), nm(s.cranes, m.crane), place(m.from), place(m.to), m.note || ""]), total: null };
  }
  fail("Unknown table " + table);
}

// ---- reports as a printed page (the crane program's "Export PDF" on every report) --------------------------------------------------
const esc = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const cell = (v) => (typeof v === "number" ? `<td class="n">${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>` : `<td>${esc(v)}</td>`);
/** A table as a printable page (title, company, the date it was made). */
export function tableHTML({ title, head, rows, total = null, company = "", note = "", rtl = false }) {
  return `<!doctype html><html dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:14px system-ui,Segoe UI,Tahoma,sans-serif;margin:30px;color:#0F172A}h1{font-size:21px;margin:0 0 4px}.m{color:#475569;margin:2px 0 12px}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #CBD5E1;padding:7px 9px;text-align:start}th{background:#0F172A;color:#fff;font-weight:600}tr:nth-child(even) td{background:#F8FAFC}.n{text-align:end;font-variant-numeric:tabular-nums}tfoot td{font-weight:700;border-top:2px solid #0F172A}</style></head><body>
<h1>${esc(title)}</h1><p class="m">${esc(company)}${company ? " · " : ""}${showDate(isoDay())}${note ? " · " + esc(note) : ""}</p>
<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map(cell).join("")}</tr>`).join("\n")}</tbody>${total != null ? `<tfoot><tr><td colspan="${head.length - 1}"></td>${cell(total)}</tr></tfoot>` : ""}</table></body></html>`;
}

// ---- the warehouse program's reports ------------------------------------------------------------------------------------------------
/** Every issue taken from an incoming invoice (its reference code), oldest first. */
export function refIssues(s, doc) {
  return runningBalances(s.store).filter((t) => t.kind === "out" && t.ref === doc).map((t) => ({ date: t.date, doc: t.doc, item: t.item, qty: t.qty, total: t.total, tech: t.tech || "", to: t.crane ? (byId(s.cranes, t.crane) || {}).name || "" : t.dest || "" }));
}
/** The history behind a Destinations / Suppliers row: key "supplier" (what it sold us) or "crane" / "dest" (what went there). */
export function storeHistory(s, key, name) {
  const n = norm(name);
  const match = (t) => (key === "supplier" ? t.kind === "in" && norm(t.supplier) === n : key === "tech" ? t.kind === "out" && norm(t.tech) === n
    : t.kind === "out" && (t.crane ? norm((byId(s.cranes, t.crane) || {}).name) === n : norm(t.dest || "—") === n));
  const rows = runningBalances(s.store).filter(match).map((t) => ({ date: t.date, doc: t.doc, item: t.item, qty: t.qty, unit: t.unit, total: t.total, ref: t.ref || "", tech: t.tech || "" }));
  return { rows, qty: r2(rows.reduce((a, r) => a + r.qty, 0)), total: r2(rows.reduce((a, r) => a + r.total, 0)) };
}
/** The store's dashboard: items, stock value at purchase price, low items, in and out this month. */
export function storeKpis(s, today = isoDay()) {
  const list = stockList(s.store), ym = today.slice(0, 7), tx = (s.store.tx || []).filter((t) => t.date.slice(0, 7) === ym);
  return { items: list.length, value: r2(list.reduce((n, x) => n + x.value, 0)), low: list.filter((x) => x.low).length,
    inMonth: r2(tx.filter((t) => t.kind === "in").reduce((n, t) => n + t.total, 0)), outMonth: r2(tx.filter((t) => t.kind === "out").reduce((n, t) => n + t.total, 0)) };
}

// ---- reference lists (القوائم المرجعية) ---------------------------------------------------------------------------------------------
export const NAME_LISTS = ["suppliers", "techs", "dests", "purchasers", "requesters"];
const FIELD = { suppliers: "supplier", techs: "tech", dests: "dest", purchasers: "purchaser", requesters: "requester" };
/** Every name of a list, with how many store lines use it. */
export function namesOf(s, list) {
  if (list === "items") return (s.store.items || []).map((it) => ({ name: it.name, used: (s.store.tx || []).filter((t) => norm(t.item) === norm(it.name)).length }));
  const f = FIELD[list]; if (!f) fail("Unknown list " + list);
  return (s.store[list] || []).map((name) => ({ name, used: (s.store.tx || []).filter((t) => norm(t[f]) === norm(name)).length }));
}
export function addName(s0, list, name) {
  const s = clone(s0), v = String(name || "").trim(); if (!v) fail("A name is needed");
  if (list === "items") { if ((s.store.items || []).some((x) => norm(x.name) === norm(v))) fail("\"{name}\" is already in the list", { name: v }); s.store.items.push({ id: "i" + (s.store.items.length + 1) + Date.now().toString(36).slice(-3), name: v, unit: "", min: 0, opening: 0 }); return s; }
  if (!FIELD[list]) fail("Unknown list " + list);
  if ((s.store[list] || []).some((x) => norm(x) === norm(v))) fail("\"{name}\" is already in the list", { name: v });
  s.store[list] = [...(s.store[list] || []), v]; return s;
}
/** Rename a name everywhere: the list and every store line that uses it (the warehouse program changed it in all dropdowns). */
export function renameName(s0, list, from, to) {
  const s = clone(s0), v = String(to || "").trim(); if (!v) fail("A name is needed");
  if (norm(from) !== norm(v) && namesOf(s, list).some((x) => norm(x.name) === norm(v))) fail("\"{name}\" is already in the list", { name: v });
  if (list === "items") {
    for (const it of s.store.items) if (norm(it.name) === norm(from)) it.name = v;
    for (const t of s.store.tx) if (norm(t.item) === norm(from)) t.item = v;
    return s;
  }
  const f = FIELD[list]; if (!f) fail("Unknown list " + list);
  s.store[list] = s.store[list].map((x) => (norm(x) === norm(from) ? v : x));
  for (const t of s.store.tx) if (norm(t[f]) === norm(from)) t[f] = v;
  if (list === "suppliers") for (const p of s.pos || []) if (norm(p.vendor) === norm(from)) p.vendor = v;
  return s;
}
/** Remove a name from a list — only when no store line uses it (the lines would lose their meaning). */
export function removeName(s0, list, name) {
  const s = clone(s0), used = (namesOf(s, list).find((x) => norm(x.name) === norm(name)) || {}).used || 0;
  if (used) fail("{n} store line(s) use \"{name}\" — rename it instead", { n: used, name });
  if (list === "items") { if (itemBalance(s.store, name) !== 0) fail("\"{name}\" still has stock", { name }); s.store.items = s.store.items.filter((x) => norm(x.name) !== norm(name)); return s; }
  s.store[list] = (s.store[list] || []).filter((x) => norm(x) !== norm(name)); return s;
}
