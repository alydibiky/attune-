/* ---- v6.44 Shop in depth (Ali: "every business system on the app to have depth") ----------------------------------------
   On top of shop.js and Books — every money change still goes through Books' own operations or a balanced entry:
   1. Returns at the counter (مرتجع): pick the receipt, the items and how many come back → a posted credit note (stock back
      when they can be sold again) and the money handed back (cash / card / wallet) as a refund that balances the ledger.
   2. Offers (العروض): % off items or a category, "buy 2 get 1", a happy hour (days of the week + hours), each with dates;
      the cart's shelf prices are adjusted before the sale, and the receipt lists what was saved.
   3. Loyalty points (نقاط الولاء): points earned on paid sales, redeemed as a discount on a later sale; per customer.
   4. Held carts (تعليق الفاتورة): a cart parked while the next customer pays, picked up again later.
   5. Reports: sales by hour of the day, by cashier, returns of the period.
   Pure. Tests: tests/unit/v744shoppro.test.mjs.                                                                          */
import * as B from "./books.js";
import * as Ops from "./books-ops.js";
import * as S from "./shop.js";

const clone = (x) => JSON.parse(JSON.stringify(x));
const fail = (m) => { throw new Ops.BooksError(m); };
const cashAcc = (m) => (m === "bank" || m === "card" || m === "wallet" ? "1100" : "1000");

// ---- 1. returns -------------------------------------------------------------------------------------------------------------
/** What can still come back from a receipt: per item, sold − already returned. */
export function returnable(books, number) {
  const inv = books.docs.find((d) => d.type === "invoice" && d.status === "posted" && d.number === number); if (!inv) return null;
  const back = {};
  for (const c of books.docs.filter((d) => d.type === "credit" && d.status === "posted" && d.against === number)) for (const l of c.lines) if (l.item) back[l.item] = (back[l.item] || 0) + Math.abs(Number(l.qty));
  // one item can sit on two lines (the shelf-price split in shop.js cartLines) — counted together
  const by = new Map();
  for (const l of inv.lines.filter((x) => x.item)) { const r = by.get(l.item) || { item: l.item, name: l.desc, sold: 0 }; r.sold += Number(l.qty); by.set(l.item, r); }
  return [...by.values()].map((r) => ({ ...r, back: back[r.item] || 0, left: r.sold - (back[r.item] || 0) }));
}
/** A return: items: [{ item, qty }]; restock: they go back on the shelf; refund: how the money goes back ("credit" = kept on
    the customer's account). → { state, number (credit note), refund } */
export function returnSale(books, { number, items, restock = true, refund = "cash", reason = "", today, at }) {
  const inv = books.docs.find((d) => d.type === "invoice" && d.status === "posted" && d.number === number);
  if (!inv) fail("Find the receipt first");
  const can = returnable(books, number);
  const lines = [];
  for (const x of items || []) {
    const r = can.find((c) => c.item === x.item); const q = Number(x.qty);
    if (!r || !(q > 0)) continue;
    if (q > r.left) fail(`${r.name}: only ${r.left} can come back`);
    // the units come back from the item's lines in order (the split last unit last)
    let need = q;
    for (const src of inv.lines.filter((l) => l.item === x.item)) { if (need <= 0) break; const take = Math.min(need, Number(src.qty)); lines.push({ ...src, qty: take }); need -= take; }
  }
  if (!lines.length) fail("Choose what comes back");
  const date = today || new Date().toISOString().slice(0, 10);
  let s = books;
  const draft = Ops.creditNoteFor(s, inv.id, { lines, restock, date, reason });
  const d = Ops.saveDraft(s, draft, { at }); s = d.state;
  const p = Ops.post(s, d.id, { at, today: date }); s = clone(p.state);
  const amount = Math.abs(B.docTotals(s.docs.find((x) => x.id === d.id), s.tax).total);
  // the money handed back: the receivable the credit note lowered is paid out (a negative receipt against the invoice)
  const paid = B.outstanding([inv], s.payments, [], s.tax)[0].paid;
  const out = refund === "credit" ? 0 : Math.min(amount, paid);
  if (out > 0) {
    const ref = "RF-" + p.number;
    s.payments.push({ id: Ops.nid(s, "p"), number: ref, date, customer: inv.customer, method: refund, amount: -out, allocations: [{ doc: inv.number, amount: -out }], refund: true, ref: p.number });
    s.journal.push(B.entry(date, ref, [{ account: "1200", debit: out }, { account: cashAcc(refund), credit: out }], "Refund at the counter"));
    Ops.log(s, null, "refund", ref, B.fmt(out), at);
  }
  return { state: s, number: p.number, refund: out, amount };
}

// ---- 2. offers ----------------------------------------------------------------------------------------------------------------
/** offer: { id, name, kind: "pct" | "bxgy", pct, buy, get, items: [ids] (empty = everything), category, from, to,
    days: [0–6] (empty = every day), hours: [from, to] (empty = all day), on } */
export function offerActive(o, now = new Date()) {
  if (o.on === false) return false;
  const day = now.toISOString().slice(0, 10);
  if (o.from && day < o.from) return false;
  if (o.to && day > o.to) return false;
  if (o.days && o.days.length && !o.days.includes(now.getDay())) return false;
  if (o.hours && o.hours.length === 2) { const h = now.getHours() + now.getMinutes() / 60; if (h < o.hours[0] || h >= o.hours[1]) return false; }
  return true;
}
const covers = (o, it) => (!o.items || !o.items.length || o.items.includes(it.id)) && (!o.category || it.category === o.category);
/** The cart with the offers in force: each line's shelf price lowered (pct) or free units priced in (buy X get Y), the best
    single offer per line. → { cart, saved, applied: [{ name, item, saved }] } */
export function applyOffers(books, cart, offers, now = new Date()) {
  const act = (offers || []).filter((o) => offerActive(o, now));
  let saved = 0; const applied = [];
  const out = cart.map((c) => {
    const it = books.items.find((x) => x.id === c.item); if (!it) return c;
    const shelf = Math.round(Number(c.price ?? it.price) || 0), qty = Number(c.qty) || 0;
    let best = null;
    for (const o of act) {
      if (!covers(o, it)) continue;
      let off = 0;
      if (o.kind === "pct" && o.pct > 0) off = B.roundHalfAway((shelf * qty * Math.min(100, o.pct)) / 100);
      if (o.kind === "bxgy" && o.buy > 0 && o.get > 0 && Number.isInteger(qty)) off = Math.floor(qty / (o.buy + o.get)) * o.get * shelf;
      if (off > 0 && (!best || off > best.off)) best = { o, off };
    }
    if (!best || !qty) return c;
    saved += best.off; applied.push({ name: best.o.name, item: it.id, saved: best.off });
    return { ...c, price: Math.round((shelf * qty - best.off) / qty), was: shelf, offer: best.o.id };
  });
  return { cart: out, saved, applied };
}

// ---- 3. loyalty ------------------------------------------------------------------------------------------------------------------
export const LOYALTY_DEFAULT = { on: false, every: 1000, value: 10 };   // 1 point per 10.00 paid; a point is worth 0.10
/** Points of a customer: earned on every paid sale (cash / card / wallet) since loyalty started, minus what was redeemed. */
export function points(books, shop, customer) {
  const L = { ...LOYALTY_DEFAULT, ...(shop && shop.loyalty) };
  if (!L.on || !customer) return 0;
  const since = L.since || "";
  const paid = books.payments.filter((p) => p.customer === customer && !p.refund && p.amount > 0 && (!since || p.date >= since)).reduce((n, p) => n + p.amount, 0);
  const refunded = books.payments.filter((p) => p.customer === customer && p.refund && (!since || p.date >= since)).reduce((n, p) => n - p.amount, 0);
  const used = ((shop.redeemed || {})[customer] || 0);
  return Math.max(0, Math.floor((paid - refunded) / L.every) - used);
}
/** Redeem points on a cart: the discount (minor) as a % of the cart (Books' discount on every line), capped at the cart. */
export function redeem(books, shop, customer, cart, want, { taxInclusive = true } = {}) {
  const L = { ...LOYALTY_DEFAULT, ...(shop && shop.loyalty) };
  const have = points(books, shop, customer), n = Math.min(have, Math.max(0, Math.floor(want)));
  const total = S.cartLines(books, cart, { taxInclusive }).total;
  if (!n || !total) return { points: 0, discount: 0, discountBp: 0 };
  const discount = Math.min(total, n * L.value), bp = Math.min(10000, Math.round((discount * 10000) / total));
  return { points: Math.ceil((B.roundHalfAway((total * bp) / 10000)) / L.value), discount: B.roundHalfAway((total * bp) / 10000), discountBp: bp };
}
export const useRedeemed = (shop, customer, n) => ({ ...shop, redeemed: { ...(shop.redeemed || {}), [customer]: ((shop.redeemed || {})[customer] || 0) + n } });

// ---- 4. held carts --------------------------------------------------------------------------------------------------------------
export const holdCart = (shop, { cart, customer = "", note = "" }, now = Date.now()) => ({ ...shop, held: [...(shop.held || []), { id: "h" + now.toString(36), at: now, cart, customer, note }].slice(-20) });
export const takeHeld = (shop, id) => { const h = (shop.held || []).find((x) => x.id === id); return { shop: { ...shop, held: (shop.held || []).filter((x) => x.id !== id) }, held: h || null }; };

// ---- 5. reports --------------------------------------------------------------------------------------------------------------------
/** Sales by hour of the day (posted counter invoices, by the time they were posted), from–to dates. */
export function salesByHour(books, from, to) {
  const h = new Array(24).fill(0), n = new Array(24).fill(0);
  for (const d of books.docs) {
    if (d.type !== "invoice" || d.status !== "posted" || (from && d.date < from) || (to && d.date > to) || !d.postedAt) continue;
    const hr = new Date(d.postedAt).getHours(); h[hr] += B.docTotals(d, books.tax).total; n[hr]++;
  }
  return h.map((v, i) => ({ hour: i, total: v, count: n[i] }));
}
/** Sales by cashier (the name on each counter sale), from–to. */
export function salesByCashier(books, from, to) {
  const by = {};
  for (const d of books.docs) {
    if (d.type !== "invoice" || d.status !== "posted" || (from && d.date < from) || (to && d.date > to)) continue;
    const k = d.cashier || "—"; by[k] = by[k] || { cashier: k, total: 0, count: 0 }; by[k].total += B.docTotals(d, books.tax).total; by[k].count++;
  }
  return Object.values(by).sort((a, b) => b.total - a.total);
}
/** Returns of a period: credit notes against counter sales, with the refunds paid. */
export function returnsOf(books, from, to) {
  return books.docs.filter((d) => d.type === "credit" && d.status === "posted" && (!from || d.date >= from) && (!to || d.date <= to)).map((d) => ({
    number: d.number, against: d.against, date: d.date, total: Math.abs(B.docTotals(d, books.tax).total), reason: d.notes || "",
    refunded: -books.payments.filter((p) => p.refund && p.ref === d.number).reduce((n, p) => n + p.amount, 0) }));
}
