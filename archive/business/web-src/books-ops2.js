/* ---- Business extras, the operations: users & roles, price lists, exchange rates, foreign-currency receipts,
   delivery notes. Same contract as books-ops.js: pure (state in → new state out), every change in the audit chain,
   the ledger always balances, numbers are gapless per series per year. Tests: tests/unit/v620bizextras.test.mjs.  */
import * as B from "./books.js";
import * as M from "./books-more.js";
import { BooksError, log, nid, need, pinHash, getActor, levels } from "./books-ops.js";

const clone = (x) => JSON.parse(JSON.stringify(x));
const fail = (m) => { throw new BooksError(m); };
const year = (iso) => Number(String(iso).slice(0, 4));
const ensure = (s) => { for (const k of ["users", "priceLists", "deliveries", "fxRates"]) if (!Array.isArray(s[k])) s[k] = []; return s; };

// ---- users and roles -----------------------------------------------------------------------------------------------
/** Add or edit a user. The first user must be an owner (so nobody locks the owner out). PIN: 4–6 digits, stored hashed. */
export function saveUser(state, { id, name, role, pin }, { at, salt } = {}) {
  const s = ensure(clone(state));
  if (s.users.length) need("users");
  if (!String(name || "").trim()) fail("A user needs a name");
  if (!M.ROLES[role]) fail("Choose a role");
  if (!s.users.length && role !== "owner") fail("The first user must be the owner");
  const i = id ? s.users.findIndex((u) => u.id === id) : -1;
  if (i < 0 && !pin) fail("Choose a PIN for this user");
  if (pin && !/^\d{4,6}$/.test(String(pin))) fail("The PIN must be 4 to 6 digits");
  if (i >= 0 && s.users[i].role === "owner" && role !== "owner" && s.users.filter((u) => u.role === "owner").length === 1) fail("Keep at least one owner");
  const rec = i >= 0 ? { ...s.users[i], name: name.trim(), role } : { id: nid(s, "u"), name: name.trim(), role };
  if (pin) { rec.salt = salt || Math.random().toString(36).slice(2, 10); rec.pin = pinHash(String(pin), rec.salt); }
  if (s.users.some((u) => u.id !== rec.id && u.pin && rec.pin && pinHash(String(pin), u.salt) === u.pin)) fail("Another user already has this PIN");
  if (i >= 0) s.users[i] = rec; else s.users.push(rec);
  log(s, null, i >= 0 ? "edit user" : "add user", rec.id, `${rec.name} · ${role}`, at);
  return { state: s, id: rec.id };
}
export function removeUser(state, id, { at } = {}) {
  const s = ensure(clone(state)); need("users");
  const u = s.users.find((x) => x.id === id); if (!u) fail("User not found");
  if (u.role === "owner" && s.users.filter((x) => x.role === "owner").length === 1) fail("Keep at least one owner");
  s.users = s.users.filter((x) => x.id !== id);
  log(s, null, "remove user", id, u.name, at);
  return s;
}
/** Which user does this PIN open? (null = none). */
export function userByPin(state, pin) {
  return (state.users || []).find((u) => u.pin && pinHash(String(pin), u.salt) === u.pin) || null;
}

// ---- price lists ---------------------------------------------------------------------------------------------------
export function savePriceList(state, list, { at } = {}) {
  const s = ensure(clone(state)); need("prices");
  const probs = M.checkPriceList(list); if (probs.length) fail(probs[0]);
  const i = list.id ? s.priceLists.findIndex((x) => x.id === list.id) : -1;
  const rec = { ...list, id: i >= 0 ? list.id : nid(s, "l") };
  if (i >= 0) s.priceLists[i] = rec; else s.priceLists.push(rec);
  log(s, null, i >= 0 ? "edit price list" : "add price list", rec.id, `${rec.name} · ${rec.group}`, at);
  return { state: s, id: rec.id };
}
export const priceOf = (s, q) => M.priceFor({ lists: s.priceLists || [], items: s.items, customers: s.customers }, q);

// ---- exchange rates ------------------------------------------------------------------------------------------------
export function setRate(state, { currency, date, rate }, { at } = {}) {
  const s = ensure(clone(state)); need("post");
  if (!M.CURRENCIES[currency] || currency === M.BASE) fail("Choose a currency");
  if (!date) fail("Choose a date");
  const r5 = typeof rate === "number" && Number.isInteger(rate) ? rate : M.toRate5(rate);
  if (!r5) fail("Enter the rate (EGP for 1 unit)");
  s.fxRates = s.fxRates.filter((x) => !(x.currency === currency && x.date === date));
  s.fxRates.push({ currency, date, rate: r5 });
  s.fxRates.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.currency < b.currency ? -1 : 1));
  log(s, null, "exchange rate", currency, `${date} ${M.rateText(r5)}`, at);
  return s;
}

/** What is still open on a foreign-currency invoice, in its currency and in EGP. */
export function fxOpen(s, number) {
  const inv = s.docs.find((d) => d.number === number);
  if (!inv) return null;
  const T = M.fxTotals(inv, s.tax);
  let paidFx = 0, paidEGP = 0;
  for (const p of s.payments) for (const a of p.allocations || []) if (a.doc === number) { paidEGP += a.amount + (a.wht || 0); paidFx += a.amountFx != null ? a.amountFx : 0; }
  return { number, currency: T.currency, totalFx: T.own.total, totalEGP: T.egp.total, openFx: T.own.total - paidFx, openEGP: T.egp.total - paidEGP };
}
/** Money received in a foreign currency against foreign invoices. Each allocation clears the invoice at the INVOICE'S
    rate; the cash is booked at TODAY'S rate; the difference is a realised exchange gain or loss (account 4200).
    The last payment that settles an invoice in full clears exactly what is left in EGP (no stray piastres).          */
export function receiveFx(state, { customer, date, method = "bank", currency, rate, amountFx, allocations }, { user, at } = {}) {
  need("post");
  const s = ensure(clone(state));
  if (!s.customers.find((c) => c.id === customer)) fail("Choose a customer");
  if (!date) fail("Choose a date");
  if (!M.CURRENCIES[currency] || currency === M.BASE) fail("Choose the currency received");
  const r5 = rate || M.rateOn(s.fxRates, currency, date);
  if (!r5) fail(`No ${currency} rate on or before ${date} — add it in Settings → Currencies`);
  if (!(amountFx > 0) || !Number.isInteger(amountFx)) fail("Enter the amount received");
  let allocs = allocations;
  const opens = s.docs.filter((d) => d.type === "invoice" && d.status === "posted" && d.customer === customer && d.fx && d.fx.currency === currency).map((d) => ({ ...fxOpen(s, d.number), due: d.due, rate: d.fx.rate })).filter((o) => o.openFx > 0);
  if (!allocs) { let left = amountFx; allocs = []; for (const o of opens.sort((a, b) => (a.due < b.due ? -1 : 1))) { if (left <= 0) break; const take = Math.min(left, o.openFx); allocs.push({ doc: o.number, amountFx: take }); left -= take; } }
  let cleared = 0;
  const out = [];
  for (const a of allocs) {
    const o = opens.find((x) => x.number === a.doc);
    if (!o) fail("Invoice " + a.doc + ` is not an open ${currency} invoice for this customer`);
    if (a.amountFx > o.openFx) fail(`Invoice ${a.doc}: only ${B.fmt(o.openFx)} ${currency} is still open`);
    const egp = a.amountFx === o.openFx ? o.openEGP : M.toEGP(a.amountFx, o.rate);
    cleared += egp; out.push({ doc: a.doc, amount: egp, wht: 0, amountFx: a.amountFx });
  }
  const usedFx = out.reduce((x, a) => x + a.amountFx, 0);
  if (usedFx !== amountFx) fail("Allocate the whole amount to invoices in the same currency");
  const received = M.toEGP(amountFx, r5);
  const gain = received - cleared;
  const p = { id: nid(s, "p"), number: B.nextNumber(B.SERIES.payment, year(date), s.payments), date, customer, method, amount: received, allocations: out, fx: { currency, rate: r5, amountFx }, fxGain: gain };
  s.payments.push(p);
  s.journal.push(B.entry(date, p.number, [
    { account: method === "bank" ? "1100" : "1000", debit: received }, { account: "4200", debit: gain < 0 ? -gain : 0 },
    { account: "1200", credit: cleared }, { account: "4200", credit: gain > 0 ? gain : 0 },
  ], "Customer receipt (" + currency + ")"));
  log(s, user, "receipt", p.number, `${B.fmt(amountFx)} ${currency} @ ${M.rateText(r5)} = ${B.fmt(received)} EGP (fx ${B.fmt(gain)})`, at);
  return { state: s, number: p.number, received, cleared, gain };
}

// ---- delivery notes ------------------------------------------------------------------------------------------------
/** What is still to deliver from an order or an invoice, item by item (ordered − already delivered on posted notes). */
export function toDeliver(s, docId) {
  const d = s.docs.find((x) => x.id === docId);
  if (!d || d.status !== "posted" || !(d.type === "invoice" || d.type === "order")) fail("A delivery note needs a posted order or invoice");
  const left = [];
  (d.lines || []).forEach((l, i) => {
    if (!l.item) return;
    const sent = (s.deliveries || []).filter((n) => n.status === "posted" && n.source === d.number).reduce((a, n) => a + n.lines.filter((x) => x.line === i).reduce((y, x) => y + Math.round(Number(x.qty) * 1000), 0), 0);
    const q = Math.round(Number(l.qty) * 1000) - sent;
    left.push({ line: i, item: l.item, desc: l.desc || "", ordered: Number(l.qty), delivered: sent / 1000, left: q / 1000 });
  });
  return { doc: d, left };
}
/** Post a delivery note (lines: [{ line, qty }]; partial deliveries allowed). Stock moves exactly once:
    from an INVOICE the goods already left stock when it was posted, so the note only records the delivery;
    from an ORDER the goods leave stock now at the moving-average cost (Dr cost of goods, Cr inventory), and the
    invoice made later from the order is marked "delivered" so it does not move them again. */
export function postDelivery(state, { docId, date, lines, driver = "", notes = "" }, { user, at } = {}) {
  need("post");
  const s = ensure(clone(state));
  const { doc, left } = toDeliver(s, docId);
  if (!date) fail("Choose a date");
  const use = (lines || []).filter((l) => Number(l.qty) > 0);
  if (!use.length) fail("Enter a quantity to deliver");
  for (const l of use) {
    const r = left.find((x) => x.line === l.line);
    if (!r) fail("That line has no item to deliver");
    if (Math.round(Number(l.qty) * 1000) > Math.round(r.left * 1000)) fail(`Only ${r.left} left to deliver on line ${l.line + 1}`);
  }
  const number = B.nextNumber(B.SERIES.delivery, year(date), s.deliveries.filter((n) => n.status === "posted"));
  const note = { id: nid(s, "n"), number, date, status: "posted", source: doc.number, sourceType: doc.type, customer: doc.customer, driver, notes,
    lines: use.map((l) => ({ line: l.line, item: doc.lines[l.line].item, desc: doc.lines[l.line].desc || "", qty: Number(l.qty) })) };
  if (doc.type === "order") {
    let cogs = 0;
    for (const l of note.lines) {
      const it = s.items.find((x) => x.id === l.item);
      if (!it || it.track === false) continue;
      const c = B.cogsFor(levels(s), it.id, l.qty); cogs += c;
      s.stock.push({ id: nid(s, "m"), date, item: it.id, qty: -l.qty, cost: 0, ref: number, kind: "delivery", costOut: c });
    }
    if (cogs) s.journal.push(B.entry(date, number, [{ account: "5000", debit: cogs }, { account: "1300", credit: cogs }], "Delivery note"));
    note.cogs = cogs;
  }
  s.deliveries.push(note);
  log(s, user, "delivery", number, `${doc.number} · ${note.lines.length} line(s)`, at);
  return { state: s, number, id: note.id };
}
/** A draft invoice for what was delivered from an order (lines marked delivered: stock already moved). */
export function invoiceFromOrder(state, orderId, date) {
  const o = state.docs.find((x) => x.id === orderId);
  if (!o || o.type !== "order" || o.status !== "posted") fail("Not a posted order");
  const sent = (state.deliveries || []).filter((n) => n.status === "posted" && n.source === o.number);
  const lines = o.lines.map((l, i) => {
    const q = sent.reduce((a, n) => a + n.lines.filter((x) => x.line === i).reduce((y, x) => y + x.qty, 0), 0);
    return { ...clone(l), qty: l.item ? q : l.qty, delivered: !!l.item };
  }).filter((l) => Number(l.qty) !== 0);
  return { type: "invoice", customer: o.customer, date, from: o.number, lines, notes: o.notes || "", ...(o.fx ? { fx: o.fx } : {}) };
}
export const whoAmI = () => getActor();
