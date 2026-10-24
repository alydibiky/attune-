/* ---- v7.9 (Ali, 24 Oct 2026: "invoices should be transferred to business — copy them into a proper place in business") -------
   Money (Yusr) kept simple invoices: items (name, qty, price), a discount, a tax %, the client's name and phone, and payments.
   They are copied into Business → Books as real Books documents: each client a customer (matched by name, else added), each
   invoice a POSTED invoice (same date and lines, prices in piastres, the tax % as a VAT code, the discount on its lines, "Yusr #12"
   on it), and each payment a receipt against it — so paid / part-paid / unpaid carries over and Books' reports count them.
   Pure (state in → state out). Nothing is taken out of Yusr; an invoice copied before is skipped, so it can run again safely.
   An invoice in another currency than the books', or with no lines, is reported and left in Money (never guessed).
   Tests: tests/unit/v900invoices.test.mjs.                                                                                      */
import * as B from "./books.js";
import * as O from "./books-ops.js";

const r2 = (x) => Math.round((Number(x) || 0) * 100);
const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
/** Yusr's own total for an invoice (its invoiceTotal): lines − discount, then the tax % on that. */
export function yusrTotal(inv) {
  const sub = (inv.items || []).reduce((a, it) => a + (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0), 0);
  const ad = Math.max(sub - (parseFloat(inv.discount) || 0), 0);
  return { sub, total: ad + ad * ((parseFloat(inv.taxPct) || 0) / 100) };
}
/** The VAT code for a tax % — 14 % standard, 0 zero-rated, any other rate its own code (added to the books' tax list). */
function vatCode(s, pct) {
  const p = Math.round((Number(pct) || 0) * 100) / 100;
  if (p === 0) return "Z";
  const bp = Math.round(p * 100);
  const hit = Object.entries((s.tax && s.tax.vatCodes) || {}).find(([, c]) => !c.exempt && c.bp === bp);
  if (hit) return hit[0];
  const k = "Y" + String(p).replace(".", "_");
  s.tax = { ...s.tax, vatCodes: { ...s.tax.vatCodes, [k]: { label: `${p}% (from Money) · ${p}٪ (من الفلوس)`, bp } } };
  return k;
}

/** books (a Books state), ledger (Yusr's) → { state, moved: [{ num, number, total, paid }], skipped: [{ num, why }] } */
export function invoicesToBooks(books, ledger, { at } = {}) {
  let s = JSON.parse(JSON.stringify(books || O.EMPTY()));
  const moved = [], skipped = [];
  const done = new Set((s.docs || []).map((d) => d.from).filter(Boolean));
  const accCur = (id) => (((ledger && ledger.accounts) || []).find((a) => a.id === id) || {}).currency;
  for (const inv of ((ledger && ledger.invoices) || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)) || (a.num || 0) - (b.num || 0))) {
    const from = "yusr:" + inv.id, num = inv.num;
    if (!inv || !inv.id || done.has(from)) continue;
    const cur = accCur(inv.account) || (ledger && ledger.currency) || s.currency;
    if (cur && s.currency && cur !== s.currency) { skipped.push({ num, why: "currency", cur }); continue; }
    const items = (inv.items || []).filter((it) => String(it.name || "").trim() && (parseFloat(it.qty) || 0) > 0);
    if (!items.length) { skipped.push({ num, why: "empty" }); continue; }
    const { sub, total } = yusrTotal({ ...inv, items });
    const discBp = sub > 0 ? Math.round(((parseFloat(inv.discount) || 0) / sub) * 10000) : 0;
    const vat = vatCode(s, inv.taxPct);
    // the customer: the same name in the books, else a new one with the phone Yusr had
    const name = String(inv.client || "").trim() || "Customer";
    let cust = s.customers.find((c) => norm(c.name) === norm(name));
    if (!cust) { const u = O.upsert(s, "customers", { name, phone: inv.phone || "", from: "yusr" }, { at }); s = u.state; cust = s.customers.find((c) => c.id === u.id); }
    const date = /^\d{4}-\d{2}-\d{2}$/.test(inv.date || "") ? inv.date : new Date().toISOString().slice(0, 10);
    const lines = items.map((it) => ({ desc: String(it.name).slice(0, 120), qty: parseFloat(it.qty) || 1, price: r2(it.price), vat, ...(discBp ? { discBp } : {}) }));
    const d = O.saveDraft(s, { type: "invoice", customer: cust.id, date, lines, ref: "Yusr #" + (num != null ? num : ""), notes: inv.trade ? String(inv.trade).slice(0, 200) : "", from }, { at });
    const p = O.post(d.state, d.id, { at, today: date });
    s = p.state;
    const doc = s.docs.find((x) => x.id === d.id), bt = B.docTotals(doc, s.tax).total;
    // the payments, as receipts against this invoice (never more than is still open on it)
    let paid = 0;
    for (const pay of (inv.payments || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
      const open = B.outstanding([doc], s.payments.filter((x) => (x.allocations || []).some((a) => a.doc === doc.number)), [], s.tax).reduce((a, o) => a + o.open, 0);
      const amount = Math.min(r2(pay.amount), open);
      if (!(amount > 0)) continue;
      const rc = O.receive(s, { customer: cust.id, date: /^\d{4}-\d{2}-\d{2}$/.test(pay.date || "") ? pay.date : date, method: "cash", amount, allocations: [{ doc: doc.number, amount }], ref: "Yusr #" + (num != null ? num : "") }, { at });
      s = rc.state; paid += amount;
    }
    moved.push({ num, number: doc.number, customer: cust.name, total: bt, was: r2(total), paid });
  }
  return { state: s, moved, skipped };
}
