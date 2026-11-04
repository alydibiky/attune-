// A whole small shop through the books: sell, get paid with withholding, buy stock, credit note, audit chain.
import * as O from "../../web-src/books-ops.js";
import * as B from "../../web-src/books.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }
function throws(fn, what, part) { try { fn(); console.log("FAIL " + what + " (no error)"); fails.push(what); } catch (e) { const ok = !part || String(e.message).includes(part); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : " → " + e.message)); if (!ok) fails.push(what); } }
const E = (n) => Math.round(n * 100);
const AT = "2026-09-01T09:00:00.000Z";

let s = O.EMPTY();
let r = O.upsert(s, "customers", { name: "Acme Trading", creditLimit: E(5000) }, { at: AT }); s = r.state; const acme = r.id;
r = O.upsert(s, "suppliers", { name: "Delta Supplies" }, { at: AT }); s = r.state; const delta = r.id;
r = O.upsert(s, "items", { name: "Bolts box", price: E(100), reorder: 20, vat: "S" }, { at: AT }); s = r.state; const bolts = r.id;
throws(() => O.upsert(s, "customers", { name: "  " }), "a customer needs a name", "name");

// buy 30 boxes at 60.00 + 14% VAT
r = O.saveDraft(s, { type: "bill", supplier: delta, date: "2026-09-02", lines: [{ item: bolts, qty: 30, price: E(60), vat: "S" }] }, { at: AT }); s = r.state;
r = O.postBill(s, r.id, { at: AT }); s = r.state;
eq([r.number, O.levels(s)[bolts].qty, O.levels(s)[bolts].value], ["BILL-2026-00001", 30, E(1800)], "a bill brings 30 boxes into stock worth 1,800");
eq(B.trialBalance(s.journal).balanced, true, "the ledger balances after a bill");
eq(O.billsOpen(s)[0].open, E(2052), "we owe the supplier 2,052 (1,800 + 252 VAT)");

// sell 10 boxes at 100 + VAT with 3% withholding, to Acme
r = O.saveDraft(s, { type: "invoice", customer: acme, date: "2026-09-05", lines: [{ item: bolts, qty: 10, price: E(100), vat: "S", wht: "supplies" }] }, { at: AT }); s = r.state;
const invId = r.id;
r = O.post(s, invId, { at: AT }); s = r.state;
eq([r.number, r.warnings], ["INV-2026-00001", []], "posting numbers the invoice");
const inv = s.docs.find((d) => d.id === invId);
eq([inv.status, inv.due], ["posted", "2026-10-05"], "posted, due after the 30-day credit period");
eq([O.levels(s)[bolts].qty, O.levels(s)[bolts].value], [20, E(1200)], "10 boxes left at cost 60 → 20 boxes worth 1,200");
const pl = B.profitAndLoss(s.journal, "2026-09-01", "2026-09-30");
eq([pl.sales, pl.cogs, pl.grossProfit], [E(1000), E(600), E(400)], "gross profit 1,000 − 600 = 400");
throws(() => O.saveDraft(s, { ...inv, notes: "x" }), "a posted invoice cannot be edited", "credit note");
throws(() => O.deleteDraft(s, invId), "a posted invoice cannot be deleted", "credit note");
throws(() => O.post(s, invId), "posting twice is refused", "already");

// Acme pays 1,130: 1,140 invoice − 10 (1% of 1,000) withheld
r = O.receive(s, { customer: acme, date: "2026-09-20", method: "bank", amount: E(1130), allocations: [{ doc: "INV-2026-00001", amount: E(1130), wht: E(10) }] }, { at: AT }); s = r.state;
eq([r.number, r.onAccount, O.openInvoices(s, "2026-09-30")[0].open], ["RCT-2026-00001", 0, 0], "receipt with withholding settles the invoice");
eq(B.cashPosition(s.journal).total, E(1130), "bank has the cash received");
r = O.receive(s, { customer: acme, date: "2026-09-21", amount: E(50) }, { at: AT });
eq(r.onAccount, E(50), "money with nothing to settle stays on account (a customer deposit)");
s = r.state;
throws(() => O.receive(s, { customer: acme, date: "2026-09-22", amount: E(10), allocations: [{ doc: "INV-2026-00001", amount: E(10) }] }), "cannot allocate to a settled invoice", "still open");

// a second invoice: not enough stock → a warning, still posted; credit limit warning
r = O.saveDraft(s, { type: "invoice", customer: acme, date: "2026-09-25", lines: [{ item: bolts, qty: 25, price: E(300), vat: "S" }] }, { at: AT }); s = r.state;
r = O.post(s, r.id, { at: AT }); s = r.state;
eq(r.number, "INV-2026-00002", "numbers are gapless");
eq(r.warnings.length, 2, "a warning for too little stock and one for the credit limit");
eq(O.levels(s)[bolts].qty, -5, "stock goes to −5 (sold more than we had: visible, not hidden)");

// credit note for 5 boxes of the first invoice, back to stock
const inv1 = s.docs.find((d) => d.number === "INV-2026-00001");
let cn = O.creditNoteFor(s, inv1.id, { lines: [{ ...inv1.lines[0], qty: 5 }], restock: true, date: "2026-09-26", reason: "returned" });
eq([cn.type, cn.lines[0].qty, cn.against], ["credit", -5, "INV-2026-00001"], "a credit note is drafted with negative quantities");
r = O.saveDraft(s, cn, { at: AT }); s = r.state; r = O.post(s, r.id, { at: AT }); s = r.state;
eq(r.number, "CN-2026-00001", "credit note numbered in its own series");
eq(B.trialBalance(s.journal).balanced, true, "the ledger still balances after the credit note");
eq(O.openInvoices(s, "2026-09-30").find((o) => o.number === "INV-2026-00001").credited, E(570), "the credit note (5 × 100 + 14%) is credited against the invoice");

// supplier payment, expense, adjustment
r = O.paySupplier(s, { supplier: delta, date: "2026-09-27", method: "cash", amount: E(1000) }, { at: AT }); s = r.state;
eq(O.billsOpen(s)[0].open, E(1052), "paid 1,000 of 2,052 → 1,052 still owed");
r = O.addExpense(s, { date: "2026-09-28", category: "Rent", amount: E(300), method: "cash" }, { at: AT }); s = r.state;
eq(r.number, "EXP-2026-00001", "expense numbered");
s = O.adjustStock(s, { item: bolts, date: "2026-09-29", qty: -2, reason: "damaged" }, { at: AT });
eq(B.trialBalance(s.journal).balanced, true, "ledger balances after payment, expense and stock loss");

// a quote becomes an invoice
r = O.saveDraft(s, { type: "quote", customer: acme, date: "2026-10-01", lines: [{ item: bolts, qty: 2, price: E(100), vat: "S" }] }, { at: AT }); s = r.state;
r = O.post(s, r.id, { at: AT }); s = r.state;
eq(r.number, "QUO-2026-00001", "a quote is numbered but writes no ledger entry");
const q = s.docs.find((d) => d.number === "QUO-2026-00001");
const jlen = s.journal.length;
const di = O.invoiceFromQuote(s, q.id, "2026-10-02");
eq([di.type, di.from, di.lines.length], ["invoice", "QUO-2026-00001", 1], "invoice drafted from the quote");
eq(s.journal.length, jlen, "…and the quote added nothing to the ledger");

// the dashboard
const dash = O.dashboard(s, "2026-10-02");
eq(dash.cash.total, E(1130) + E(50) - E(1000) - E(300), "dashboard cash = receipts − payments − expenses");
eq([dash.overdueCount, O.dashboard(s, "2026-11-05").overdueCount], [0, 1], "an invoice is counted overdue only after its due date (INV-2 is due 2026-10-25)");
eq(dash.low.map((x) => x.id), [bolts], "low-stock alert (below the reorder level)");
eq(Object.keys(dash.vat).sort(), ["input", "output", "payable", "purchasesBase", "salesBase"], "the VAT return figures are on the dashboard");

// the audit chain
eq(O.verifyAudit(s).ok, true, "the audit log verifies");
const t = JSON.parse(JSON.stringify(s)); t.audit[3].detail = "tampered";
eq(O.verifyAudit(t).brokenAt, 4, "changing an old entry is detected, at that entry");
const t2 = JSON.parse(JSON.stringify(s)); t2.audit.splice(2, 1);
eq(O.verifyAudit(t2).ok, false, "removing an entry is detected");

if (fails.length) { console.log(`\n${fails.length} FAILED`); process.exit(1); } else console.log("\nALL PASSED");
