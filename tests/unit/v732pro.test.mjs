// v6.32 Business "Pro": the crane system's brains in every built system (stock, balances, due dates, bookings,
// documents, recycle bin, sample data, Excel).
import * as E from "../../web-src/erp.js";
import * as P from "../../web-src/erp-pro.js";
import { xlsxFromSheets, unzip } from "../../web-src/convert.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
E.setTestingOpen(true);
const T = (id) => E.systemFromSpec(E.TEMPLATES.find((t) => t.id === id).spec);
const tb = (s, n) => s.tables.find((t) => t.name === n);
const add = (s, n, v) => { const r = E.addRow(s, tb(s, n).id, v); if (r.errors.length) throw new Error(JSON.stringify(r.errors)); return r; };

// ---- a grocery store (the shop template): stock and balances
let s = T("shop");
let d = P.detect(s);
ok(d.stock.length === 1 && d.stock[0].moves.length === 2 && d.stock[0].moves.find((m) => m.tid === tb(s, "Sales").id).sign === -1 && d.stock[0].moves.find((m) => m.tid === tb(s, "Purchases").id).sign === 1, "shop: Products stock = opening + Purchases − Sales");
ok(d.parties.length === 2 && d.parties.find((p) => p.tid === tb(s, "Suppliers").id).supplier, "shop: customers and suppliers get balances");
let r = add(s, "Products", { Product: "Rice 1kg", Price: 40, "In stock": 10, "Reorder at": 5 }); s = r.sys; const rice = r.row;
r = add(s, "Customers", { Name: "Mona" }); s = r.sys; const mona = r.row;
r = add(s, "Sales", { Date: "2026-10-10", Customer: mona._id, Product: rice._id, Qty: 4, "Unit price": 40, Payment: "On credit" }); s = r.sys;
r = add(s, "Sales", { Date: "2026-10-11", Customer: mona._id, Product: rice._id, Qty: 2, "Unit price": 40, Payment: "Cash" }); s = r.sys;
const lv = P.stockLevels(s, P.rules(s).stock[0])[0];
ok(lv.onHand === 4 && lv.low && lv.out === 6, "10 − 4 − 2 = 4 on hand, at or below the reorder level (5)");
const cust = P.rules(s).parties.find((p) => p.tid === tb(s, "Customers").id);
const st = P.statement(s, cust, mona._id);
ok(st.balance === 160 && st.lines.length === 1, "only the credit sale (4 × 40 = 160) is owed; the cash sale isn't");
const over = E.addRow(s, tb(s, "Sales").id, { Date: "2026-10-12", Customer: mona._id, Product: rice._id, Qty: 5, "Unit price": 40, Payment: "Cash" }).sys;
const no = P.checkChange(s, over);
ok(no && /Not enough/.test(no.tpl) && no.vars.have === 4, "selling 5 when 4 are left is refused — «" + (no && no.tpl) + "»");
const fine = E.addRow(s, tb(s, "Purchases").id, { Date: "2026-10-12", Product: rice._id, Qty: 20, "Unit cost": 30 }).sys;
ok(P.checkChange(s, fine) === null && P.stockLevels(fine, P.rules(fine).stock[0])[0].onHand === 24, "a purchase brings stock in (4 + 20 = 24)");
ok(P.checkChange(P.setRule(s, "stock", false), P.setRule(over, "stock", false)) === null, "the owner can switch the stock rule off");
const o = P.overview(s, "2026-10-17");
ok(o.receivable === 160 && o.low.length === 1 && o.monthSales === 240, "overview: 160 owed to you, 1 item low, 240 sales this month");

// ---- crane rental: bookings, due dates, invoice balances
let c = T("cranes");
d = P.detect(c);
ok(d.bookings.length === 1 && d.bookings[0].tid === tb(c, "Jobs").id, "cranes: a crane can't be booked twice");
ok(d.dues.some((x) => x.tid === tb(c, "Crew").id) && d.dues.some((x) => x.tid === tb(c, "Maintenance").id), "cranes: licence expiry and next maintenance warn");
ok(d.parties[0].charges.length === 1 && d.parties[0].charges[0].tid === tb(c, "Invoices").id, "an invoice for a job is the charge — the job isn't counted twice");
r = add(c, "Customers", { Name: "Delta" }); c = r.sys; const delta = r.row;
r = add(c, "Equipment", { Model: "LTM 1100", Status: "Available" }); c = r.sys; const eq = r.row;
r = add(c, "Jobs", { Customer: delta._id, Crane: eq._id, Start: "2026-10-01", End: "2026-10-05", "Daily rate": 9000, Status: "Running" }); c = r.sys; const job = r.row;
const clash = E.addRow(c, tb(c, "Jobs").id, { Customer: delta._id, Crane: eq._id, Start: "2026-10-04", End: "2026-10-06", "Daily rate": 9000, Status: "Confirmed" }).sys;
const why = P.checkChange(c, clash);
ok(why && /already booked/.test(why.tpl) && why.vars.from === "2026-10-01", "an overlapping job for the same crane is refused");
const later = E.addRow(c, tb(c, "Jobs").id, { Customer: delta._id, Crane: eq._id, Start: "2026-10-06", End: "2026-10-08" }).sys;
ok(P.checkChange(c, later) === null, "the day after is fine");
r = add(c, "Invoices", { Customer: delta._id, Job: job._id, Date: "2026-10-06", Amount: 45000, Paid: 20000 }); c = r.sys; const inv = r.row;
const cp = P.rules(c).parties[0];
ok(P.statement(c, cp, delta._id).balance === 25000, "invoice 45,000 − paid 20,000 = 25,000 owed");
r = add(c, "Crew", { Name: "Sayed", Role: "Operator", "Licence expiry": "2026-10-20" }); c = r.sys;
r = add(c, "Crew", { Name: "Hany", Role: "Rigger", "Licence expiry": "2026-09-30" }); c = r.sys;
const due = P.dueList(c, "2026-10-17");
ok(due.length === 2 && due[0].overdue && due[0].left === -17 && due[1].left === 3, "one licence 17 days late, one in 3 days");

// ---- services: payments through the project (Invoices → Projects → Clients); a Paid tick settles it
let v = T("services");
d = P.detect(v);
ok(d.parties.length === 1 && d.parties[0].charges[0].via, "services: invoices reach the client through the project");
r = add(v, "Clients", { Client: "Nile Co" }); v = r.sys; const nile = r.row;
r = add(v, "Projects", { Project: "Tower", Client: nile._id }); v = r.sys;
const pj = r.row;
r = add(v, "Invoices", { Project: pj._id, Date: "2026-10-01", Amount: 1000 }); v = r.sys;
r = add(v, "Invoices", { Project: pj._id, Date: "2026-10-02", Amount: 500, Paid: true }); v = r.sys;
ok(P.statement(v, P.rules(v).parties[0], nile._id).balance === 1000, "1,000 + 500 (paid) → 1,000 owed");

// ---- a grocery store in Arabic, designed by the AI
let g = E.systemFromSpec({ name: "بقالة", tables: [
  { name: "الأصناف", fields: [{ name: "الصنف", type: "text" }, { name: "المخزون", type: "number" }, { name: "حد الطلب", type: "number" }, { name: "السعر", type: "money" }] },
  { name: "العملاء", fields: [{ name: "الاسم", type: "text" }, { name: "الهاتف", type: "phone" }] },
  { name: "المبيعات", fields: [{ name: "التاريخ", type: "date" }, { name: "العميل", type: "link", link: "العملاء" }, { name: "الصنف", type: "link", link: "الأصناف" }, { name: "الكمية", type: "number" }, { name: "الإجمالي", type: "money" }] },
  { name: "المشتريات", fields: [{ name: "التاريخ", type: "date" }, { name: "الصنف", type: "link", link: "الأصناف" }, { name: "الكمية", type: "number" }, { name: "المبلغ", type: "money" }] },
  { name: "التحصيلات", fields: [{ name: "العميل", type: "link", link: "العملاء" }, { name: "التاريخ", type: "date" }, { name: "المبلغ", type: "money" }] }] });
d = P.detect(g);
ok(d.stock.length === 1 && d.stock[0].moves.length === 2 && d.stock[0].reorder, "Arabic names: stock from المبيعات (−) and المشتريات (+), with حد الطلب");
ok(d.parties.length === 1 && d.parties[0].payments.length === 1, "Arabic names: customers' balances with التحصيلات as payments");
ok(P.describeRules(g).every((x) => x.ar && x.en), "each rule is described in English and Arabic");

// ---- sample data for any design
const demo = P.loadDemo(T("shop"), { today: "2026-10-17" });
ok(demo.tables.every((t) => demo.rows[t.id].length >= 4) && P.hasDemo(demo), "sample records in every table");
ok(demo.rows[tb(demo, "Sales").id].every((r) => r[tb(demo, "Sales").fields.find((f) => f.name === "Product").id]), "sample sales point at real products");
ok(P.overview(demo, "2026-10-17").low.length >= 1, "the samples include a low-stock item, so the warning shows");
const back = P.eraseDemo(add(demo, "Customers", { Name: "Real customer" }).sys);
ok(back.tables.reduce((n, t) => n + back.rows[t.id].length, 0) === 1, "erasing the samples keeps the owner's own record");
const cd = P.loadDemo(T("cranes"), { today: "2026-10-17" });
ok(P.checkChange({ ...cd, rows: { ...cd.rows, [tb(cd, "Jobs").id]: [] } }, cd) === null, "crane samples never double-book a crane");
for (const t of E.TEMPLATES) { const x = P.loadDemo(E.systemFromSpec(t.spec), { today: "2026-10-17" }); ok(x.tables.some((tt) => x.rows[tt.id].length), "samples for the " + t.id + " template"); }

// ---- recycle bin
let b = P.trash(s, tb(s, "Customers").id, mona._id, { now: 1000 });
ok(!b.rows[tb(s, "Customers").id].length && P.binList(b, { now: 2000 }).length === 1, "a deleted record goes to the recycle bin");
ok(P.restore(b, mona._id).rows[tb(s, "Customers").id].length === 1, "and comes back");
ok(P.purge(b, { now: 1000 + 8 * 86400000 }).bin.length === 0 && P.binList(b, { now: 1000 + 8 * 86400000 }).length === 0, "after 7 days it's gone for good");

// ---- documents
const doc = P.recordDoc(c, tb(c, "Invoices").id, inv._id, { company: "Ali Cranes" });
ok(/Ali Cranes/.test(doc) && /INV-0001/.test(doc) && /Delta/.test(doc) && /45,000/.test(doc) && /Signature/.test(doc), "an invoice prints with the company, its number, the customer, the amount and signature lines");
const jdoc = P.recordDoc(c, tb(c, "Jobs").id, job._id, { rtl: true, words: { total: "الإجمالي" } });
ok(/dir="rtl"/.test(jdoc) && /<h3>Invoices<\/h3>/.test(jdoc), "a job's page lists its invoices as lines (Arabic: right to left)");
const sdoc = P.statementDoc(c, cp, delta._id, { company: "Ali Cranes" });
ok(/Statement of account/.test(sdoc) && /25,000/.test(sdoc), "a statement of account prints with the running balance");

// ---- Excel: every table as a sheet
const z = await unzip(xlsxFromSheets(P.sheets(demo)));
ok([...z.keys()].filter((k) => /worksheets\/sheet\d+\.xml$/.test(k)).length === demo.tables.length && new TextDecoder().decode(z.get("xl/workbook.xml")).includes('name="Purchases"'), "one Excel file, one sheet per table");
console.log(process.exitCode ? "SOME FAILED" : "ALL PASSED");
