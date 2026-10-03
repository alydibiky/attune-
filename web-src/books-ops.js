/* ---- v6.10: operations on a company's books (pure: state in → new state out) ------------------
   Documents move draft → posted (numbered, in the ledger, immutable); a mistake is fixed by a credit note, never by
   editing. Every change is written to a hash-chained audit log (tamper-EVIDENT on a phone, not tamper-proof).
   Storage lives elsewhere (books-store.js); screens in books-ui.jsx. Tests: tests/unit/v611books.test.mjs, v612ops.test.mjs. */
import * as B from "./books.js";

export const EMPTY = () => ({
  v: 1, seq: 1, currency: "EGP",
  company: { name: "", nameAr: "", taxId: "", regNo: "", address: "", phone: "", email: "", bank: "", logo: "", footer: "" },
  tax: B.DEFAULT_TAX, creditDays: 30,
  security: { pin: "", salt: "" },
  customers: [], suppliers: [], items: [],
  docs: [], bills: [], payments: [], supplierPayments: [], expenses: [], stock: [], journal: [], audit: [],
});

const clone = (x) => JSON.parse(JSON.stringify(x));
const year = (iso) => Number(String(iso).slice(0, 4));
export class BooksError extends Error {}
const fail = (m) => { throw new BooksError(m); };

/** A short stable id from the state's own counter (deterministic: tests and merges stay simple). */
function nid(s, p) { return p + (s.seq++).toString(36); }

// ---- the audit chain ---------------------------------------------------------------------------
/** FNV-1a over a string, 53 bits: enough to SEE an edited or deleted entry, not a security boundary. */
export function hash53(str) {
  let h1 = 0xdeadbeef ^ 0, h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
export function log(s, user, action, ref, detail = "", at = new Date().toISOString()) {
  const prev = s.audit.length ? s.audit[s.audit.length - 1].hash : "0";
  const e = { n: s.audit.length + 1, at, user: user || "owner", action, ref, detail: String(detail).slice(0, 200), prev };
  e.hash = hash53(prev + "|" + e.n + "|" + at + "|" + e.user + "|" + action + "|" + ref + "|" + e.detail);
  s.audit.push(e);
}
/** Walks the chain: the first entry that does not match its hash is where someone changed or removed something. */
export function verifyAudit(s) {
  let prev = "0";
  for (const e of s.audit) {
    const h = hash53(prev + "|" + e.n + "|" + e.at + "|" + e.user + "|" + e.action + "|" + e.ref + "|" + e.detail);
    if (e.prev !== prev || e.hash !== h) return { ok: false, brokenAt: e.n };
    prev = e.hash;
  }
  return { ok: true, count: s.audit.length };
}

// ---- master data ---------------------------------------------------------------------------------
export function upsert(state, list, rec, { user, at } = {}) {
  const s = clone(state);
  const arr = s[list];
  if (!arr) fail("Unknown list " + list);
  if (list === "customers" || list === "suppliers") if (!String(rec.name || "").trim()) fail("A name is needed");
  if (list === "items" && !String(rec.name || "").trim()) fail("An item needs a name");
  const i = rec.id ? arr.findIndex((x) => x.id === rec.id) : -1;
  if (i >= 0) { arr[i] = { ...arr[i], ...rec }; log(s, user, "edit " + list, rec.id, rec.name || "", at); return { state: s, id: rec.id }; }
  const id = nid(s, list[0]);
  arr.push({ ...rec, id }); log(s, user, "add " + list, id, rec.name || "", at);
  return { state: s, id };
}
export const setCompany = (state, company, o = {}) => { const s = clone(state); s.company = { ...s.company, ...company }; log(s, o.user, "company", "-", s.company.name, o.at); return s; };

// ---- documents -----------------------------------------------------------------------------------
const lineOk = (l) => Number(l.qty) !== 0 && isFinite(Number(l.qty)) && Number.isInteger(Number(l.price)) && Number(l.price) >= 0;
function checkLines(lines, allowNegative) {
  if (!lines || !lines.length) fail("Add at least one line");
  for (const l of lines) {
    if (!lineOk(l)) fail("Every line needs a quantity and a price");
    if (!allowNegative && Number(l.qty) < 0) fail("A quantity cannot be negative (use a credit note)");
  }
}
/** Save a draft (new or existing). A posted document can never be changed. */
export function saveDraft(state, doc, { user, at } = {}) {
  const s = clone(state);
  const list = doc.type === "bill" ? "bills" : "docs";
  const i = doc.id ? s[list].findIndex((x) => x.id === doc.id) : -1;
  if (i >= 0 && s[list][i].status !== "draft") fail("A posted document cannot be edited — issue a credit note instead");
  const rec = { status: "draft", number: "", ...doc };
  if (i >= 0) { s[list][i] = { ...s[list][i], ...rec, number: "" }; log(s, user, "edit draft", rec.id, rec.type, at); return { state: s, id: rec.id }; }
  rec.id = nid(s, "d"); s[list].push(rec); log(s, user, "new draft", rec.id, rec.type, at);
  return { state: s, id: rec.id };
}
export function deleteDraft(state, id, { user, at } = {}) {
  const s = clone(state);
  for (const list of ["docs", "bills"]) {
    const i = s[list].findIndex((x) => x.id === id);
    if (i >= 0) { if (s[list][i].status !== "draft") fail("Only a draft can be deleted — a posted document is cancelled with a credit note"); s[list].splice(i, 1); log(s, user, "delete draft", id, "", at); return s; }
  }
  fail("Document not found");
}

/** Stock on hand and average cost right now (a posted document's cost of goods comes from here). */
export const levels = (s) => B.stockLevels(s.stock);

/** Post a sales document. quote → issued (a number, no ledger); invoice / credit → numbered, ledger, stock. Returns {state, number, warnings}. */
export function post(state, id, { user, at, today } = {}) {
  const s = clone(state);
  const d = s.docs.find((x) => x.id === id);
  if (!d) fail("Document not found");
  if (d.status !== "draft") fail("This document is already posted");
  if (!d.customer || !s.customers.find((c) => c.id === d.customer)) fail("Choose a customer");
  if (!d.date) fail("Choose a date");
  checkLines(d.lines, d.type === "credit");
  const warnings = [];
  const cust = s.customers.find((c) => c.id === d.customer);
  const series = B.SERIES[d.type];
  if (!series) fail("Unknown document type " + d.type);
  d.number = B.nextNumber(series, year(d.date), s.docs.filter((x) => x.status === "posted" || x.status === "void").concat(s.bills));
  if (d.type === "invoice" && !d.due) d.due = addDays(d.date, cust.creditDays ?? s.creditDays);
  d.status = "posted"; d.postedAt = at || new Date().toISOString();
  if (d.type === "invoice" || d.type === "credit") {
    const tot = B.docTotals(d, s.tax);
    // stock: goods leave (invoice) or come back (credit note with restock) at the moving-average cost
    let cogs = 0;
    const lv = levels(s);
    for (const l of d.lines) {
      const it = l.item && s.items.find((x) => x.id === l.item);
      if (!it || it.track === false) continue;
      const qty = Number(l.qty);
      if (d.type === "invoice") {
        const have = (lv[it.id] || { qty: 0 }).qty;
        if (have < qty) warnings.push(`${it.name}: only ${have} in stock, selling ${qty}`);
        const c = B.cogsFor(lv, it.id, qty); cogs += c;
        s.stock.push({ id: nid(s, "m"), date: d.date, item: it.id, qty: -qty, cost: 0, ref: d.number, kind: "sale", costOut: c });
      } else if (l.restock) {
        const back = Math.abs(qty), avg = (lv[it.id] || { avgCost: 0 }).avgCost;
        const c = Math.round(avg * back);
        cogs += c; s.stock.push({ id: nid(s, "m"), date: d.date, item: it.id, qty: back, cost: c, ref: d.number, kind: "return" });
      }
    }
    if (d.type === "invoice") {
      const owed = B.outstanding(s.docs.filter((x) => x.type === "invoice" && x.status === "posted" && x.customer === d.customer && x.id !== d.id), s.payments, s.docs.filter((x) => x.type === "credit" && x.status === "posted"), s.tax).reduce((a, o) => a + Math.max(0, o.open), 0);
      const cc = B.creditCheck({ limit: cust.creditLimit || 0, owed, newTotal: tot.total });
      if (!cc.ok) warnings.push(`${cust.name} is over the credit limit by ${B.fmt(cc.over)}`);
    }
    s.journal.push(B.salesEntry(d, s.tax, cogs));
  }
  log(s, user, "post " + d.type, d.number, `${cust.name} ${B.fmt(B.docTotals(d, s.tax).total)}`, at);
  return { state: s, number: d.number, warnings };
}

/** A credit note that reverses (part of) a posted invoice. Returns a DRAFT credit note to review and post. */
export function creditNoteFor(state, invoiceId, { lines, restock = false, date, reason = "" } = {}) {
  const inv = state.docs.find((x) => x.id === invoiceId);
  if (!inv || inv.type !== "invoice" || inv.status !== "posted") fail("A credit note needs a posted invoice");
  const src = lines || inv.lines;
  return { type: "credit", customer: inv.customer, against: inv.number, date: date || inv.date, notes: reason,
    lines: src.map((l) => ({ ...l, qty: -Math.abs(Number(l.qty)), restock: !!restock && !!l.item })) };
}

/** Turn an issued quote into a draft invoice (same lines, same customer). */
export function invoiceFromQuote(state, quoteId, date) {
  const q = state.docs.find((x) => x.id === quoteId);
  if (!q || q.type !== "quote") fail("Not a quote");
  return { type: "invoice", customer: q.customer, date, from: q.number, lines: clone(q.lines), notes: q.notes || "" };
}

// ---- money in: receipts -----------------------------------------------------------------------------
/** Record money received. allocations default to oldest-first; a withheld part (wht) per allocation is allowed. */
export function receive(state, { customer, date, method = "cash", amount, allocations, ref = "" }, { user, at } = {}) {
  const s = clone(state);
  if (!s.customers.find((c) => c.id === customer)) fail("Choose a customer");
  if (!(amount > 0) || !Number.isInteger(amount)) fail("Enter the amount received");
  if (!date) fail("Choose a date");
  const open = B.outstanding(s.docs.filter((x) => x.type === "invoice" && x.status === "posted" && x.customer === customer), s.payments, s.docs.filter((x) => x.type === "credit" && x.status === "posted"), s.tax);
  let allocs = allocations;
  if (!allocs) allocs = B.autoAllocate(amount, open).allocations;
  for (const a of allocs) {
    const o = open.find((x) => x.number === a.doc);
    if (!o) fail("Invoice " + a.doc + " is not open for this customer");
    if (a.amount + (a.wht || 0) > o.open) fail(`Invoice ${a.doc}: only ${B.fmt(o.open)} is still open`);
  }
  const cashIn = allocs.reduce((x, a) => x + a.amount, 0);
  if (cashIn > amount) fail("The allocations are more than the amount received");
  const p = { id: nid(s, "p"), number: B.nextNumber(B.SERIES.payment, year(date), s.payments), date, customer, method, amount, allocations: allocs, ref };
  s.payments.push(p); s.journal.push(B.receiptEntry(p));
  log(s, user, "receipt", p.number, B.fmt(amount), at);
  return { state: s, number: p.number, onAccount: amount - cashIn };
}

// ---- purchasing: bills and supplier payments -----------------------------------------------------------
/** Post a supplier bill: stock comes in at the bill cost (net + table tax), input VAT is recorded, the supplier is owed. */
export function postBill(state, id, { user, at } = {}) {
  const s = clone(state);
  const d = s.bills.find((x) => x.id === id);
  if (!d) fail("Bill not found");
  if (d.status !== "draft") fail("This bill is already posted");
  if (!d.supplier || !s.suppliers.find((c) => c.id === d.supplier)) fail("Choose a supplier");
  if (!d.date) fail("Choose a date");
  checkLines(d.lines, false);
  d.number = B.nextNumber(B.SERIES.bill, year(d.date), s.docs.concat(s.bills.filter((x) => x.status === "posted")));
  if (!d.due) d.due = addDays(d.date, 30);
  d.status = "posted"; d.postedAt = at || new Date().toISOString();
  let toStock = 0, toExpense = 0, vat = 0;
  for (const l of d.lines) {
    const f = B.lineFigures(l, s.tax), it = l.item && s.items.find((x) => x.id === l.item);
    const cost = f.net + f.tableTax; vat += f.vat;
    if (it && it.track !== false) { toStock += cost; s.stock.push({ id: nid(s, "m"), date: d.date, item: it.id, qty: Number(l.qty), cost, ref: d.number, kind: "purchase" }); }
    else toExpense += cost;
  }
  s.journal.push(B.entry(d.date, d.number, [{ account: "1300", debit: toStock }, { account: "6000", debit: toExpense }, { account: "1500", debit: vat }, { account: "2000", credit: toStock + toExpense + vat }], "Supplier bill"));
  log(s, user, "post bill", d.number, B.fmt(toStock + toExpense + vat), at);
  return { state: s, number: d.number };
}
export function paySupplier(state, { supplier, date, method = "cash", amount, allocations }, { user, at } = {}) {
  const s = clone(state);
  if (!s.suppliers.find((c) => c.id === supplier)) fail("Choose a supplier");
  if (!(amount > 0) || !Number.isInteger(amount)) fail("Enter the amount paid");
  const open = billsOpen(s).filter((b) => b.supplier === supplier);
  let allocs = allocations;
  if (!allocs) { let left = amount; allocs = []; for (const o of open.sort((a, b) => (a.due < b.due ? -1 : 1))) { if (left <= 0) break; const take = Math.min(left, o.open); allocs.push({ doc: o.number, amount: take }); left -= take; } }
  for (const a of allocs) { const o = open.find((x) => x.number === a.doc); if (!o) fail("Bill " + a.doc + " is not open"); if (a.amount > o.open) fail(`Bill ${a.doc}: only ${B.fmt(o.open)} is still open`); }
  const p = { id: nid(s, "q"), number: B.nextNumber(B.SERIES.supplierPayment, year(date), s.supplierPayments), date, supplier, method, amount, allocations: allocs };
  s.supplierPayments.push(p); s.journal.push(B.supplierPaymentEntry(p));
  log(s, user, "supplier payment", p.number, B.fmt(amount), at);
  return { state: s, number: p.number };
}
/** What we still owe each supplier, bill by bill. */
export function billsOpen(s) {
  return s.bills.filter((b) => b.status === "posted").map((b) => {
    const total = B.docTotals(b, s.tax).total;
    const paid = s.supplierPayments.reduce((x, p) => x + p.allocations.filter((a) => a.doc === b.number).reduce((y, a) => y + a.amount, 0), 0);
    return { number: b.number, supplier: b.supplier, date: b.date, due: b.due || b.date, total, paid, open: total - paid };
  });
}

// ---- expenses ----------------------------------------------------------------------------------------------
export function addExpense(state, { date, category = "General", amount, method = "cash", memo = "", photo = "" }, { user, at } = {}) {
  const s = clone(state);
  if (!(amount > 0) || !Number.isInteger(amount)) fail("Enter the amount");
  if (!date) fail("Choose a date");
  const e = { id: nid(s, "x"), number: "EXP-" + year(date) + "-" + String(s.expenses.length + 1).padStart(5, "0"), date, category, amount, method, memo, photo };
  s.expenses.push(e); s.journal.push(B.expenseEntry({ ...e, memo: category + (memo ? " — " + memo : "") }));
  log(s, user, "expense", e.number, `${category} ${B.fmt(amount)}`, at);
  return { state: s, number: e.number };
}

// ---- stock adjustments (a count, a loss, an opening balance) ---------------------------------------------
export function adjustStock(state, { item, date, qty, unitCost = 0, reason = "adjustment" }, { user, at } = {}) {
  const s = clone(state);
  const it = s.items.find((x) => x.id === item); if (!it) fail("Choose an item");
  if (!Number(qty)) fail("Enter a quantity");
  const q = Number(qty);
  const cost = q > 0 ? Math.round(unitCost * q) : 0;
  s.stock.push({ id: nid(s, "m"), date, item, qty: q, cost, ref: reason, kind: "adjust" });
  // the ledger follows the stock: gain → inventory up against equity; loss → expense against inventory
  if (q > 0) s.journal.push(B.entry(date, "ADJ", [{ account: "1300", debit: cost }, { account: "3000", credit: cost }], reason));
  else { const c = B.cogsFor(levels({ stock: s.stock.slice(0, -1) }), item, -q); s.stock[s.stock.length - 1].costOut = c; s.journal.push(B.entry(date, "ADJ", [{ account: "6000", debit: c }, { account: "1300", credit: c }], reason)); }
  log(s, user, "stock adjust", item, `${q}`, at);
  return s;
}

// ---- the owner's numbers -------------------------------------------------------------------------------------
export function addDays(iso, n) { const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n)); return d.toISOString().slice(0, 10); }
export const monthStart = (iso) => iso.slice(0, 8) + "01";
export function openInvoices(s, asOf) {
  const posted = s.docs.filter((d) => d.type === "invoice" && d.status === "posted");
  return B.outstanding(posted, s.payments, s.docs.filter((d) => d.type === "credit" && d.status === "posted"), s.tax);
}
/** Everything the dashboard shows, from the books alone. */
export function dashboard(s, today) {
  const open = openInvoices(s, today), age = B.ageing(open, today);
  const lv = levels(s), from = monthStart(today);
  const pl = B.profitAndLoss(s.journal, from, today);
  const debtors = Object.entries(age.byCustomer).map(([c, z]) => ({ customer: c, owed: B.AGE_BUCKETS.reduce((a, k) => a + z[k], 0), overdue: B.AGE_BUCKETS.slice(1).reduce((a, k) => a + z[k], 0) })).sort((a, b) => b.owed - a.owed).slice(0, 5);
  const payables = billsOpen(s).reduce((a, b) => a + Math.max(0, b.open), 0);
  const vat = B.vatReturn(s.docs.filter((d) => d.status === "posted" && (d.type === "invoice" || d.type === "credit")), s.bills.filter((b) => b.status === "posted"), from, today, s.tax);
  return {
    cash: B.cashPosition(s.journal, today), receivable: age.grand, overdue: age.overdue, overdueCount: open.filter((o) => o.open > 0 && B.bucketOf(o.due, today) !== "notDue").length,
    payable: payables, ageing: age, debtors, month: pl, vat,
    stockValue: Object.values(lv).reduce((a, x) => a + x.value, 0),
    low: B.lowStock(s.items.filter((i) => i.track !== false), lv),
  };
}

// ---- sample data: a small trading shop, so a new owner (or a tester) can look around a living set of books ------------------
/** Builds a believable shop through the real operations (so every figure, number and ledger entry is genuine). */
export function sampleShop(base = EMPTY(), today = new Date().toISOString().slice(0, 10)) {
  const E = (n) => Math.round(n * 100);
  let s = clone(base);
  const at = today + "T08:00:00.000Z";
  const ago = (n) => addDays(today, -n);
  s = setCompany(s, { name: "Nile Trading Co.", nameAr: "شركة النيل للتجارة", taxId: "123-456-789", regNo: "45678", address: "12 Tahrir St, Cairo · ١٢ شارع التحرير، القاهرة", phone: "+20 100 000 0000", email: "info@niletrading.example", bank: "CIB · EGP · 1000 0000 0000 · Nile Trading Co.", footer: "Thank you for your business · شكراً لتعاملكم" }, { at });
  const add = (list, rec) => { const r = upsert(s, list, rec, { at }); s = r.state; return r.id; };
  const bolts = add("items", { name: "Bolts box (100 pcs)", sku: "BLT-100", unit: "box", price: E(120), cost: E(70), vat: "S", reorder: 15, track: true });
  const paint = add("items", { name: "White paint 20L", sku: "PNT-20", unit: "can", price: E(950), cost: E(700), vat: "S", reorder: 10, track: true });
  const drill = add("items", { name: "Cordless drill", sku: "DRL-18V", unit: "pcs", price: E(2400), cost: E(1750), vat: "S", reorder: 5, track: true });
  const deliv = add("items", { name: "Delivery service", sku: "SRV-DEL", unit: "trip", price: E(150), cost: 0, vat: "S", track: false });
  const c1 = add("customers", { name: "Al-Amal Contracting", phone: "0100 111 2222", address: "6th of October City", taxId: "222-333-444", creditLimit: E(60000), creditDays: 15 });
  const c2 = add("customers", { name: "Hassan Hardware Store", phone: "0122 333 4444", address: "Giza", creditDays: 20 });
  const c3 = add("customers", { name: "Mona Interiors", phone: "0111 555 6666" });
  const s1 = add("suppliers", { name: "Delta Industrial Supplies", phone: "02 2345 6789" });
  const s2 = add("suppliers", { name: "Cairo Paints Factory", phone: "02 2789 0123" });
  const step = (r) => { s = r.state; return r; };
  // stock in (two purchases at different costs → a moving average)
  const bill = (supplier, date, lines) => { const d = step(saveDraft(s, { type: "bill", supplier, date, lines }, { at })); return step(postBill(s, d.id, { at })); };
  bill(s1, ago(40), [{ item: bolts, qty: 60, price: E(68), vat: "S" }, { item: drill, qty: 12, price: E(1700), vat: "S" }]);
  bill(s2, ago(34), [{ item: paint, qty: 40, price: E(690), vat: "S" }]);
  bill(s1, ago(12), [{ item: bolts, qty: 40, price: E(72), vat: "S" }]);
  // sales
  const inv = (customer, date, lines) => { const d = step(saveDraft(s, { type: "invoice", customer, date, lines }, { at })); return step(post(s, d.id, { at })); };
  inv(c1, ago(30), [{ item: paint, qty: 12, price: E(950), vat: "S" }, { item: deliv, qty: 1, price: E(150), vat: "S" }]);
  inv(c2, ago(26), [{ item: bolts, qty: 25, price: E(120), vat: "S" }, { item: drill, qty: 3, price: E(2400), vat: "S", discBp: 500 }]);
  inv(c1, ago(18), [{ item: drill, qty: 4, price: E(2400), vat: "S", wht: "supplies" }]);
  inv(c3, ago(9), [{ item: paint, qty: 6, price: E(950), vat: "S" }]);
  inv(c2, ago(0), [{ item: bolts, qty: 30, price: E(120), vat: "S" }]);
  // money
  step(receive(s, { customer: c1, date: ago(20), method: "bank", amount: E(14000) }, { at }));
  step(receive(s, { customer: c2, date: ago(15), method: "cash", amount: E(9000) }, { at }));
  step(paySupplier(s, { supplier: s1, date: ago(25), method: "bank", amount: E(10000) }, { at }));
  step(addExpense(s, { date: ago(28), category: "Rent", amount: E(6000), method: "cash" }, { at }));
  step(addExpense(s, { date: ago(10), category: "Transport", amount: E(850), method: "cash", memo: "Fuel" }, { at }));
  step(addExpense(s, { date: ago(5), category: "Electricity & water", amount: E(1200), method: "cash" }, { at }));
  return s;
}

// ---- the owner's PIN: keeps casual eyes out on a shared phone (it is NOT encryption) ----------------------------------------
const pinHash = (pin, salt) => hash53("pin|" + salt + "|" + pin);
export function setPin(state, pin, { user, at } = {}) {
  const s = clone(state);
  if (pin === "" || pin == null) { s.security = { pin: "", salt: "" }; log(s, user, "pin removed", "-", "", at); return s; }
  if (!/^\d{4,6}$/.test(String(pin))) fail("The PIN must be 4 to 6 digits");
  const salt = Math.random().toString(36).slice(2, 10);
  s.security = { pin: pinHash(String(pin), salt), salt }; log(s, user, "pin set", "-", "", at);
  return s;
}
export const hasPin = (s) => !!(s.security && s.security.pin);
export const checkPin = (s, pin) => !hasPin(s) || pinHash(String(pin), s.security.salt) === s.security.pin;
