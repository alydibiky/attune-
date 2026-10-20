/* ---- v6.44 Fleet & rentals: the sales side before a job and the buying side of the store (Ali: "Okay do that") -------
   1. Quotations (عروض الأسعار): a quote for a client — crane (or just the tonnage), how it is priced (hourly / daily /
      period), the rate, the expected hours / days, VAT, valid until — printed, then sent → accepted / rejected; past its
      date it is expired. An accepted quote becomes the job order in one step (the same rules as a new job: the crane must
      be free or at that site). Won / lost: how many quotes and how much money were won this year.
   2. Purchase orders (أوامر الشراء): to a supplier, lines (item, qty, unit price), expected date; received in parts —
      each receipt is a real incoming invoice in the store (its own internal code, the supplier and the PO number on it),
      so stock, prices and the reference-code rules all work as before. Late (expected date passed, not all received)
      shows on Today.
   3. Suppliers (الموردين): a record each (phone, opening balance) — what is owed = opening + what came into the store from
      them − what was paid to them (Money → Paid out, not bounced); a statement with the running balance.
   Pure. Tests: tests/unit/v744fleettrade.test.mjs.                                                                     */
import { live, byId, r2, isoDay, readDate, showDate, daysBetween, addDays, addJob, addIncoming, FleetError } from "./fleet.js";

const clone = (x) => JSON.parse(JSON.stringify(x));
const fail = (t, v) => { throw new FleetError(t, v); };
const nid = (s, p) => p + (s.seq++).toString(36);
const norm = (x) => String(x || "").trim().toLowerCase().replace(/\s+/g, " ");
const MODES = ["hourly", "daily", "period"];
export function healTrade(s) {
  for (const k of ["quotes", "pos", "vendors"]) if (!Array.isArray(s[k])) s[k] = [];
  s.settings = { nextQuote: 1, nextPo: 1, quoteDays: 14, ...s.settings };
  return s;
}

// ---- 1. quotations -----------------------------------------------------------------------------------------------------
export function quoteTotals(q, vatPct) {
  const sub = r2((+q.rate || 0) * (+q.qty || 0) + (+q.mobilisation || 0)), vat = r2((sub * (+vatPct || 0)) / 100);
  return { sub, vat, total: r2(sub + vat) };
}
/** A new or edited quote (a sent / accepted one can't change its money — make a new one). */
export function saveQuote(s0, q) {
  const s = healTrade(clone(s0));
  if (!byId(s.clients, q.client)) fail("Choose a client");
  if (!MODES.includes(q.mode)) fail("Choose how it is priced");
  const rate = r2(q.rate), qty = r2(q.qty);
  if (!(rate > 0)) fail("Enter the rate");
  if (!(qty > 0)) fail("Enter the expected hours / days");
  const date = readDate(q.date || isoDay()); if (!date) fail("Enter the date");
  const valid = q.validUntil ? readDate(q.validUntil) : addDays(date, +s.settings.quoteDays || 14); if (!valid) fail("Enter the valid-until date (DD/MM/YYYY)");
  const start = q.start ? readDate(q.start) : ""; if (q.start && !start) fail("Enter the start date (DD/MM/YYYY)");
  const old = q.id && byId(s.quotes, q.id);
  if (old && old.status !== "draft" && (old.rate !== rate || old.qty !== qty || old.mode !== q.mode)) fail("This quote was sent — make a new quote to change its price");
  const vatPct = q.vatPct != null && q.vatPct !== "" ? +q.vatPct : +s.settings.vat || 0;
  const rec = { id: old ? old.id : nid(s, "q"), no: old ? old.no : "QT-" + String(s.settings.nextQuote++).padStart(4, "0"), client: q.client, crane: q.crane || null, tons: +q.tons || 0, site: q.site || null, siteText: q.siteText || "",
    mode: q.mode, rate, qty, mobilisation: r2(q.mobilisation), date, validUntil: valid, start, vatPct, ...quoteTotals({ rate, qty, mobilisation: q.mobilisation }, vatPct),
    status: old ? old.status : "draft", job: old ? old.job : null, notes: q.notes || "" };
  if (old) s.quotes = s.quotes.map((x) => (x.id === rec.id ? rec : x)); else s.quotes.push(rec);
  return { state: s, quote: rec };
}
export const QUOTE_STATUS = ["draft", "sent", "accepted", "rejected"];
export function setQuoteStatus(s0, id, status) {
  const s = clone(s0), q = byId(s.quotes || [], id); if (!q) fail("Not found");
  if (!QUOTE_STATUS.includes(status)) fail("Unknown status");
  if (q.job && status !== "accepted") fail("This quote is already a job order ({no})", { no: (byId(s.jobs, q.job) || {}).no || "" });
  q.status = status; if (status === "sent" && !q.sentAt) q.sentAt = isoDay();
  return s;
}
/** The status as it stands today: a draft / sent quote past its valid date is expired. */
export const quoteState = (q, today = isoDay()) => (q.job ? "won" : (q.status === "draft" || q.status === "sent") && q.validUntil < today ? "expired" : q.status);
/** An accepted (or sent) quote → the job order: crane and site (the quote's, or chosen now), its pricing and rate. */
export function quoteToJob(s0, id, { crane = null, site = null, start = "" } = {}) {
  let s = healTrade(clone(s0)); const q = byId(s.quotes, id); if (!q) fail("Not found");
  if (q.job) fail("This quote is already a job order ({no})", { no: (byId(s.jobs, q.job) || {}).no || "" });
  if (q.status === "rejected") fail("This quote was rejected");
  const c = crane || q.crane, st = site || q.site, d = readDate(start || q.start || isoDay());
  if (!c) fail("Choose a crane"); if (!st) fail("Choose a site"); if (!d) fail("Enter the start date");
  s = addJob(s, { crane: c, client: q.client, site: st, mode: q.mode, rate: q.rate, start: d, notes: (q.notes ? q.notes + " · " : "") + q.no });
  const j = s.jobs[s.jobs.length - 1], qq = byId(s.quotes, id);
  qq.status = "accepted"; qq.job = j.id; qq.crane = c; qq.site = st;
  return { state: s, job: j };
}
/** Won / lost for a year: quotes decided, their money, the win rate (by count and by money). */
export function quoteStats(s, year = isoDay().slice(0, 4), today = isoDay()) {
  const qs = live(s.quotes || []).filter((q) => q.date.slice(0, 4) === String(year));
  const won = qs.filter((q) => q.job || q.status === "accepted"), lost = qs.filter((q) => q.status === "rejected" || quoteState(q, today) === "expired"), open = qs.filter((q) => !won.includes(q) && !lost.includes(q));
  const sum = (l) => r2(l.reduce((n, q) => n + q.sub, 0));
  const decided = won.length + lost.length;
  return { count: qs.length, won: won.length, lost: lost.length, open: open.length, wonValue: sum(won), lostValue: sum(lost), openValue: sum(open),
    rate: decided ? Math.round((won.length / decided) * 100) : null, valueRate: sum(won) + sum(lost) ? Math.round((sum(won) / (sum(won) + sum(lost))) * 100) : null };
}
/** Cranes free now (not on an active job), the ones that lift at least `tons` first. */
export function freeCranes(s, tons = 0) {
  const busy = new Set(live(s.jobs).filter((j) => j.status === "active").map((j) => j.crane));
  return live(s.cranes).filter((c) => !busy.has(c.id) && (!tons || (+c.tons || 0) >= tons)).sort((a, b) => (+a.tons || 0) - (+b.tons || 0));
}

// ---- 2. purchase orders ---------------------------------------------------------------------------------------------------
export function savePO(s0, po) {
  const s = healTrade(clone(s0));
  if (!String(po.vendor || "").trim()) fail("Choose the supplier");
  const date = readDate(po.date || isoDay()); if (!date) fail("Enter the date");
  const expected = po.expected ? readDate(po.expected) : ""; if (po.expected && !expected) fail("Enter the expected date (DD/MM/YYYY)");
  const lines = (po.lines || []).map((l) => ({ item: String(l.item || "").trim(), qty: r2(l.qty), price: r2(l.price) })).filter((l) => l.item && l.qty > 0);
  if (!lines.length) fail("Add at least one item with a quantity");
  if (lines.some((l) => l.price < 0)) fail("A price can't be negative");
  const old = po.id && byId(s.pos, po.id);
  if (old && Object.keys(old.received || {}).length) fail("Part of this order was received — make a new order for the rest");
  const rec = { id: old ? old.id : nid(s, "o"), no: old ? old.no : "PO-" + String(s.settings.nextPo++).padStart(4, "0"), vendor: String(po.vendor).trim(), date, expected, lines,
    total: r2(lines.reduce((n, l) => n + l.qty * l.price, 0)), received: old ? old.received || {} : {}, receipts: old ? old.receipts || [] : [], cancelled: false, notes: po.notes || "" };
  if (old) s.pos = s.pos.map((x) => (x.id === rec.id ? rec : x)); else s.pos.push(rec);
  ensureVendor(s, rec.vendor);
  return { state: s, po: rec };
}
/** Each line: ordered / received / left; the order: open / partial / received / cancelled, and late. */
export function poStatus(po, today = isoDay()) {
  const lines = po.lines.map((l) => { const got = r2((po.received || {})[norm(l.item)] || 0); return { ...l, received: got, left: r2(Math.max(0, l.qty - got)) }; });
  const left = lines.reduce((n, l) => n + l.left, 0), got = lines.reduce((n, l) => n + l.received, 0);
  const status = po.cancelled ? "cancelled" : left <= 0 ? "received" : got > 0 ? "partial" : "open";
  return { ...po, lines, status, late: status !== "received" && status !== "cancelled" && po.expected && po.expected < today ? daysBetween(po.expected, today) : 0 };
}
/** Receive goods of an order: lines [{ item, qty }] (default: everything left) → an incoming invoice in the store at the
    order's prices, with the supplier and the order number; the order remembers what came. */
export function receivePO(s0, id, { date = isoDay(), purchaser, lines = null, evidence = null } = {}) {
  let s = healTrade(clone(s0)); const po = byId(s.pos, id); if (!po) fail("Not found");
  if (po.cancelled) fail("This order was cancelled");
  const st = poStatus(po);
  const take = (lines || st.lines.map((l) => ({ item: l.item, qty: l.left }))).map((l) => ({ item: l.item, qty: r2(l.qty) })).filter((l) => l.qty > 0);
  if (!take.length) fail("Nothing left to receive on this order");
  for (const t of take) { const l = st.lines.find((x) => norm(x.item) === norm(t.item)); if (!l) fail("{item} is not on this order", { item: t.item }); if (t.qty > l.left) fail("{item}: only {n} left to receive", { item: l.item, n: l.left }); }
  const r = addIncoming(s, { date, purchaser, supplier: po.vendor, notes: po.no, evidence, lines: take.map((t) => { const l = st.lines.find((x) => norm(x.item) === norm(t.item)); return { item: l.item, qty: t.qty, total: r2(t.qty * l.price) }; }) });
  s = r.state; const p = byId(s.pos, id);
  p.received = { ...(p.received || {}) }; for (const t of take) p.received[norm(t.item)] = r2((p.received[norm(t.item)] || 0) + t.qty);
  p.receipts = [...(p.receipts || []), { date: readDate(date), doc: r.doc }];
  return { state: s, doc: r.doc };
}
export function cancelPO(s0, id) { const s = clone(s0), p = byId(s.pos || [], id); if (!p) fail("Not found"); p.cancelled = true; return s; }

// ---- 3. suppliers ------------------------------------------------------------------------------------------------------------
function ensureVendor(s, name) { if (!s.vendors.some((v) => norm(v.name) === norm(name))) s.vendors.push({ id: nid(s, "v"), name: String(name).trim(), phone: "", opening: 0 }); }
export function saveVendor(s0, v) {
  const s = healTrade(clone(s0));
  if (!String(v.name || "").trim()) fail("A name is needed");
  const dup = live(s.vendors).find((x) => x.id !== v.id && norm(x.name) === norm(v.name)); if (dup) fail("\"{name}\" is already in the list", { name: v.name });
  const rec = { id: v.id || nid(s, "v"), name: String(v.name).trim(), phone: v.phone || "", opening: r2(v.opening), notes: v.notes || "" };
  if (v.id && byId(s.vendors, v.id)) s.vendors = s.vendors.map((x) => (x.id === v.id ? { ...x, ...rec } : x)); else s.vendors.push(rec);
  return s;
}
/** Every supplier: the vendors list + every supplier name on incoming invoices (the old records keep working). */
export function vendorList(s) {
  healTrade(s);
  const out = live(s.vendors).map((v) => ({ ...v }));
  for (const t of (s.store.tx || []).filter((x) => x.kind === "in" && x.supplier)) if (!out.some((v) => norm(v.name) === norm(t.supplier))) out.push({ id: "", name: t.supplier, phone: "", opening: 0 });
  return out;
}
/** A supplier's statement: opening, every incoming invoice (credit — we owe it), every payment out (debit), the balance. */
export function vendorStatement(s, name) {
  const v = vendorList(s).find((x) => norm(x.name) === norm(name)) || { name, opening: 0 };
  const rows = [];
  const docs = {};
  for (const t of (s.store.tx || []).filter((x) => x.kind === "in" && norm(x.supplier) === norm(name))) { docs[t.doc] = docs[t.doc] || { date: t.date, doc: t.doc, total: 0, notes: t.notes }; docs[t.doc].total = r2(docs[t.doc].total + t.total); }
  for (const d of Object.values(docs)) rows.push({ date: d.date, what: "Invoice " + d.doc + (d.notes ? " · " + d.notes : ""), owed: d.total, paid: 0 });
  for (const q of live(s.cheques).filter((x) => x.dir === "out" && norm(x.payee) === norm(name) && x.status !== "bounced"))
    rows.push({ date: q.due, what: (q.method === "cheque" ? "Cheque " + q.no : q.method === "cash" ? "Cash" : "Transfer") + (q.status === "pending" ? " (not yet due)" : ""), owed: 0, paid: q.amount, pending: q.status === "pending" });
  rows.sort((a, b) => (a.date < b.date ? -1 : 1));
  let bal = +v.opening || 0; for (const r of rows) { bal = r2(bal + r.owed - r.paid); r.balance = bal; }
  const bought = r2(rows.reduce((n, r) => n + r.owed, 0)), paid = r2(rows.reduce((n, r) => n + r.paid, 0));
  return { vendor: v, opening: +v.opening || 0, rows, bought, paid, balance: r2((+v.opening || 0) + bought - paid) };
}
/** What is owed to each supplier, most first. */
export const vendorBalances = (s) => vendorList(s).map((v) => { const st = vendorStatement(s, v.name); return { vendor: v, bought: st.bought, paid: st.paid, balance: st.balance }; }).sort((a, b) => b.balance - a.balance);

// ---- warnings, printing, export -------------------------------------------------------------------------------------------------
export function tradeWarnings(s, today = isoDay()) {
  healTrade(s); const w = [];
  for (const q of live(s.quotes)) if (q.status === "sent" && !q.job) { const d = daysBetween(today, q.validUntil); if (d >= 0 && d <= 3) w.push({ kind: "quoteExpiring", level: "info", id: q.id, no: q.no, who: (byId(s.clients, q.client) || {}).name || "", days: d, amount: q.total }); }
  for (const p of live(s.pos)) { const st = poStatus(p, today); if (st.late) w.push({ kind: "poLate", level: st.late > 7 ? "warn" : "info", id: p.id, no: p.no, who: p.vendor, days: st.late }); }
  return w;
}
const esc = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fmt = (n) => (+n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const page = (rtl, title, head, rows, foot) => `<!doctype html><html dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:14px system-ui,Segoe UI,Tahoma,sans-serif;margin:32px;color:#0F172A}h1{font-size:22px;margin:0}.m{color:#475569;margin:2px 0}table{border-collapse:collapse;width:100%;margin-top:18px}th,td{border-bottom:1px solid #CBD5E1;padding:7px 8px;text-align:start}th{color:#475569;font-weight:600}.n{text-align:end;font-variant-numeric:tabular-nums}.b td{font-weight:700;border-top:2px solid #0F172A}.sig{margin-top:48px;display:flex;justify-content:space-between}</style></head><body>${head}<table>${rows}</table>${foot}</body></html>`;
export function quoteHTML(s, id, { rtl = false } = {}) {
  const q = byId(s.quotes || [], id); if (!q) fail("Not found");
  const c = byId(s.clients, q.client) || {}, cr = q.crane ? byId(s.cranes, q.crane) : null, S = s.settings, cur = S.currency || "";
  const L = rtl ? { t: "عرض سعر", no: "رقم العرض", date: "التاريخ", valid: "سارٍ حتى", to: "السادة", d: "البيان", q: "الكمية", r: "السعر", a: "القيمة", sub: "الإجمالي قبل الضريبة", vat: "ضريبة القيمة المضافة", total: "الإجمالي", mob: "النقل والتركيب", h: "ساعة", day: "يوم", period: "فترة", sign: "التوقيع والختم", site: "الموقع", start: "البدء المتوقع" }
    : { t: "Quotation", no: "Quote no.", date: "Date", valid: "Valid until", to: "To", d: "Description", q: "Qty", r: "Rate", a: "Amount", sub: "Subtotal", vat: "VAT", total: "Total", mob: "Mobilisation", h: "hours", day: "days", period: "periods", sign: "Signature & stamp", site: "Site", start: "Expected start" };
  const unit = q.mode === "hourly" ? L.h : q.mode === "daily" ? L.day : L.period;
  const what = (cr ? cr.name : q.tons ? q.tons + " t" : rtl ? "ونش" : "Crane") + (cr && cr.tons ? ` (${cr.tons} t)` : "");
  const site = (byId(s.sites, q.site) || {}).name || q.siteText;
  return page(rtl, q.no, `<div style="display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap"><div><h1>${esc(S.company || "")}</h1>${S.taxNo ? `<p class="m">${esc(S.taxNo)}</p>` : ""}</div><div><h1>${L.t}</h1><p class="m">${L.no}: <b>${esc(q.no)}</b></p><p class="m">${L.date}: ${showDate(q.date)} · ${L.valid}: ${showDate(q.validUntil)}</p></div></div>
<p class="m" style="margin-top:14px">${L.to}: <b>${esc(c.name || "")}</b>${site ? " · " + L.site + ": " + esc(site) : ""}${q.start ? " · " + L.start + ": " + showDate(q.start) : ""}</p>`,
    `<thead><tr><th>${L.d}</th><th class="n">${L.q}</th><th class="n">${L.r}</th><th class="n">${L.a}</th></tr></thead><tbody><tr><td>${esc(what)}</td><td class="n">${q.qty} ${unit}</td><td class="n">${fmt(q.rate)}</td><td class="n">${fmt(q.rate * q.qty)}</td></tr>
${q.mobilisation ? `<tr><td>${L.mob}</td><td></td><td></td><td class="n">${fmt(q.mobilisation)}</td></tr>` : ""}<tr><td colspan="3" class="n">${L.sub}</td><td class="n">${fmt(q.sub)}</td></tr>${q.vat ? `<tr><td colspan="3" class="n">${L.vat} ${q.vatPct}%</td><td class="n">${fmt(q.vat)}</td></tr>` : ""}<tr class="b"><td colspan="3" class="n">${L.total}</td><td class="n">${fmt(q.total)} ${esc(cur)}</td></tr></tbody>`,
    `${q.notes ? `<p class="m">${esc(q.notes)}</p>` : ""}<div class="sig"><span>${L.sign}</span><span>${L.sign}</span></div>`);
}
export function poHTML(s, id, { rtl = false } = {}) {
  const p = byId(s.pos || [], id); if (!p) fail("Not found");
  const S = s.settings, L = rtl ? { t: "أمر شراء", no: "رقم الأمر", date: "التاريخ", exp: "التوريد المتوقع", to: "المورد", i: "الصنف", q: "الكمية", r: "سعر الوحدة", a: "القيمة", total: "الإجمالي", sign: "التوقيع" }
    : { t: "Purchase order", no: "PO no.", date: "Date", exp: "Expected", to: "Supplier", i: "Item", q: "Qty", r: "Unit price", a: "Amount", total: "Total", sign: "Signature" };
  return page(rtl, p.no, `<h1>${esc(S.company || "")}</h1><h1 style="margin-top:8px">${L.t} ${esc(p.no)}</h1><p class="m">${L.date}: ${showDate(p.date)}${p.expected ? " · " + L.exp + ": " + showDate(p.expected) : ""}</p><p class="m">${L.to}: <b>${esc(p.vendor)}</b></p>`,
    `<thead><tr><th>${L.i}</th><th class="n">${L.q}</th><th class="n">${L.r}</th><th class="n">${L.a}</th></tr></thead><tbody>${p.lines.map((l) => `<tr><td>${esc(l.item)}</td><td class="n">${l.qty}</td><td class="n">${fmt(l.price)}</td><td class="n">${fmt(l.qty * l.price)}</td></tr>`).join("")}<tr class="b"><td colspan="3" class="n">${L.total}</td><td class="n">${fmt(p.total)} ${esc(S.currency || "")}</td></tr></tbody>`,
    `${p.notes ? `<p class="m">${esc(p.notes)}</p>` : ""}<div class="sig"><span>${L.sign}</span></div>`);
}
export function exportTradeRows(s, kind) {
  const nm = (arr, id) => (byId(arr, id) || {}).name || "";
  if (kind === "quotes") return [["Quote", "Date", "Client", "Pricing", "Rate", "Qty", "Subtotal", "VAT", "Total", "Valid until", "Status", "Job"], ...live(s.quotes || []).map((q) => [q.no, showDate(q.date), nm(s.clients, q.client), q.mode, q.rate, q.qty, q.sub, q.vat, q.total, showDate(q.validUntil), quoteState(q), (byId(s.jobs, q.job) || {}).no || ""])];
  if (kind === "pos") return [["PO", "Date", "Supplier", "Item", "Ordered", "Received", "Left", "Unit price", "Expected", "Status"], ...live(s.pos || []).flatMap((p) => { const st = poStatus(p); return st.lines.map((l) => [p.no, showDate(p.date), p.vendor, l.item, l.qty, l.received, l.left, l.price, showDate(p.expected), st.status]); })];
  if (kind === "vendors") return [["Supplier", "Opening", "Bought", "Paid", "Owed"], ...vendorBalances(s).map((b) => [b.vendor.name, b.vendor.opening || 0, b.bought, b.paid, b.balance])];
  fail("Unknown export " + kind);
}
