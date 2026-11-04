// v7.9 (Ali: "invoices should be transferred to business — copy them into a proper place in business"): Money's (Yusr's) invoices
// become posted Books invoices with their customers and payments; nothing is taken out of Yusr; running it twice copies nothing twice.
import { invoicesToBooks, yusrTotal } from "../../web-src/yusr-to-books.js";
import * as O from "../../web-src/books-ops.js";
import * as B from "../../web-src/books.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const ledger = { currency: "EGP", accounts: [{ id: "a1", currency: "EGP" }, { id: "a2", currency: "USD" }], invoices: [
  { id: "i1", num: 1, client: "Nile Bakery", phone: "01001234567", account: "a1", date: "2026-09-02", taxPct: 14, discount: 0, items: [{ name: "Crane hire — 1 day", qty: 1, price: 4500 }], payments: [] },
  { id: "i2", num: 2, client: "nile bakery ", account: "a1", date: "2026-09-10", taxPct: 14, discount: 100, items: [{ name: "Transport", qty: 2, price: 750 }, { name: "Operator", qty: 1, price: 500 }], payments: [{ id: "p1", amount: 1000, date: "2026-09-15" }] },
  { id: "i3", num: 3, client: "Ahmed Saeed", account: "a1", date: "2026-10-01", taxPct: 0, discount: 0, items: [{ name: "Consulting", qty: 3, price: 1200 }], payments: [{ id: "p2", amount: 3600, date: "2026-10-05" }] },
  { id: "i4", num: 4, client: "Gulf Co", account: "a2", date: "2026-10-03", taxPct: 0, items: [{ name: "Parts", qty: 1, price: 300 }], payments: [] },
  { id: "i5", num: 5, client: "Empty", account: "a1", date: "2026-10-04", items: [{ name: "", qty: 1, price: 0 }], payments: [] },
  { id: "i6", num: 6, client: "Sara", account: "a1", date: "2026-10-06", taxPct: 5, items: [{ name: "Design", qty: 1, price: 2000 }], payments: [] }] };
const r = invoicesToBooks(O.EMPTY(), ledger, { at: "2026-10-24T10:00:00.000Z" });
const s = r.state;
ok(r.moved.length === 4 && r.skipped.length === 2, "4 invoices copied; 2 left in Money: " + JSON.stringify(r.skipped));
ok(r.skipped.some((x) => x.num === 4 && x.why === "currency") && r.skipped.some((x) => x.num === 5 && x.why === "empty"), "…a USD invoice (the books are EGP) and an empty one are reported, never guessed");
ok(s.customers.length === 3 && s.customers.find((c) => c.name === "Nile Bakery").phone === "01001234567", "one customer per client (\"nile bakery \" is Nile Bakery), with the phone");
ok(s.docs.every((d) => d.type === "invoice" && d.status === "posted" && /^INV-/.test(d.number) && /^Yusr #\d/.test(d.ref)), "each is a posted Books invoice with its number, marked \"Yusr #n\"");
ok(r.moved.every((m) => Math.abs(m.total - m.was) <= 2), "every total is the same as in Money: " + JSON.stringify(r.moved.map((m) => [m.num, m.was, m.total])));
const open = (n) => B.outstanding(s.docs.filter((d) => d.ref === "Yusr #" + n), s.payments, [], s.tax).reduce((a, o) => a + o.open, 0);
ok(open(1) === 513000 && open(2) === yusrTotal(ledger.invoices[1]).total * 100 - 100000 && open(3) === 0, "unpaid stays owed, part-paid owes the rest, paid owes nothing: " + [open(1), open(2), open(3)]);
ok(s.payments.length === 2 && s.journal.length >= 6, "the payments are receipts, and everything is in the journal");
ok(s.tax.vatCodes.Y5 && s.tax.vatCodes.Y5.bp === 500 && s.docs.find((d) => d.ref === "Yusr #6").lines[0].vat === "Y5", "a 5% tax becomes its own VAT code");
ok(O.verifyAudit(s).ok !== false, "the audit chain is intact");
const again = invoicesToBooks(s, ledger, { at: "2026-10-24T11:00:00.000Z" });
ok(again.moved.length === 0 && again.state.docs.length === 4, "running it again copies nothing twice");
ok(ledger.invoices.length === 6, "Yusr keeps its invoices (nothing taken out)");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
