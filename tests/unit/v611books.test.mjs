// Golden tests for the Business finance core (web-src/books.js): every figure below was worked out by hand.
import * as B from "../../web-src/books.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }
const E = (n) => Math.round(n * 100);   // EGP → piastres for the test data

// ---- money in and out ----
eq([B.toMinor("1,234.56"), B.toMinor("١٢٣٫٥"), B.toMinor("abc"), B.toMinor("-5"), B.toMinor("0.005")], [123456, 12350, null, -500, 1], "toMinor: commas, Arabic digits, junk, negative, half rounds away");
eq([B.fmt(123456), B.fmt(-5), B.fmt(100000000, { cur: "EGP" })], ["1,234.56", "-0.05", "1,000,000.00 EGP"], "fmt");

// ---- one line ----
eq(B.lineFigures({ qty: 3, price: E(100), vat: "S" }).total, E(342), "3 × 100.00 + 14% VAT = 342.00");
const r = B.lineFigures({ qty: 3, price: E(3.33), vat: "S" });
eq([r.gross, r.vat, r.total], [999, 140, 1139], "3 × 3.33: VAT 1.3986 rounds to 1.40 (per line)");
eq(B.lineFigures({ qty: 1, price: E(200), discBp: 1000, vat: "S" }).total, E(205.2), "10% discount before VAT: 180.00 + 25.20");
const tt = B.lineFigures({ qty: 1, price: E(100), tableBp: 500, vat: "S" });
eq([tt.tableTax, tt.vatBase, tt.vat, tt.total], [500, 10500, 1470, 11970], "table tax 5% is charged BEFORE VAT (VAT on 105.00)");
const w = B.lineFigures({ qty: 1, price: E(1000), vat: "S", wht: "services" });
eq([w.vat, w.total, w.wht], [14000, 114000, 3000], "withholding 3% is on the net, not on VAT");
eq(B.lineFigures({ qty: 1, price: E(50), vat: "E" }).vat, 0, "exempt: no VAT");
eq(B.lineFigures({ qty: 1, price: 1, discBp: 5000, vat: "Z" }).discount, 1, "0.5 piastre discount rounds half away from zero");
eq(B.lineFigures({ qty: 2.5, price: E(10), vat: "Z" }).net, E(25), "quantities with decimals are exact (2.5 × 10)");

// ---- a document ----
const doc = { type: "invoice", date: "2026-09-10", customer: "Acme", lines: [
  { item: "A", qty: 1, price: E(1000), vat: "S", wht: "services" }, { item: "B", qty: 2, price: E(50), vat: "Z" }, { item: "C", qty: 1, price: E(20), vat: "E" }] };
const t = B.docTotals(doc);
eq([t.net, t.vat, t.total, t.wht, t.cashDue], [E(1120), E(140), E(1260), E(30), E(1230)], "document totals: net, VAT, total, withheld, cash due");
eq(Object.keys(t.byVat).sort(), ["0", "1400"], "VAT is grouped by rate for the return");
eq(B.docTotals({ lines: [] }).total, 0, "an empty document is 0");

// ---- numbering ----
const posted = [{ number: "INV-2026-00007" }, { number: "INV-2026-00003" }, { number: "INV-2025-00099" }, { number: "QUO-2026-00040" }];
eq([B.nextNumber("INV", 2026, posted), B.nextNumber("INV", 2027, posted), B.nextNumber("QUO", 2026, posted), B.nextNumber("CN", 2026, posted)], ["INV-2026-00008", "INV-2027-00001", "QUO-2026-00041", "CN-2026-00001"], "gapless numbering per series per year");

// ---- the ledger ----
const inv = { type: "invoice", number: "INV-2026-00001", date: "2026-09-10", customer: "Acme", lines: [{ qty: 1, price: E(1000), vat: "S" }] };
const je = B.salesEntry(inv, undefined, E(400));
eq(je.lines, [{ account: "1200", debit: E(1140), credit: 0 }, { account: "4000", debit: 0, credit: E(1000) }, { account: "2100", debit: 0, credit: E(140) }, { account: "5000", debit: E(400), credit: 0 }, { account: "1300", debit: 0, credit: E(400) }], "invoice entry: receivable, sales, VAT, and cost of goods");
const cn = { type: "credit", number: "CN-2026-00001", date: "2026-09-12", customer: "Acme", against: "INV-2026-00001", lines: [{ qty: -1, price: E(1000), vat: "S" }] };
const jc = B.salesEntry(cn);
eq([jc.lines.find((l) => l.account === "1200"), jc.lines.find((l) => l.account === "4100")], [{ account: "1200", debit: 0, credit: E(1140) }, { account: "4100", debit: E(1000), credit: 0 }], "a credit note reverses the invoice");
const pay = { number: "RCT-2026-00001", date: "2026-09-20", method: "bank", amount: E(1110), customer: "Acme", allocations: [{ doc: "INV-2026-00002", amount: E(1110), wht: E(30) }] };
const jr = B.receiptEntry(pay);
eq(jr.lines, [{ account: "1100", debit: E(1110), credit: 0 }, { account: "1400", debit: E(30), credit: 0 }, { account: "1200", debit: 0, credit: E(1140) }], "receipt with withholding: bank + tax credit = receivable cleared");
const dep = B.receiptEntry({ number: "R2", date: "2026-09-21", method: "cash", amount: E(500), allocations: [] });
eq(dep.lines.find((l) => l.account === "2300").credit, E(500), "money not allocated stays as a customer deposit");
let threw = false; try { B.entry("2026-01-01", "X", [{ account: "1000", debit: 100 }, { account: "4000", credit: 99 }]); } catch (e) { threw = true; }
eq(threw, true, "an unbalanced entry is refused");

const bill = { type: "bill", number: "BILL-2026-00001", date: "2026-09-05", lines: [{ qty: 10, price: E(80), vat: "S" }] };
const journal = [je, jc, B.billEntry(bill), B.supplierPaymentEntry({ number: "PAY-1", date: "2026-09-25", amount: E(500), method: "cash" }), B.expenseEntry({ date: "2026-09-15", amount: E(100), method: "cash" })];
eq(B.trialBalance(journal).balanced, true, "the trial balance balances");
const pl = B.profitAndLoss([je, B.expenseEntry({ date: "2026-09-15", amount: E(100), method: "cash" })], "2026-09-01", "2026-09-30");
eq([pl.sales, pl.cogs, pl.grossProfit, pl.expenses, pl.netProfit], [E(1000), E(400), E(600), E(100), E(500)], "profit and loss: 1000 − 400 − 100 = 500");
eq(B.cashPosition([B.supplierPaymentEntry({ number: "P", date: "2026-09-25", amount: E(500), method: "cash" }), B.receiptEntry({ number: "R", date: "2026-09-26", method: "bank", amount: E(2000), allocations: [] })]).total, E(1500), "cash position = bank + cash");

// ---- receivables ----
const i1 = { type: "invoice", number: "INV-1", customer: "Acme", date: "2026-08-01", due: "2026-09-01", lines: [{ qty: 1, price: E(1000), vat: "Z" }] };
const i2 = { type: "invoice", number: "INV-2", customer: "Acme", date: "2026-09-15", due: "2026-10-15", lines: [{ qty: 1, price: E(500), vat: "Z" }] };
const p1 = { number: "R1", customer: "Acme", date: "2026-09-10", amount: E(400), allocations: [{ doc: "INV-1", amount: E(400), wht: 0 }] };
const open = B.outstanding([i1, i2], [p1], []);
eq(open.map((o) => o.open), [E(600), E(500)], "outstanding = total − paid");
const ag = B.ageing(open, "2026-10-02");
eq([ag.total.d31_60, ag.total.notDue, ag.grand, ag.overdue], [E(600), E(500), E(1100), E(600)], "ageing: due 09-01 is 31 days late on 10-02 → the 31–60 bucket");
eq(["2026-09-01", "2026-09-02", "2026-10-01", "2026-10-02", "2026-10-31", "2026-11-01", "2026-11-30", "2026-12-01"].map((d) => B.bucketOf("2026-09-01", d)),
  ["notDue", "d1_30", "d1_30", "d31_60", "d31_60", "d61_90", "d61_90", "d90plus"], "ageing boundaries: 0 / 1–30 / 31–60 / 61–90 / 90+ days late");
eq(B.ageing([{ number: "X", customer: "Z", due: "2026-01-01", open: 0 }], "2026-10-02").grand, 0, "a paid invoice is not in the ageing");
const st = B.statement({ customer: "Acme", invoices: [i1, i2], payments: [p1], from: "2026-09-01", to: "2026-09-30" });
eq([st.opening, st.lines.map((l) => [l.ref, l.balance]), st.closing], [E(1000), [["R1", E(600)], ["INV-2", E(1100)]], E(1100)], "statement: opening, running balance, closing");
const al = B.autoAllocate(E(1200), open);
eq([al.allocations, al.onAccount], [[{ doc: "INV-1", amount: E(600), wht: 0 }, { doc: "INV-2", amount: E(500), wht: 0 }], E(100)], "a payment settles the oldest invoice first; the rest stays on account");
eq([B.creditCheck({ limit: E(1000), owed: E(800), newTotal: E(300) }).ok, B.creditCheck({ limit: 0, owed: 5, newTotal: 5 }).ok, B.creditCheck({ limit: E(1000), owed: E(100), newTotal: E(100) }).ok], [false, true, true], "credit limit warning");

// ---- stock ----
const moves = [{ date: "2026-09-01", item: "A", qty: 10, cost: E(1000) }, { date: "2026-09-05", item: "A", qty: 10, cost: E(1200) }, { date: "2026-09-08", item: "A", qty: -5 }];
const lv = B.stockLevels(moves);
eq([lv.A.qty, lv.A.value, lv.A.avgCost], [15, E(1650), E(110)], "moving average: 10@100 + 10@120, sell 5 → 15 left worth 1,650 at 110 each");
eq(B.cogsFor(lv, "A", 3), E(330), "cost of 3 more at the average");
eq(B.stockLevels([{ date: "2026-09-01", item: "B", qty: 3, cost: 100 }, { date: "2026-09-02", item: "B", qty: -1 }, { date: "2026-09-03", item: "B", qty: -1 }, { date: "2026-09-04", item: "B", qty: -1 }]).B.value, 0, "selling everything leaves value 0 (no rounding drift)");
eq(B.lowStock([{ id: "A", name: "Bolts", reorder: 20 }, { id: "Q", name: "Nuts", reorder: 5 }, { id: "R", name: "x" }], lv).map((x) => x.id), ["A", "Q"], "reorder alerts (A has 15 ≤ 20; Q has none)");

// ---- reports ----
const s1 = { type: "invoice", date: "2026-09-10", customer: "Acme", lines: [{ item: "X", qty: 1, price: E(1000), vat: "S" }] };
const s2 = { type: "invoice", date: "2026-09-11", customer: "Beta", lines: [{ item: "X", qty: 2, price: E(100), vat: "S" }, { item: "Y", qty: 1, price: E(50), vat: "S" }] };
const s3 = { type: "credit", date: "2026-09-12", customer: "Acme", lines: [{ item: "X", qty: -1, price: E(100), vat: "S" }] };
eq(B.salesBy([s1, s2, s3], "customer", "2026-09-01", "2026-09-30"), [{ name: "Acme", net: E(900) }, { name: "Beta", net: E(250) }], "sales by customer (credit notes reduce)");
eq(B.salesBy([s1, s2, s3], "item", "2026-09-01", "2026-09-30"), [{ name: "X", net: E(1100) }, { name: "Y", net: E(50) }], "sales by item");
const vr = B.vatReturn([s1, s2, s3], [bill], "2026-09-01", "2026-09-30");
eq([vr.output, vr.input, vr.payable], [E(140) + E(35) - E(14), E(112), E(161) - E(112)], "VAT return: output − input");

// ---- property test: whatever the documents, every entry balances ----
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
let ok = true;
for (let n = 0; n < 2000 && ok; n++) {
  const lines = Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => ({ qty: Math.round(rnd() * 20000) / 1000 + 0.001, price: Math.floor(rnd() * 500000), discBp: Math.floor(rnd() * 3000), tableBp: rnd() < 0.3 ? 500 : 0, vat: ["S", "Z", "E"][Math.floor(rnd() * 3)], wht: ["none", "services", "supplies"][Math.floor(rnd() * 3)] }));
  const d = { type: "invoice", number: "N" + n, date: "2026-09-10", customer: "C", lines };
  try { B.salesEntry(d, undefined, Math.floor(rnd() * 1000)); B.billEntry(d); const t = B.docTotals(d); if (t.total !== t.net + t.tableTax + t.vat) ok = false; if (t.cashDue !== t.total - t.wht) ok = false; } catch (e) { ok = false; }
}
eq(ok, true, "2000 random documents: every journal entry balances and total = net + table tax + VAT");

if (fails.length) { console.log(`\n${fails.length} FAILED`); process.exit(1); } else console.log("\nALL PASSED");
